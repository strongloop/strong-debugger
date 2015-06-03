#include <nan.h> // Must be included as the first file
#include <v8-debug.h>
#include "controller.h"
#include "worker.h"
#include "compat.h"

namespace strongloop {
namespace debugger {

using v8::Handle;
using v8::Local;
using v8::HandleScope;
using v8::String;

static Controller * singleton = NULL;

Controller::Controller(Isolate* main_isolate,
                       uv_loop_t* main_loop,
                       const char* workerScript,
                       bool debuglog_enabled)
  : isolate_(main_isolate), event_loop_(main_loop),
    worker_(this, workerScript, debuglog_enabled), start_cb_(NULL) {
}

Controller::~Controller() {
  singleton = NULL;
}

void Controller::Start(uint16_t port,
                       Controller::StartCallback callback,
                       void* callback_data) {
  // TODO(bajtos) Support multiple isolates in Node v0.12+
  // FIXME This check is not race-free.
  if (singleton) {
    callback("Only one isolate (thread) is supported.", -1, callback_data);
    return;
  }
  singleton = this;

  if (start_cb_) {
    callback("Another START request is already in progress.",
      -1, callback_data);
    return;
  }
  start_cb_ = callback;
  start_user_data_ = callback_data;

  UvError err;

  err = AsyncInit(&worker_started_signal_, &Controller::WorkerStartedSignalCb);
  if (err) goto error;
  // NOTE this handle stays referenced in order to block exit of the main
  // process until we finish debugger initialisation

  err = AsyncInit(&enable_request_signal_, &Controller::EnableRequestSignalCb);
  if (err) goto error;
  enable_request_signal_.Unref(); // don't block exit of the main process

  err = AsyncInit(&disable_request_signal_, &Controller::DisableRequestSignalCb);
  if (err) goto error;
  disable_request_signal_.Unref(); // don't block exit of the main process

  worker_.Start(port);

  return;

error:
  const char* msg = uv_strerror(err);

  start_cb_ = NULL;
  start_user_data_ = NULL;
  Cleanup();

  // TODO(bajtos) wait until uv_close_cb of all handles were called before
  // calling back from this method
  callback(msg, -1, callback_data);
}

UvError Controller::AsyncInit(AsyncWrap<Controller>* handle,
                              AsyncWrap<Controller>::Callback callback) {
  return handle->Init(event_loop_, this, callback);
}

void Controller::Cleanup() {
  worker_started_signal_.CloseIfInitialized();
  enable_request_signal_.CloseIfInitialized();
  disable_request_signal_.CloseIfInitialized();
  // TODO: clean up the worker (?)
}

void Controller::Stop() {
  // TODO(bajtos) Stop the worker thread, cleanup resources
}

Controller* Controller::GetInstance(Isolate* /*isolate*/) {
  // TODO(bajtos) Support multiple isolates in Node v0.12+
  return singleton;
}

/***** INTERNAL API FOR WORKER *****/

void Controller::SignalEnableRequest() {
  // TODO call Debugger:DebugBreak()
  enable_request_signal_.Send();
}

void Controller::SignalDisableRequest() {
  disable_request_signal_.Send();
}

void Controller::SignalWorkerStarted() {
  worker_started_signal_.Send();
}

void Controller::SendDebuggerCommand(const char* cmd, size_t cmd_len) {
  uint16_t* cmd2 = new uint16_t[cmd_len];
  for (size_t i=0; i<cmd_len; i++) cmd2[i] = static_cast<uint8_t>(cmd[i]);
  SendDebuggerCommand(cmd2, cmd_len);
  delete[] cmd2;
}

void Controller::SendDebuggerCommand(const uint16_t* cmd, size_t cmd_len) {
#if NODE_VERSION_AT_LEAST(0, 11, 0)
  Debug::SendCommand(isolate_, cmd, cmd_len);
#else
  Debug::SendCommand(cmd, cmd_len, NULL, isolate_);
#endif
}

void Controller::WorkerStartedSignalCb() {
  // Allow the main event loop to exit even while Controller is running
  worker_started_signal_.Unref();
  start_cb_(worker_.GetStartResult(),
            worker_.GetPort(),
            start_user_data_);
}

/***** PRIVATE METHODS *****/

void Controller::EnableRequestSignalCb() {
#if NODE_VERSION_AT_LEAST(0, 11, 0)
  Debug::SetMessageHandler(MessageHandler);
#else
  Debug::SetMessageHandler2(MessageHandler);
#endif

  worker_.SignalEnableResponse();
}

void Controller::DisableRequestSignalCb() {
  Debug::ProcessDebugMessages();
  Debug::SetMessageHandler(0);

  worker_.SignalDisableResponse();
}

void Controller::MessageHandler(const Debug::Message& message) {
#if NODE_VERSION_AT_LEAST(0, 11, 0)
  Isolate* isolate = message.GetIsolate();
  HandleScope scope(isolate);
  Local<String> json = message.GetJSON();
#else
  Isolate* isolate = Isolate::GetCurrent();
  HandleScope scope;
  Handle<String> json = message.GetJSON();
#endif

  Controller* self = GetInstance(isolate);
  self->worker_.HandleDebuggerMessage(*NanUtf8String(json));
}

} // namespace debugger
} // namespace strongloop

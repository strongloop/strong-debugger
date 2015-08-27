#include <nan.h> // Must be included as the first file
#include <v8-debug.h>
#include "controller.h"
#include "worker.h"
#include "compat.h"

namespace strongloop {
namespace debugger {

using v8::Handle;
using v8::Local;
using v8::Locker;
using v8::HandleScope;
using v8::String;

static Controller * singleton = NULL;

Controller::Controller(Isolate* main_isolate,
                       uv_loop_t* main_loop,
                       const char* script_root,
                       bool debuglog_enabled)
  : isolate_(main_isolate), event_loop_(main_loop),
    worker_(this, script_root, debuglog_enabled), start_cb_(NULL) {
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

  err = signals_.Init(event_loop_, this, &Controller::SignalsAvailableCb);
  if (err) goto error;
  // NOTE this handle stays referenced in order to block exit of the main
  // process until we finish debugger initialisation

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
  signals_.CloseIfInitialized();
  singleton = NULL;
}

void Controller::Stop(StopCallback callback, void* callback_data) {
  stop_cb_ = callback;
  stop_user_data_ = callback_data;
  signals_.Ref();
  worker_.Stop();
}

Controller* Controller::GetInstance(Isolate* /*isolate*/) {
  // TODO(bajtos) Support multiple isolates in Node v0.12+
  return singleton;
}

/***** INTERNAL API FOR WORKER *****/

void Controller::SignalEnableRequest() {
  // TODO call Debugger:DebugBreak()
  signals_.PushBack(EnableDebugger);
}

void Controller::SignalDisableRequest() {
  signals_.PushBack(DisableDebugger);
}

void Controller::SignalWorkerStarted() {
  signals_.PushBack(WorkerStarted);
}

void Controller::SignalWorkerStopped() {
  signals_.PushBack(WorkerStopped);
}

void Controller::SignalProcessDebugMessages() {
  signals_.PushBack(ProcessDebugMessages);
}

void Controller::SendDebuggerCommand(const char* cmd, size_t cmd_len) {
  uint16_t* cmd2 = new uint16_t[cmd_len];
  for (size_t i=0; i<cmd_len; i++) cmd2[i] = static_cast<uint8_t>(cmd[i]);
  SendDebuggerCommand(cmd2, cmd_len);
  delete[] cmd2;

  // Call v8::Debug::ProcessDebugMessages() to ensure the message is handled
  // even if there is no JS code running at the moment.
  SignalProcessDebugMessages();
}

void Controller::SendDebuggerCommand(const uint16_t* cmd, size_t cmd_len) {
#if NODE_VERSION_AT_LEAST(0, 11, 0)
  Debug::SendCommand(isolate_, cmd, cmd_len);
#else
  Debug::SendCommand(cmd, cmd_len, NULL, isolate_);
#endif
}

void Controller::SignalsAvailableCb() {
  bool shutdown = false;
  for (;;) {
    MaybeValue<Signal> signal(signals_.PopFront());
    if (!signal.has_value) break;
    switch (signal.value) {
      case WorkerStarted:
        WorkerStartedSignalCb();
        break;
      case WorkerStopped:
        // wait until all signals are processed before shutting down
        shutdown = true;
        break;
      case EnableDebugger:
        EnableRequestSignalCb();
        break;
      case DisableDebugger:
        DisableRequestSignalCb();
        break;
      case ProcessDebugMessages:
        ProcessDebugMessagesCb();
        break;
      default:
        fprintf(stderr,
                "strong-debugger's Controller received unknown signal %d\n",
                signal.value);
    }
  }

  if (shutdown) {
    WorkerStoppedSignalCb();
  }
}

void Controller::WorkerStartedSignalCb() {
  // Allow the main event loop to exit even while Controller is running
  signals_.Unref();
  start_cb_(worker_.GetStartResult(),
            worker_.GetPort(),
            start_user_data_);
}

void Controller::WorkerStoppedSignalCb() {
  signals_.Unref();
  Cleanup();
  stop_cb_(stop_user_data_);
}

void Controller::ProcessDebugMessagesCb() {
  Locker locker(isolate_);
  Isolate::Scope isolate_scope(isolate_);
  Nan::HandleScope scope;

  Debug::ProcessDebugMessages();
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
  Nan::Utf8String json_string(message.GetJSON());
#else
  Isolate* isolate = Isolate::GetCurrent();
  HandleScope scope;
  Local<String> json_handle = Nan::New(message.GetJSON());
  Nan::Utf8String json_string(json_handle);
#endif

  Controller* self = GetInstance(isolate);
  self->worker_.HandleDebuggerMessage(*json_string);
}

} // namespace debugger
} // namespace strongloop

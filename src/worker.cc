#include <nan.h> // Must be included as the first file
#include <v8-debug.h>
#include "worker.h"
#include "controller.h"
#include "compat.h"
#include <sstream>
#include <fstream>

namespace strongloop {
namespace debugger {

Worker::Worker(Controller* controller,
               const char* script_root,
               bool debuglog_enabled)
  : controller_(controller), server_port_(-1),
    isolate_(NULL), event_loop_(NULL),
    debuglog_enabled_(debuglog_enabled) {
  CHECK(!!controller_);

  LoadScriptFile(script_root, "convert.js");
  LoadScriptFile(script_root, "context.js");
  LoadScriptFile(script_root, "debugger-agent.js");
}

void Worker::Start(uint16_t port) {
  start_result_ = InitIsolate();
  if (start_result_) {
    controller_->SignalWorkerStarted();
    return;
  }

  server_port_ = port;

  UvError err;

#if UV_VERSION_MAJOR > 0
  err = uv_loop_init(&event_loop_inst_);
  if (err) goto error;
  event_loop_ = &event_loop_inst_;
#else
  event_loop_ = uv_loop_new();
  if (!event_loop_) {
    err = UvError(UV_ENOMEM);
    goto error;
  }
#endif

  err = AsyncInit(&enable_response_signal_, &Worker::EnableResponseSignalCb);
  if (err) goto error;
  err = AsyncInit(&disable_response_signal_, &Worker::DisableResponseSignalCb);
  if (err) goto error;
  err = AsyncInit(&debugger_messages_signal_, &Worker::DebuggerMessageSignalCb);
  if (err) goto error;

  err = UvResult(uv_mutex_init(&debugger_messages_lock_));
  if (err) goto error;
  debugger_messages_list_.clear();

  client_connected_ = false;

  err = server_.Init(event_loop_, this);
  if (err) goto error;

  err = server_.Bind("127.0.0.1", server_port_);
  if (err) goto error;

  err = server_.Listen(1, &Worker::ServerConnectionCb);
  if (err) goto error;

  err = server_.FetchListeningPortTo(&server_port_);
  if (err) goto error;

  err = UvResult(uv_thread_create(&thread_,
                             reinterpret_cast<void (*)(void *)>(ThreadCb),
                             this));
  if (err) goto error;

  // NOTE(bajtos) Don't call SignalWorkerStarted, it's called from ThreadCb
  return;

error:
  start_result_ = uv_strerror(err);
  server_port_ = -1;

  // TODO(bajtos) wait until uv_close_cb of all handles were called before
  // calling back from this method
  MasterCleanup();

  controller_->SignalWorkerStarted();
}

void Worker::MasterCleanup() {
  enable_response_signal_.CloseIfInitialized();
  disable_response_signal_.CloseIfInitialized();
  debugger_messages_signal_.CloseIfInitialized();
  server_.CloseIfInitialized(NULL);

  if (isolate_) {
    isolate_->Dispose();
    isolate_ = NULL;
  }
}

void Worker::Stop() {
  // TODO(bajtos) clean up and release resources
}

void Worker::SignalEnableResponse() {
  enable_response_signal_.Send();
}

void Worker::SignalDisableResponse() {
  disable_response_signal_.Send();
}

void Worker::HandleDebuggerMessage(const char* message) {
  uv_mutex_lock(&debugger_messages_lock_);
  debugger_messages_list_.push_back(message);
  uv_mutex_unlock(&debugger_messages_lock_);
  debugger_messages_signal_.Send();
}

/***** PRIVATE METHODS *****/

UvError Worker::AsyncInit(AsyncWrap<Worker>* handle,
                  AsyncWrap<Worker>::Callback callback) {
  return handle->Init(event_loop_, this, callback);
}

void Worker::UnhandledError(const char* msg) {
  // TODO: report the error back to the controller and shut down
  printf("Unhandled error in debugger worker: %s\n", msg);
}

void Worker::ThreadCb(Worker* self) {
  self->controller_->SignalWorkerStarted();
  self->Run();
}

void Worker::Run() {
  int res = uv_run(event_loop_, UV_RUN_DEFAULT);
  CHECK_EQ(0, res);
}

void Worker::Enable() {
  controller_->SignalEnableRequest();
}

void Worker::Disable() {
  const char cmd[] = "{\"type\":\"request\",\"command\":\"disconnect\"}";
  controller_->SendDebuggerCommand(cmd, ArraySize(cmd)-1);

  controller_->SignalDisableRequest();
}

void Worker::ServerConnectionCb(TcpWrap<Worker>* /*server*/) {
  if (client_connected_) {
    AcceptAndRejectConnection();
    return;
  }
  client_connected_ = true;

  UvError err = client_.Init(event_loop_, this);
  if (err) goto error;

  err = client_.AcceptFromServer(&server_);
  if (err) goto error;

  EmitScriptEvent("onConnection");

  client_data_received_.clear();
  err = client_.StartReading(&Worker::ClientDataCb, &Worker::ClientErrorCb);
  if (err) goto error;

  return;
error:
  UnhandledError(uv_strerror(err));
  CloseClientConnection();
}

class RejectedClient {
  public:
    template<class S>
    UvError AcceptAndReject(TcpWrap<S>* server) {
      UvError err = conn_.Init(server->handle()->loop, this);
      if (err) return err;

      err = conn_.AcceptFromServer(server);
      if (err) goto error;

      static char response[] =
        "{\"error\": \"Another client is already connected.\"}\r\n";
      write_chunk_ = uv_buf_init(response, ArraySize(response)-1);

      write_req_.data = this;
      uv_write(&write_req_,
               reinterpret_cast<uv_stream_t*>(conn_.handle()),
               &write_chunk_, 1,
               reinterpret_cast<uv_write_cb>(WriteCb));

      return UvOk;
    error:
      CloseIfInitialized();
      return err;
    }

  private:
    void CloseIfInitialized() {
      conn_.CloseIfInitialized(&RejectedClient::CloseCb);
    }
    void CloseCb(IncomingConnection<RejectedClient>* /*conn*/) {
      delete this;
    }

    static void WriteCb(uv_write_t* req) {
      RejectedClient* self = static_cast<RejectedClient*>(req->data);
      self->CloseIfInitialized();
    }

    IncomingConnection<RejectedClient> conn_;
    uv_buf_t write_chunk_;
    uv_write_t write_req_;
};

void Worker::AcceptAndRejectConnection() {
  RejectedClient* client2 = new RejectedClient();
  UvError err = client2->AcceptAndReject(&server_);
  if (err) UnhandledError(uv_strerror(err));
}

int Worker::SendClientMessage(const char* msg, size_t msglen) {
  if (!client_connected_) return 0;
  if (!msglen) return 0;

  char* data = new char[msglen+2];
  memcpy(data, msg, msglen);
  data[msglen++] = '\r';
  data[msglen++] = '\n';

  uv_write_t* req = new uv_write_t;
  req->data = data;

  uv_buf_t chunk = uv_buf_init(data, msglen);

  return uv_write(req,
           reinterpret_cast<uv_stream_t*>(client_.handle()),
           &chunk, 1,
           reinterpret_cast<uv_write_cb>(ClientMessageSentCb));
}

void Worker::ClientMessageSentCb(uv_write_t* req) {
  delete[] reinterpret_cast<char*>(req->data);
  delete req;
}

void Worker::CloseClientConnection() {
  client_.CloseIfInitialized(&Worker::ClientClosedCb);
  Disable();
}

void Worker::ClientClosedCb(IncomingConnection<Worker>* /*client*/) {
  client_connected_ = false;
}

void Worker::EnableResponseSignalCb() {
  EmitScriptEvent("onDebuggerEnabled");
}

void Worker::DisableResponseSignalCb() {
  EmitScriptEvent("onDebuggerDisabled");
}

void Worker::DebuggerMessageSignalCb() {
  uv_mutex_lock(&debugger_messages_lock_);
  while (!debugger_messages_list_.empty()) {
    std::string msg(debugger_messages_list_.front());
    debugger_messages_list_.pop_front();
    uv_mutex_unlock(&debugger_messages_lock_);
    EmitScriptEvent("onDebuggerMessage", msg.c_str());
    uv_mutex_lock(&debugger_messages_lock_);
  }
  uv_mutex_unlock(&debugger_messages_lock_);
}


void Worker::ClientDataCb(IncomingConnection<Worker>* /*client*/,
                          const char* buffer,
                          size_t len) {
  std::string& data = client_data_received_;
  data.append(buffer, len);

  // TODO(bajtos) the string manipulation below needs a good test suite
  size_t start = 0;
  size_t eol = data.find('\n');
  while (eol != std::string::npos) {
    if (eol > start) {
      size_t len = eol - start;
      if (data[eol-1] == '\r') len--;
      data[start+len] = '\0';
      EmitScriptEvent("onFrontEndCommand", data.data()+start);
    }
    start = eol+1;
    eol = data.find('\n', start);
  }

  data.erase(0, start);
}

void Worker::ClientErrorCb(IncomingConnection<Worker>* /*client*/,
                           UvError err) {
  if (err != UV_EOF) UnhandledError(uv_strerror(err));
  CloseClientConnection();
}

void Worker::LoadScriptFile(const char* root, const char* filepath) {
  std::string fullpath(root);
  fullpath += filepath;

  std::ifstream reader(fullpath.c_str());
  if (!reader) {
    std::string msg("Cannot read backend script ");
    msg += fullpath;
    UnhandledError(msg.c_str());
    return;
  }

  std::stringstream buffer;
  buffer << reader.rdbuf();

  ScriptDefinition def(fullpath, buffer.str());
  scripts_.push_back(def);
}

} // namespace debugger
} // namespace strongloop

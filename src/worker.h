#ifndef DEBUGGER_WORKER_H
#define DEBUGGER_WORKER_H

#include <vector>
#include <uv.h>
#include <nan.h>
#include "async-wrap.h"
#include "tcp-wrap.h"
#include "locked-queue.h"
#include "incoming-connection.h"

namespace strongloop {
namespace debugger {

using v8::Context;
using v8::Isolate;
using v8::Persistent;

class Controller;

/**
 * The background worker implementing TCP server for DevTools protocol.
 *
 * The code is running in another thread/event-loop/isolate
 * and cannot access any of Node.js APIs.
 */
class Worker {
  public:
    Worker(Controller* controller,
           const char* worker_script,
           bool debuglog_enabled);

    // API for Controller, may be called from another thread
    void Start(uint16_t port);
    void Stop();

    const char* GetStartResult() { return start_result_; }
    int GetPort() { return server_port_; }

    void SignalEnableResponse();
    void SignalDisableResponse();

    void HandleDebuggerMessage(const char* message);

  private:
    static void ThreadCb(Worker* self);
    void Run();
    void Enable();
    void Disable();
    const char* InitIsolate();
    void MasterCleanup();

    void EnableResponseSignalCb();
    void DisableResponseSignalCb();
    void DebuggerMessageSignalCb();

    void ServerConnectionCb(TcpWrap<Worker>* server);

    void AcceptAndRejectConnection();

    int SendClientMessage(const char* msg, size_t msglen);
    static void ClientMessageSentCb(uv_write_t* req);

    void CloseClientConnection();
    static void CloseClientConnectionCb(uv_handle_t* handle);

    UvError AsyncInit(AsyncWrap<Worker>* handle,
                      AsyncWrap<Worker>::Callback callback);
    void UnhandledError(const char* msg);

    inline UvError UvResult(int res) const {
      return UvLastError(res, event_loop_);
    }

    void ClientDataCb(IncomingConnection<Worker>* client,
                      const char* data,
                      size_t len);
    void ClientErrorCb(IncomingConnection<Worker>* client, UvError err);
    void ClientClosedCb(IncomingConnection<Worker>* client);

    Controller* controller_;

    const char* start_result_;
    uint16_t server_port_;

    Isolate* isolate_;
    Persistent<Context> context_;
    uv_loop_t* event_loop_;
    uv_thread_t thread_;

    AsyncWrap<Worker> enable_response_signal_;
    AsyncWrap<Worker> disable_response_signal_;

    LockedQueue<std::string, Worker> debugger_messages_;

    TcpWrap<Worker> server_;
    IncomingConnection<Worker> client_;
    bool client_connected_;
    std::string client_data_received_;

#if UV_VERSION_MAJOR > 0
    uv_loop_t event_loop_inst_;
#endif

    struct ScriptDefinition {
      std::string filename;
      std::string contents;
      inline ScriptDefinition(std::string f, std::string c)
        : filename(f), contents(c) {
        }
    };
    std::vector<ScriptDefinition> scripts_;
    void LoadScriptFile(const char* script_root, const char* filepath);

    bool debuglog_enabled_;

    // V8 bindings
    void EmitScriptEvent(const char* event, const char* payload = NULL);
    static NAN_METHOD(SendFrontEndMessage);
    static NAN_METHOD(CloseFrontEndConnection);
    static NAN_METHOD(EnableDebugger);
    static NAN_METHOD(DisableDebugger);
    static NAN_METHOD(SendDebuggerCommand);
    static NAN_METHOD(Log);
};

} // namespace debugger
} // namespace strongloop
#endif // DEBUGGER_WORKER_H

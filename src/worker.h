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

// JS_* macros are simplified versions of NAN_* counterparts and don't require
// any current context to exists, as opposed to NAN.
#if NODE_VERSION_AT_LEAST(0, 11, 0)
#define JS_METHOD(name) void name(const v8::FunctionCallbackInfo<v8::Value>& info)
#define JS_RETURN_UNDEFINED() do { return; } while(false)
#else
#define JS_METHOD(name) v8::Handle<v8::Value> name(const v8::Arguments& info)
#define JS_RETURN_UNDEFINED() do { return v8::Undefined(); } while(false)
#endif

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
    void Cleanup();

    void EnableResponseSignalCb();
    void DisableResponseSignalCb();
    void DebuggerMessageSignalCb();
    void StopSignalCb();

    void ServerConnectionCb(TcpWrap<Worker>* server);

    void AcceptAndRejectConnection();

    int SendClientMessage(const char* msg, size_t msglen);
    static void ClientMessageSentCb(uv_write_t* req);

    void CloseClientConnection();
    static void CloseClientConnectionCb(uv_handle_t* handle);

    UvError AsyncInit(AsyncWrap<Worker>* handle,
                      AsyncWrap<Worker>::Callback callback);

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

    AtomicBool running_;

    Isolate* isolate_;
    Persistent<Context> context_;
    uv_loop_t* event_loop_;
    uv_thread_t thread_;

    AsyncWrap<Worker> enable_response_signal_;
    AsyncWrap<Worker> disable_response_signal_;
    AsyncWrap<Worker> stop_signal_;

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
    static JS_METHOD(SendFrontEndMessage);
    static JS_METHOD(CloseFrontEndConnection);
    static JS_METHOD(EnableDebugger);
    static JS_METHOD(DisableDebugger);
    static JS_METHOD(SendDebuggerCommand);
    static JS_METHOD(Log);
};

} // namespace debugger
} // namespace strongloop
#endif // DEBUGGER_WORKER_H

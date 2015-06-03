#ifndef DEBUGGER_CONTROLLER_H
#define DEBUGGER_CONTROLLER_H

#include <memory>
#include <uv.h>
#include <nan.h>
#include <v8-debug.h>
#include "worker.h"
#include "async-wrap.h"
#include "tcp-wrap.h"

namespace strongloop {
namespace debugger {

using v8::Debug;
using v8::Isolate;

/**
 * The Controller instance provides low-level API for the public
 * Node.js API used to control the debugger.
 *
 * The code is running on the main Node.js thread/event-loop/isolate.
 */
class Controller {
  public:
    Controller(Isolate* main_isolate,
               uv_loop_t* main_loop,
               const char* workerScript,
               bool debuglog_enabled);

    static Controller* GetInstance(Isolate* isolate);

    typedef void (*StartCallback)(const char* err,
                                  uint16_t port,
                                  void* user_data);

    void Start(uint16_t port,
               StartCallback callback,
               void* callback_data = NULL);
    void Stop();


    // Internal API for Worker, may be called from another thread
    void SignalEnableRequest();
    void SignalDisableRequest();
    void SignalWorkerStarted();
    void SendDebuggerCommand(const char* cmd, size_t cmd_len);
    void SendDebuggerCommand(const uint16_t* cmd, size_t cmd_len);

    virtual ~Controller();
  private:
    void EnableRequestSignalCb();
    void DisableRequestSignalCb();
    void WorkerStartedSignalCb();
    static void MessageHandler(const Debug::Message& message);

    UvError AsyncInit(AsyncWrap<Controller>* handle,
                      AsyncWrap<Controller>::Callback callback);
    void Cleanup();

    Isolate* const isolate_;
    uv_loop_t* const event_loop_;

    AsyncWrap<Controller> enable_request_signal_;
    AsyncWrap<Controller> disable_request_signal_;
    AsyncWrap<Controller> worker_started_signal_;

    Worker worker_;

    StartCallback start_cb_;
    void* start_user_data_;
};

} // namespace debugger
} // namespace strongloop
#endif // DEBUGGER_CONTROLLER_H

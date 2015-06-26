#ifndef DEBUGGER_CONTROLLER_H
#define DEBUGGER_CONTROLLER_H

#include <memory>
#include <uv.h>
#include <nan.h>
#include <v8-debug.h>
#include "worker.h"
#include "async-wrap.h"
#include "tcp-wrap.h"
#include "locked-queue.h"

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
               const char* script_root,
               bool debuglog_enabled);

    static Controller* GetInstance(Isolate* isolate);

    typedef void (*StartCallback)(const char* err,
                                  uint16_t port,
                                  void* user_data);

    typedef void (*StopCallback)(void* user_data);

    void Start(uint16_t port,
               StartCallback callback,
               void* callback_data = NULL);

    void Stop(StopCallback callback, void* callback_data = NULL);


    // Internal API for Worker, may be called from another thread
    void SignalEnableRequest();
    void SignalDisableRequest();
    void SignalWorkerStarted();
    void SignalWorkerStopped();
    void SignalProcessDebugMessages();
    void SendDebuggerCommand(const char* cmd, size_t cmd_len);
    void SendDebuggerCommand(const uint16_t* cmd, size_t cmd_len);

    virtual ~Controller();
  private:
    enum Signal {
      EnableDebugger,
      DisableDebugger,
      WorkerStarted,
      WorkerStopped,
      ProcessDebugMessages
    };

    void SignalsAvailableCb();
    void EnableRequestSignalCb();
    void DisableRequestSignalCb();
    void WorkerStartedSignalCb();
    void WorkerStoppedSignalCb();
    void ProcessDebugMessagesCb();

    static void MessageHandler(const Debug::Message& message);

    UvError AsyncInit(AsyncWrap<Controller>* handle,
                      AsyncWrap<Controller>::Callback callback);
    void Cleanup();

    Isolate* const isolate_;
    uv_loop_t* const event_loop_;

    LockedQueue<Signal, Controller> signals_;

    Worker worker_;

    StartCallback start_cb_;
    void* start_user_data_;

    StopCallback stop_cb_;
    void* stop_user_data_;
};

} // namespace debugger
} // namespace strongloop
#endif // DEBUGGER_CONTROLLER_H

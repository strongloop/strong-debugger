#ifndef DEBUGGER_ASYNC_WRAP_H
#define DEBUGGER_ASYNC_WRAP_H

#include <uv.h>
#include "compat.h"

namespace strongloop {
namespace debugger {

template<class T>
class AsyncWrap {
  public:
    typedef void (T::* Callback)();

    inline AsyncWrap();
    inline UvError Init(uv_loop_t* event_loop, T* target, Callback callback);
    inline void Unref();
    inline void Ref();
    inline void CloseIfInitialized();

    inline void Send();
  private:
    static inline void SendCb(uv_async_t* handle);
    static inline void CloseCb(uv_handle_t* handle);
    uv_async_t handle_;
    T* target_;
    Callback callback_;
};

} // namespace debugger
} // namespace strongloop

#include "async-wrap-inl.h"

#endif // DEBUGGER_ASYNC_WRAP_H

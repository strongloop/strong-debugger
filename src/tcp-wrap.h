#ifndef DEBUGGER_TCP_WRAP_H
#define DEBUGGER_TCP_WRAP_H

#include <uv.h>
#include "compat.h"

namespace strongloop {
namespace debugger {

template<class T>
class TcpWrap {
  public:
    typedef void (T::* ConnectionCallback)(TcpWrap* wrap);
    typedef void (T::* CloseCallback)(TcpWrap* wrap);

    inline TcpWrap();
    inline UvError Init(uv_loop_t* event_loop, T* target);
    inline void Unref();
    inline void CloseIfInitialized(CloseCallback callback);

    inline UvError Bind(const char* ip4addr, uint16_t port);
    inline UvError Listen(int backlog, ConnectionCallback callback);
    inline UvError FetchListeningPortTo(uint16_t* port);

    template<class C>
    inline UvError Accept(TcpWrap<C>* clientWrap);

    inline uv_tcp_t* handle() { return &handle_; }
    inline bool IsInitialized() const { return !!handle_.data; }

  private:
    template<class C> friend class TcpWrap;

    inline UvError UvResult(int res) const {
      return UvLastError(res, handle_.loop);
    }

    static inline void ConnectionCb(uv_stream_t* server);
    static inline void CloseCb(uv_handle_t* handle);

    uv_tcp_t handle_;
    T* target_;
    ConnectionCallback connection_callback_;
    CloseCallback close_callback_;
};

} // namespace debugger
} // namespace strongloop

#include "tcp-wrap-inl.h"

#endif // DEBUGGER_TCP_WRAP_H

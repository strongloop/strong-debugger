#ifndef DEBUGGER_INCOMING_CONNECTION_H
#define DEBUGGER_INCOMING_CONNECTION_H

#include <uv.h>
#include "compat.h"
#include "tcp-wrap.h"

namespace strongloop {
namespace debugger {

template<class T>
class IncomingConnection {
  public:
    typedef void (T::* DataCallback)(IncomingConnection* conn,
                                     const char* data,
                                     size_t len);
    typedef void (T::* ErrorCallback)(IncomingConnection* conn, UvError err);
    typedef void (T::* CloseCallback)(IncomingConnection* conn);

    inline UvError Init(uv_loop_t* event_loop, T* target);
    inline void CloseIfInitialized(CloseCallback callback);

    template<class S>
    inline UvError AcceptFromServer(TcpWrap<S>* server);

    inline UvError StartReading(DataCallback data_callback,
                                ErrorCallback error_callback);

    inline uv_tcp_t* handle() { return client_.handle(); }
    inline bool IsInitialized() const { return client_.IsInitialized(); }
  private:
    static inline IncomingConnection* FromHandle(uv_handle_t* handle);
    static inline IncomingConnection* FromHandle(uv_stream_t* handle);
    inline UvError UvResult(int res) {
      return UvLastError(res, client_.handle()->loop);
    }

#if UV_VERSION_MAJOR > 0
    static inline void ReadAllocCb(uv_handle_t* handle,
                                   size_t suggested_size,
                                   uv_buf_t* buf);
    static inline void ReadDataCb(uv_stream_t* stream,
                                  ssize_t nread,
                                  const uv_buf_t * buf);
#else
    static inline uv_buf_t ReadAllocCb(uv_handle_t* handle,
                                       size_t suggested_size);

    static inline void ReadDataCb(uv_stream_t* stream,
                                  ssize_t nread,
                                  uv_buf_t buf);
#endif

    inline void CloseCb(TcpWrap<IncomingConnection>* tcp);


    TcpWrap<IncomingConnection> client_;
    static const int kBufferSize = 65535;
    char buffer_[kBufferSize];

    T* target_;
    DataCallback data_callback_;
    ErrorCallback read_error_callback_;
    CloseCallback close_callback_;
};

} // namespace debugger
} // namespace strongloop

#include "incoming-connection-inl.h"

#endif // DEBUGGER_INCOMING_CONNECTION_H

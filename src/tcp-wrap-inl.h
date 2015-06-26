namespace strongloop {
namespace debugger {

template<class T>
TcpWrap<T>::TcpWrap() {
  handle_.data = NULL;
}

template<class T>
UvError TcpWrap<T>::Init(uv_loop_t* event_loop, T* target) {
  CHECK(!IsInitialized());
  UvError err = UvResult(uv_tcp_init(event_loop, &handle_));
  if (err) return err;
  handle_.data = this;
  target_ = target;
  return UvOk;
}

template<class T>
UvError TcpWrap<T>::Bind(const char* ip4addr, uint16_t port) {
  CHECK(IsInitialized());
#if UV_VERSION_MAJOR > 0
  int res;
  struct sockaddr_in address;
  res = uv_ip4_addr(ip4addr, port, &address);
  if (res) return res;

  return uv_tcp_bind(&handle_,
                    reinterpret_cast<const sockaddr*>(&address),
                    0);
#else
  struct sockaddr_in address = uv_ip4_addr(ip4addr, port);
  return UvResult(uv_tcp_bind(&handle_, address));
#endif
}

template<class T>
UvError TcpWrap<T>::Listen(int backlog, ConnectionCallback callback) {
  CHECK(IsInitialized());
  connection_callback_ = callback;
  return UvResult(uv_listen(reinterpret_cast<uv_stream_t*>(&handle_),
                  backlog,
                  reinterpret_cast<uv_connection_cb>(ConnectionCb)));
}

template<class T>
UvError TcpWrap<T>::FetchListeningPortTo(uint16_t* port) {
  struct sockaddr_storage address;
  int addrlen = sizeof(address);
  int res = uv_tcp_getsockname(&handle_,
                               reinterpret_cast<sockaddr*>(&address),
                               &addrlen);
  if (res) return UvResult(res);

  *port = ntohs(reinterpret_cast<const sockaddr_in*>(&address)->sin_port);
  return UvOk;
}

template<class T>
template<class C>
UvError TcpWrap<T>::Accept(TcpWrap<C>* client) {
  CHECK(IsInitialized());
  CHECK(client->IsInitialized());

  return UvResult(uv_accept(
    reinterpret_cast<uv_stream_t*>(&handle_),
    reinterpret_cast<uv_stream_t*>(&client->handle_)));
}

template<class T>
void TcpWrap<T>::Unref() {
  uv_unref(reinterpret_cast<uv_handle_t*>(&handle_));
}

template<class T>
void TcpWrap<T>::CloseIfInitialized(
     typename TcpWrap<T>::CloseCallback callback) {
  if (!IsInitialized()) return;
  close_callback_ = callback;
  uv_close(reinterpret_cast<uv_handle_t*>(&handle_), CloseCb);
}

template<class T>
void TcpWrap<T>::ConnectionCb(uv_stream_t* server) {
  TcpWrap<T>* self = static_cast<TcpWrap<T>*>(server->data);
  ConnectionCallback cb = self->connection_callback_;
  (self->target_->*cb)(self);
}

template<class T>
void TcpWrap<T>::CloseCb(uv_handle_t* handle) {
  TcpWrap<T>* self = static_cast<TcpWrap<T>*>(handle->data);
  handle->data = NULL;
  CloseCallback cb = self->close_callback_;
  if (cb) (self->target_->*cb)(self);
}

} // namespace debugger
} // namespace strongloop

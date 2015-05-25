namespace strongloop {
namespace debugger {

template<class T>
UvError IncomingConnection<T>::Init(uv_loop_t* event_loop, T* target) {
  CHECK(!IsInitialized());
  target_ = target;
  return client_.Init(event_loop, this);
}

template<class T>
template<class S>
UvError IncomingConnection<T>::AcceptFromServer(TcpWrap<S>* server) {
  CHECK(IsInitialized());
  return server->Accept(&client_);
}

template<class T>
UvError IncomingConnection<T>::StartReading(
      typename IncomingConnection<T>::DataCallback data_callback,
      typename IncomingConnection<T>::ErrorCallback error_callback) {
  CHECK(IsInitialized());
  data_callback_ = data_callback;
  read_error_callback_ = error_callback;
  return UvResult(
    uv_read_start(
      reinterpret_cast<uv_stream_t*>(client_.handle()),
      ReadAllocCb,
      ReadDataCb));
}

template<class T>
IncomingConnection<T>* IncomingConnection<T>::FromHandle(uv_handle_t* handle) {
  return static_cast<IncomingConnection*>(handle->data);
}

template<class T>
IncomingConnection<T>* IncomingConnection<T>::FromHandle(uv_stream_t* handle) {
  return static_cast<IncomingConnection*>(handle->data);
}

#if UV_VERSION_MAJOR > 0
template<class T>
void IncomingConnection<T>::ReadAllocCb(uv_handle_t* handle,
                                        size_t /*suggested_size*/,
                                        uv_buf_t* buf) {
  IncomingConnection* self = FromHandle(handle);
  buf->base = self->buffer_;
  buf->len = kBufferSize;
}
#else
template<class T>
uv_buf_t IncomingConnection<T>::ReadAllocCb(uv_handle_t* handle,
                                            size_t /*suggested_size*/) {
  IncomingConnection* self = FromHandle(handle);
  return uv_buf_init(self->buffer_, kBufferSize);
}
#endif


#if UV_VERSION_MAJOR > 0
template<class T>
void IncomingConnection<T>::ReadDataCb(uv_stream_t* stream,
                                       ssize_t nread,
                                       const uv_buf_t * buf) {
#else
template<class T>
void IncomingConnection<T>::ReadDataCb(uv_stream_t* stream,
                                       ssize_t nread,
                                       uv_buf_t buf_inst) {
  const uv_buf_t* buf = &buf_inst;
#endif
  IncomingConnection* self = FromHandle(stream);
  if (nread < 0) {
    UvError err = UvLastError(nread, self->handle()->loop);
    uv_read_stop(stream); // ignoring the result

    ErrorCallback cb = self->read_error_callback_;
    (self->target_->*cb)(self, err);
    return;
  }

  if (nread == 0) {
    return;
  }

  DataCallback cb = self->data_callback_;
  (self->target_->*cb)(self, buf->base, nread);
}

template<class T>
void IncomingConnection<T>::CloseIfInitialized(CloseCallback callback) {
  close_callback_ = callback;
  client_.CloseIfInitialized(&IncomingConnection::CloseCb);
}

template<class T>
void IncomingConnection<T>::CloseCb(TcpWrap<IncomingConnection<T> >* /*tcp*/) {
  (target_->*close_callback_)(this);
}


} // namespace debugger
} // namespace strongloop

namespace strongloop {
namespace debugger {

template<class T>
AsyncWrap<T>::AsyncWrap() {
  handle_.data = NULL;
}

template<class T>
UvError AsyncWrap<T>::Init(uv_loop_t* event_loop,
                           T* target,
                           typename AsyncWrap<T>::Callback callback) {
  if (handle_.data) {
    CloseIfInitialized();
  }

  target_ = target;
  callback_ = callback;
  handle_.data = this;

  int res = uv_async_init(event_loop,
                          &handle_,
                          reinterpret_cast<uv_async_cb>(SendCb));
  if (res) {
    handle_.data = NULL;
    return UvLastError(res, event_loop);
  }

  return UvOk;
}

template<class T>
void AsyncWrap<T>::Unref() {
  CHECK(handle_.data);
  uv_unref(reinterpret_cast<uv_handle_t*>(&handle_));
}

template<class T>
void AsyncWrap<T>::Ref() {
  CHECK(handle_.data);
  uv_ref(reinterpret_cast<uv_handle_t*>(&handle_));
}

template<class T>
void AsyncWrap<T>::CloseIfInitialized() {
  if (!handle_.data) return;
  handle_.data = NULL;
  uv_close(reinterpret_cast<uv_handle_t*>(&handle_), CloseCb);
}

template<class T>
void AsyncWrap<T>::Send() {
  CHECK(handle_.data);
  uv_async_send(&handle_);
}

template<class T>
void AsyncWrap<T>::SendCb(uv_async_t* handle) {
  CHECK(handle->data);
  AsyncWrap<T>* self = static_cast<AsyncWrap<T>*>(handle->data);
  Callback cb = self->callback_;
  (self->target_->*cb)();
}

template<class T>
void AsyncWrap<T>::CloseCb(uv_handle_t* /*handle*/) {
  // no-op
}

} // namespace debugger
} // namespace strongloop

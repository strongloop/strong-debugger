namespace strongloop {
namespace debugger {

template<typename T, typename R>
UvError LockedQueue<T, R>::Init(
      uv_loop_t* event_loop,
      R* owner,
      typename LockedQueue<T, R>::ItemsAvailableCallback callback) {

  UvError err = UvOk;

  err = lock_.Init();
  if (err) goto error;

  err = signal_.Init(event_loop, owner, callback);
  if (err) goto error;

  list_.clear();

  return UvOk;

error:
  CloseIfInitialized();
  return err;
}

template<typename T, typename R>
void LockedQueue<T, R>::CloseIfInitialized() {
  lock_.CloseIfInitialized();
  signal_.CloseIfInitialized();
}

template<typename T, typename R>
void LockedQueue<T, R>::Ref() {
  signal_.Ref();
}

template<typename T, typename R>
void LockedQueue<T, R>::Unref() {
  signal_.Unref();
}

template<typename T, typename R>
void LockedQueue<T, R>::PushBack(const T& item) {
  {
    MutexWrap::Scope guard(&lock_);
    list_.push_back(item);
  }
  signal_.Send();
}

template<typename T, typename R>
MaybeValue<T> LockedQueue<T, R>::PopFront() {
  MutexWrap::Scope guard(&lock_);
  if (list_.empty())
    return MaybeValue<T>::Nothing();

  MaybeValue<T> result = MaybeValue<T>::Something(list_.front());
  list_.pop_front();
  return result;
}

} // namespace debugger
} // namespace strongloop

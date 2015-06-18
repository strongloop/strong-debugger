#ifndef LOCKED_QUEUE_H
#define LOCKED_QUEUE_H

#include <uv.h>
#include "mutex-wrap.h"
#include "async-wrap.h"
#include <deque>


namespace strongloop {
namespace debugger {

template<typename T>
class MaybeValue {
  public:
    const bool has_value;
    const T value;

    inline static MaybeValue Something(const T& value) {
      return MaybeValue(true, value);
    }

    inline static MaybeValue Nothing() {
      return MaybeValue(false, T());
    }
  private:
    MaybeValue(bool h, const T& v) : has_value(h), value(v) {}
};

template<typename T, typename R>
class LockedQueue {
  public:
    typedef void (R::* ItemsAvailableCallback)();

    inline UvError Init(uv_loop_t* event_loop,
                        R* owner,
                        ItemsAvailableCallback callback);

    inline void CloseIfInitialized();
    inline void Ref();
    inline void Unref();

    inline void PushBack(const T& item);
    inline MaybeValue<T> PopFront();
  private:
    AsyncWrap<R> signal_;
    std::deque<T> list_;
    MutexWrap lock_;
};

} // namespace debugger
} // namespace strongloop

#include "locked-queue-inl.h"

#endif // LOCKED_QUEUE_H

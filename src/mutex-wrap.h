#ifndef MUTEX_WRAP_H
#define MUTEX_WRAP_H

#include "compat.h"

namespace strongloop {
namespace debugger {

class MutexWrap {
  public:
    MutexWrap();
    ~MutexWrap();

    UvError Init();
    void CloseIfInitialized();

    class Scope {
      public:
        explicit Scope(MutexWrap* mutex);
        ~Scope();
      private:
        MutexWrap* const wrap_;
    };

  private:
    uv_mutex_t mutex_;
    bool initialised_;
};

} // namespace debugger
} // namespace strongloop

#endif // MUTEX_WRAP_H

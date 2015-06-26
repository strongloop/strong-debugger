#ifndef DEBUGGER_COMPAT_H
#define DEBUGGER_COMPAT_H

#include <assert.h>
#include <uv.h>

namespace strongloop {

template<typename T, size_t N> size_t ArraySize(const T (&)[N]) { return N; }

#if UV_VERSION_MAJOR > 0
typedef int UvError;
static const UvError UvOk = 0;
#else
struct UvError : uv_err_t {
  inline UvError(uv_err_t const& val): uv_err_t(val) {}
  explicit inline UvError(uv_err_code err = UV_OK) { code = err; }

  // safe-bool idiom, see
  // http://blog.asymptotic.co.uk/2014/03/the-safe-bool-idiom-in-c/
  typedef void (UvError::*bool_type)() const;
  inline void do_nothing() const {}
  inline operator bool_type() const { return code ? &UvError::do_nothing : 0; }
};
static const UvError UvOk = UvError(UV_OK);
#endif // UV_VERSION_MAJOR > 0

// Get the last error (it's ok to call this with res=0 too)
inline UvError UvLastError(int res, uv_loop_t* loop);
const char* UvStrError(int res, uv_loop_t* loop);

/***** Atomic bool ****/

#ifdef WIN32
#define FullMemoryBarrier() MemoryBarrier()
#else
#define FullMemoryBarrier() __sync_synchronize()
#endif

class AtomicBool {
  public:
    explicit inline AtomicBool(bool value) : value_(value) {}

    inline operator bool() const {
      FullMemoryBarrier();
      return value_;
    }
    inline AtomicBool& operator=(bool value) {
      value_ = value;
      FullMemoryBarrier();
      return *this;
    }
  private:
    volatile bool value_;
};

/***** modified CHECK macros from io.js/lib/util.h *****/

#if defined(NDEBUG)
# define ASSERT(expression)
# define CHECK(expression) \
  do { \
    if (!(expression)) { \
      fprintf(stderr, "Assertion failed: %s\n", #expression); \
      abort(); \
    } \
  } while (0)
#else
# define ASSERT(expression)  assert(expression)
# define CHECK(expression)   assert(expression)
#endif

#define ASSERT_EQ(a, b) ASSERT((a) == (b))
#define ASSERT_GE(a, b) ASSERT((a) >= (b))
#define ASSERT_GT(a, b) ASSERT((a) > (b))
#define ASSERT_LE(a, b) ASSERT((a) <= (b))
#define ASSERT_LT(a, b) ASSERT((a) < (b))
#define ASSERT_NE(a, b) ASSERT((a) != (b))

#define CHECK_EQ(a, b) CHECK((a) == (b))
#define CHECK_GE(a, b) CHECK((a) >= (b))
#define CHECK_GT(a, b) CHECK((a) > (b))
#define CHECK_LE(a, b) CHECK((a) <= (b))
#define CHECK_LT(a, b) CHECK((a) < (b))
#define CHECK_NE(a, b) CHECK((a) != (b))

#define UNREACHABLE() abort()

} // namespace strongloop

#include "compat-inl.h"
#endif // DEBUGGER_COMPAT_H

#ifndef DEBUGGER_COMPAT_INL_H
#define DEBUGGER_COMPAT_INL_H

namespace strongloop {

#if UV_VERSION_MAJOR > 0
inline UvError UvLastError(int res, uv_loop_t* loop) {
  return res;
}
#else
inline UvError UvLastError(int res, uv_loop_t* loop) {
  return res ? uv_last_error(loop) : UvError(UV_OK);
}

inline bool operator==(UvError lhs, int rhs) {
  return lhs.code == rhs;
}

inline bool operator!=(UvError lhs, int rhs) {
  return !(lhs == rhs);
}
#endif // UV_VERSION_MAJOR > 0

inline const char* UvStrError(int res, uv_loop_t* loop) {
  return uv_strerror(UvLastError(res, loop));
}

} // namespace strongloop
#endif // DEBUGGER_COMPAT_INL_H

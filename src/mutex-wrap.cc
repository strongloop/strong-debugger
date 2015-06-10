#include "mutex-wrap.h"

namespace strongloop {
namespace debugger {

MutexWrap::MutexWrap()
  : initialised_(false) {
}

MutexWrap::~MutexWrap() {
  CloseIfInitialized();
}

UvError MutexWrap::Init() {
  CHECK(!initialised_);
  int err = uv_mutex_init(&mutex_);
  if (err) return UvError(UV_ENOMEM);
  initialised_ = true;
  return UvOk;
}

void MutexWrap::CloseIfInitialized() {
  if (!initialised_) return;
  uv_mutex_destroy(&mutex_);
  initialised_ = false;
}

MutexWrap::Scope::Scope(MutexWrap* wrap)
  : wrap_(wrap) {
  CHECK(wrap->initialised_);
  uv_mutex_lock(&wrap->mutex_);
}

MutexWrap::Scope::~Scope() {
  CHECK(wrap_->initialised_);
  uv_mutex_unlock(&wrap_->mutex_);
}

} // namespace debugger
} // namespace strongloop

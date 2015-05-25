#include <nan.h> // Must be included as the first file
#include <limits>
#include <memory>
#include "controller.h"
#include "compat.h"

namespace strongloop {
namespace debugger {

using v8::Function;
using v8::FunctionTemplate;
using v8::Handle;
using v8::Local;
using v8::Number;
using v8::Object;
using v8::String;
using v8::Value;

static const uint16_t MAX_PORT = -1;

static void StartCallback(const char* err, uint16_t port, void* data) {
  NanScope();

  NanCallback* js_callback = static_cast<NanCallback*>(data);

  Local<Value> args[] = {
    err ? NanError(err) : static_cast<Local<Value> >(NanNull()),
    NanNew<Number>(port)
  };

  js_callback->Call(ArraySize(args), args);

  delete js_callback;
}

NAN_METHOD(Start) {
  if (!args[0]->IsUint32()) {
    // TODO(bajtos) add unit test
    return NanThrowTypeError(
      "The \"port\" argument must be an unsigned integer.");
  }
  const uint32_t port = args[0]->Uint32Value();

  if (port > MAX_PORT) {
    // TODO(bajtos) add unit test
    return NanThrowRangeError(
      "The \"port\" argument must be a number between 0 - 65535.");
  }

  if (!args[1]->IsString()) {
    return NanThrowRangeError(
      "The second argument must be a string - javascript code.");
  }
  Local<String> worker_script = args[1].As<String>();

  if (!args[2]->IsFunction()) {
    // TODO(bajtos) add unit test
    return NanThrowError("You must supply a callback argument.");
  }
  Local<Function> callback = args[2].As<Function>();

  Controller* controller = Controller::GetInstance(args.GetIsolate());
  if (!controller) {
    controller = new Controller(args.GetIsolate(),
                                uv_default_loop(),
                                *NanUtf8String(worker_script));
  }

  if (!controller) {
    Local<Value> err = NanNew<String>(
      "Cannot create a new Controller object, out of memory?");
    NanMakeCallback(NanGetCurrentContext()->Global(), callback, 1, &err);
  }

  NanCallback* js_callback = new NanCallback(callback);
  controller->Start(port, StartCallback, js_callback);

  NanReturnUndefined();
}

NAN_METHOD(Stop) {
  Local<Function> callback = args[0].As<Function>();
  Controller::GetInstance(v8::Isolate::GetCurrent())->Stop();
  NanMakeCallback(NanGetCurrentContext()->Global(), callback, 0, NULL);
  NanReturnUndefined();
}

void InitModule(Handle<Object> exports) {
  exports->Set(NanNew("start"), NanNew<FunctionTemplate>(Start)->GetFunction());
  exports->Set(NanNew("stop"), NanNew<FunctionTemplate>(Stop)->GetFunction());
}

NODE_MODULE(debugger, InitModule)

} // namespace debugger
} // namespace strongloop

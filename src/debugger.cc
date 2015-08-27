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
  Nan::HandleScope scope;

  Nan::Callback* js_callback = static_cast<Nan::Callback*>(data);

  Local<Value> args[] = {
    err ? Nan::Error(err) : static_cast<Local<Value> >(Nan::Null()),
    Nan::New<Number>(port)
  };

  js_callback->Call(ArraySize(args), args);

  delete js_callback;
}

static void StopCallback(void* data) {
  Nan::HandleScope scope;

  Nan::Callback* js_callback = static_cast<Nan::Callback*>(data);

  js_callback->Call(0, NULL);

  delete js_callback;
}

NAN_METHOD(Start) {
  if (!info[0]->IsObject()) {
   return Nan::ThrowTypeError(
     "Internal error: the first arg must be an \"options\" object");
  }

  Local<Object> options = info[0].As<Object>();

  Local<Value> key = Nan::New("port").ToLocalChecked();
  Local<Value> port_handle = Nan::Get(options, key).ToLocalChecked();
  if (!port_handle->IsUint32()) {
    return Nan::ThrowTypeError(
      "The \"port\" option must be an unsigned integer.");
  }
  const uint32_t port = port_handle->Uint32Value();

  if (port > MAX_PORT) {
    return Nan::ThrowRangeError(
      "The \"port\" option must be a number between 0 - 65535.");
  }

  key = Nan::New("scriptRoot").ToLocalChecked();
  Local<Value> val = Nan::Get(options, key).ToLocalChecked();
  if (!val->IsString()) {
    return Nan::ThrowTypeError("options.scriptRoot must be a string");
  }
  Nan::Utf8String script_root(val);

  key = Nan::New("debuglogEnabled").ToLocalChecked();
  val = Nan::Get(options, key).ToLocalChecked();
  if (!val->IsBoolean()) {
    return Nan::ThrowTypeError("options.debuglogEnabled must be a boolean");
  }
  bool debuglog_enabled = val->BooleanValue();

  if (!info[1]->IsFunction()) {
    return Nan::ThrowError("You must supply a callback argument.");
  }
  Local<Function> callback = info[1].As<Function>();

  Controller* controller = Controller::GetInstance(info.GetIsolate());
  if (!controller) {
    controller = new Controller(info.GetIsolate(),
                                uv_default_loop(),
                                *script_root,
                                debuglog_enabled);
  }

  if (!controller) {
    Local<Value> err = Nan::New<String>(
      "Cannot create a new Controller object, out of memory?").ToLocalChecked();
    Nan::MakeCallback(Nan::GetCurrentContext()->Global(), callback, 1, &err);
  }

  Nan::Callback* js_callback = new Nan::Callback(callback);
  controller->Start(port, StartCallback, js_callback);
}

NAN_METHOD(Stop) {
  if (!info[0]->IsFunction()) {
    return Nan::ThrowError("You must supply a callback argument.");
  }

  Local<Function> callback = info[0].As<Function>();
  Nan::Callback* js_callback = new Nan::Callback(callback);

  Controller* controller = Controller::GetInstance(info.GetIsolate());
  controller->Stop(StopCallback, js_callback);
}

void InitModule(Handle<Object> exports) {
  exports->Set(Nan::New("start").ToLocalChecked(),
               Nan::New<FunctionTemplate>(Start)->GetFunction());

  exports->Set(Nan::New("stop").ToLocalChecked(),
               Nan::New<FunctionTemplate>(Stop)->GetFunction());
}

NODE_MODULE(debugger, InitModule)

} // namespace debugger
} // namespace strongloop

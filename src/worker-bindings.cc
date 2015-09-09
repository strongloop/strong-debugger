#include <nan.h> // Must be included as the first file
#include <v8-debug.h>
#include "worker.h"
#include "controller.h"
#include "compat.h"

namespace strongloop {
namespace debugger {

using v8::ExtensionConfiguration;
using v8::Function;
using v8::FunctionTemplate;
using v8::Handle;
using v8::Local;
using v8::Locker;
using v8::Message;
using v8::ObjectTemplate;
using v8::Script;
using v8::String;
using v8::TryCatch;
using v8::Value;

#if NODE_VERSION_AT_LEAST(0, 11, 0)
static const uint32_t kDataSlot = 0;
#endif

void PrintErrorMessage(Handle<Message> msg) {
  fprintf(stderr,
          "%s:%d\n  %s\n%*s\n%s\n",
#if NODE_VERSION_AT_LEAST(0, 11, 0)
          *Nan::Utf8String(msg->GetScriptResourceName()),
#else
          *Nan::Utf8String(Nan::New(msg->GetScriptResourceName())),
#endif
          msg->GetLineNumber(),
          *Nan::Utf8String(msg->GetSourceLine()),
          msg->GetStartColumn() + 1 /* 1-based index */ + 2 /* padding */,
          "^",
          *Nan::Utf8String(msg->Get()));
}

#if NODE_VERSION_AT_LEAST(0, 11, 0)
void SetFunctionTemplate(Isolate* isolate,
                         Local<ObjectTemplate> templ,
                         const char* name,
                         v8::FunctionCallback callback) {
  templ->Set(
    String::NewFromUtf8(isolate, name),
    FunctionTemplate::New(isolate, callback));
}
#else
void SetFunctionTemplate(Isolate* isolate,
                         Local<ObjectTemplate> templ,
                         const char* name,
                         v8::InvocationCallback callback) {
  templ->Set(
    Nan::New(name).ToLocalChecked(),
    FunctionTemplate::New(callback));
}
#endif


const char* Worker::InitIsolate() {
#if NODE_MAJOR_VERSION > 0
  static struct : public v8::ArrayBuffer::Allocator {
    virtual void* Allocate(size_t length) {
      return calloc(length, 1);
    }
    virtual void* AllocateUninitialized(size_t length) {
      return malloc(length);
    }
    virtual void Free(void* data, size_t length) {
      free(data);
    }
  } array_buffer_allocator;
  Isolate::CreateParams params;
  params.array_buffer_allocator = &array_buffer_allocator;
  Isolate* isolate = Isolate::New(params);
#else
  Isolate* isolate = Isolate::New();
#endif
  Locker locker(isolate);
#if NODE_VERSION_AT_LEAST(0, 11, 0)
  isolate->SetData(kDataSlot, this);
#else
  isolate->SetData(this);
#endif
  isolate_ = isolate;

  Isolate::Scope isolate_scope(isolate_);
  Nan::HandleScope scope;

  Local<ObjectTemplate> bindings_templ = Nan::New<ObjectTemplate>();
  SetFunctionTemplate(isolate,
                      bindings_templ,
                      "sendFrontEndMessage",
                      SendFrontEndMessage);
  SetFunctionTemplate(isolate,
                      bindings_templ,
                      "closeFrontEndConnection",
                      CloseFrontEndConnection);
  SetFunctionTemplate(isolate,
                      bindings_templ,
                      "enableDebugger",
                      EnableDebugger);
  SetFunctionTemplate(isolate,
                      bindings_templ,
                      "disableDebugger",
                      DisableDebugger);
  SetFunctionTemplate(isolate,
                      bindings_templ,
                      "sendDebuggerCommand",
                      SendDebuggerCommand);
  SetFunctionTemplate(isolate, bindings_templ, "log", Log);
  // TODO: error logging(?)

  Local<ObjectTemplate> global_templ = Nan::New<ObjectTemplate>();
  Nan::SetTemplate(global_templ, "bindings", bindings_templ);
  Nan::SetTemplate(global_templ,
                   "NODE_MODULE_VERSION",
                   Nan::New(NODE_MODULE_VERSION));

  ExtensionConfiguration* ext = NULL;
#if NODE_VERSION_AT_LEAST(0, 11, 0)
  Local<Context> context = Context::New(isolate_, ext, global_templ);
  context_.Reset(isolate_, context);
  Context::Scope context_scope(context);
#else
  context_ = Context::New(ext, global_templ);
  Context::Scope context_scope(context_);
#endif

  for (size_t ix = 0; ix < scripts_.size(); ix++) {
    const char* script_path = scripts_[ix].filename.c_str();
    Local<String> filename = Nan::New(script_path).ToLocalChecked();
    Local<String> src = Nan::New(scripts_[ix].contents).ToLocalChecked();

    TryCatch try_catch;
    Local<Script> script = Script::Compile(src, filename);
    if (script.IsEmpty()) {
      fprintf(stderr, "[strong-debugger] Cannot compile %s\n", script_path);
      PrintErrorMessage(try_catch.Message());
      return "Internal error: cannot compile one of the worker scripts.";
    }

    script->Run();
    if (try_catch.HasCaught()) {
      printf("[strong-debugger] Cannot load %s\n", script_path);
      PrintErrorMessage(try_catch.Message());
      return "Internal error: cannot load one of the worker scripts.";
    }
  }

  return NULL;
}

void Worker::EmitScriptEvent(const char* event, const char* payload) {
  Locker locker(isolate_);
  Isolate::Scope isolate_scope(isolate_);
  Nan::HandleScope scope;

#if NODE_VERSION_AT_LEAST(0, 11, 0)
  Local<Context> context = Local<Context>::New(isolate_, context_);
  Context::Scope context_scope(context);
#else
  Handle<Context> context = context_;
  Context::Scope context_scope(context_);
#endif

  Local<Value> bindings = context->Global()->Get(
                            Nan::New<String>("bindings").ToLocalChecked());
  Local<Value> handler = bindings->ToObject()->Get(
                            Nan::New<String>(event).ToLocalChecked());
  if (!handler->IsFunction()) {
    printf("[strong-debugger] ignored unhandled event %s(%s)\n",
           event,
           payload ? payload : "");
    return;
  }

  TryCatch try_catch;
  Local<Value> arg = Nan::Undefined();
  if (payload && *payload)
    arg = Nan::New<String>(payload).ToLocalChecked();

  handler.As<Function>()->Call(context->Global(), 1, &arg);
  if (try_catch.HasCaught()) {
    // TODO(bajtos) provide better error reporting
    printf("[strong-debugger] internal error\n");
    PrintErrorMessage(try_catch.Message());
  }
}

Worker* FromIsolate(Isolate* isolate) {
#if NODE_VERSION_AT_LEAST(0, 11, 0)
  void* data = isolate->GetData(kDataSlot);
#else
  void* data = isolate->GetData();
#endif
  return static_cast<Worker*>(data);
}

JS_METHOD(Worker::SendFrontEndMessage) {
  Worker* worker = FromIsolate(info.GetIsolate());

  if (!info[0]->IsString()) {
    Nan::ThrowError("The first argument must be a string.");
    JS_RETURN_UNDEFINED();
  }

  Nan::Utf8String msg(info[0].As<String>());
  worker->SendClientMessage(*msg, msg.length());
  JS_RETURN_UNDEFINED();
}

JS_METHOD(Worker::SendDebuggerCommand) {
  Worker* worker = FromIsolate(info.GetIsolate());

  if (!info[0]->IsString()) {
    Nan::ThrowError("The first argument must be a string.");
    JS_RETURN_UNDEFINED();
  }

  Nan::Utf8String msg(info[0].As<String>());
  worker->controller_->SendDebuggerCommand(*msg, msg.length());
  JS_RETURN_UNDEFINED();
}

JS_METHOD(Worker::CloseFrontEndConnection) {
  Worker* worker = FromIsolate(info.GetIsolate());

  worker->CloseClientConnection();
  JS_RETURN_UNDEFINED();
}

JS_METHOD(Worker::EnableDebugger) {
  Worker* worker = FromIsolate(info.GetIsolate());

  worker->Enable();
  JS_RETURN_UNDEFINED();
}

JS_METHOD(Worker::DisableDebugger) {
  Worker* worker = FromIsolate(info.GetIsolate());

  worker->Disable();
  JS_RETURN_UNDEFINED();
}

JS_METHOD(Worker::Log) {
  Worker* worker = FromIsolate(info.GetIsolate());
  if (!worker->debuglog_enabled_) JS_RETURN_UNDEFINED();

  Nan::Utf8String str(info[0]);
  const char* msg = *str ? *str : "toString() threw an exception";
  fprintf(stderr, "  strong-debugger: %s\n", msg);
  JS_RETURN_UNDEFINED();
}

} // namespace debugger
} // namespace strongloop

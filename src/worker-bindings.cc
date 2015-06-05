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
          *NanUtf8String(msg->GetScriptResourceName()),
          msg->GetLineNumber(),
          *NanUtf8String(msg->GetSourceLine()),
          msg->GetStartColumn() + 1 /* 1-based index */ + 2 /* padding */,
          "^",
          *NanUtf8String(msg->Get()));
}

const char* Worker::InitIsolate() {
  Isolate* isolate = Isolate::New();
  Locker locker(isolate);
#if NODE_VERSION_AT_LEAST(0, 11, 0)
  isolate->SetData(kDataSlot, this);
#else
  isolate->SetData(this);
#endif
  isolate_ = isolate;

  Isolate::Scope isolate_scope(isolate_);
  NanScope();

  Local<ObjectTemplate> bindings_templ = NanNew<ObjectTemplate>();
  bindings_templ->Set(
    NanNew("sendFrontEndMessage"),
    NanNew<FunctionTemplate>(SendFrontEndMessage));
  bindings_templ->Set(
    NanNew("closeFrontEndConnection"),
    NanNew<FunctionTemplate>(CloseFrontEndConnection));
  bindings_templ->Set(
    NanNew("enableDebugger"),
    NanNew<FunctionTemplate>(EnableDebugger));
  bindings_templ->Set(
    NanNew("disableDebugger"),
    NanNew<FunctionTemplate>(DisableDebugger));
  bindings_templ->Set(
    NanNew("sendDebuggerCommand"),
    NanNew<FunctionTemplate>(SendDebuggerCommand));
  bindings_templ->Set(
    NanNew("log"),
    NanNew<FunctionTemplate>(Log));
  // TODO: error logging(?)

  Local<ObjectTemplate> global_templ = NanNew<ObjectTemplate>();
  global_templ->Set(NanNew("bindings"), bindings_templ);

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
    Local<String> filename = NanNew(script_path);
    Local<String> src = NanNew(scripts_[ix].contents.c_str());

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
  NanScope();

#if NODE_VERSION_AT_LEAST(0, 11, 0)
  Local<Context> context = Local<Context>::New(isolate_, context_);
  Context::Scope context_scope(context);
#else
  Handle<Context> context = context_;
  Context::Scope context_scope(context_);
#endif

  Local<Value> bindings = context->Global()->Get(NanNew<String>("bindings"));
  Local<Value> handler = bindings->ToObject()->Get(NanNew<String>(event));
  if (!handler->IsFunction()) {
    printf("[strong-debugger] ignored unhandled event %s(%s)\n",
           event,
           payload ? payload : "");
    return;
  }

  TryCatch try_catch;
  Local<Value> arg = NanUndefined();
  if (payload && *payload)
    arg = NanNew<String>(payload);

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

NAN_METHOD(Worker::SendFrontEndMessage) {
  Worker* worker = FromIsolate(args.GetIsolate());

  if (!args[0]->IsString()) {
    return NanThrowError("The first argument must be a string.");
  }

  NanUtf8String msg(args[0].As<String>());
  worker->SendClientMessage(*msg, msg.length());
  NanReturnUndefined();
}

NAN_METHOD(Worker::SendDebuggerCommand) {
  Worker* worker = FromIsolate(args.GetIsolate());

  if (!args[0]->IsString()) {
    return NanThrowError("The first argument must be a string.");
  }

  NanUtf8String msg(args[0].As<String>());
  worker->controller_->SendDebuggerCommand(*msg, msg.length());
  NanReturnUndefined();
}

NAN_METHOD(Worker::CloseFrontEndConnection) {
  Worker* worker = FromIsolate(args.GetIsolate());

  worker->CloseClientConnection();
  NanReturnUndefined();
}

NAN_METHOD(Worker::EnableDebugger) {
  Worker* worker = FromIsolate(args.GetIsolate());

  worker->Enable();
  NanReturnUndefined();
}

NAN_METHOD(Worker::DisableDebugger) {
  Worker* worker = FromIsolate(args.GetIsolate());

  worker->Disable();
  NanReturnUndefined();
}

NAN_METHOD(Worker::Log) {
  Worker* worker = FromIsolate(args.GetIsolate());
  if (!worker->debuglog_enabled_) {
    NanReturnUndefined();
  }

  NanUtf8String str(args[0]);
  const char* msg = *str ? *str : "toString() threw an exception";
  fprintf(stderr, "  strong-debugger: %s\n", msg);

  NanReturnUndefined();
}

} // namespace debugger
} // namespace strongloop

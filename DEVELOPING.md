# Developer's Guide

## Architecture overview

See this [blog post](https://docs.google.com/document/d/1hPuuKQ3GCLKCUaQaNxuwyRqOfcI_tnqy5TLGLLdWHeM/edit#)
for high-level overview.

Under the hood, the module has three native components:

 - [src/debugger](src/debugger.h) provides bindings for the API exported
   by the module
 - [src/controller](src/controller.h) implements methods that are running
   on the main thread/isolate.
 - [src/worker](src/worker.h) runs in a new background thread and implements
   the TCP server providing Chrome DevTools protocol.

The TCP server must run in a background thread, otherwise it would be paused
by the debugger when the main (debugged) thread is paused.

### Controller-Worker communication

Some V8 Debug API functions must be called on the main thread (most notably
SetMessageHandler), while others should be mostly called from another thread
(SendCommand).

At the same time, we need to handle all requests and responses in the same
thread, on the same libuv event loop. Therefore both Controller and Worker
classes provide thread-safe methods based on libuv's uv_async_t that
allow the other class to send a message to be processed later, during the next
turn of the event loop.

### Background worker

The background worker has its own event loop and v8 isolate, it cannot access
any Node.js API nor npmjs modules.

The TCP server is implemented directly in the native code using libuv's C API.

However, to keep the server implementation simple and lean, it will be written
in JavaScript and use custom bindings exposed by the Worker class.

#### Global API provided from C++ side

 - sendFrontEndMessage()
 - sendDebuggerCommand()
 - closeFrontEndConnection()
 - enableDebugger()
 - disableDebugger()

#### Server API expected by the C++ part

 - onConnection()
 - onFrontEndCommand()
 - onDebuggerEnabled()
 - onDebuggerDisabled()
 - onDebuggerMessage()

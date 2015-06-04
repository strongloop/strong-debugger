/*
Global methods provided by the C++ bindings
  bindings.sendFrontEndMessage(string)
  bindings.closeFrontEndConnection()
  bindings.enableDebugger()
  bindings.disableDebugger()
  bindings.sendDebuggerCommand(string)
  bindings.log(string)

Global methods exported by the script for consumption by C++ backend
  bindings.onConnection()
  bindings.onFrontEndCommand(string)
  bindings.onDebuggerEnabled()
  bindings.onDebuggerDisabled()
  bindings.onDebuggerMessage(string)
*/
/* global bindings:false */

bindings.onConnection = function() {
};

var STUBBED_RESPONSES = {
  'CSS.enable': {},
  'Console.enable': {},
  'DOM.enable': {},
  'DOMStorage.enable': {},
  'Database.enable': {},
  'Debugger.setAsyncCallStackDepth': {},
  'Debugger.setPauseOnExceptions': {},
  'Debugger.skipStackFrames': {},
  'IndexedDB.enable': {},
  'Inspector.enable': {},
  'Network.enable': {},
  'Page.canEmulate': { result: false },
  'Page.canScreencast': { result: false },
  'Page.enable': {},
  'Page.setShowViewportSizeOnResize': {},
  'Profiler.enable': {},
  // TODO detect the status of the debugged process
  // return result:true when --debug-brk
  'Runtime.isRunRequired': {},
  'Profiler.setSamplingInterval': {},
  'Runtime.enable': {},
  'Timeline.enable': {},
  'Worker.canInspectWorkers': { result: false },
  'Worker.setAutoconnectToWorkers': {},
};

bindings.onFrontEndCommand = function(line) {
  var msg;
  try {
    msg = JSON.parse(line);
  } catch (err) {
    reportErrorToFrontEnd('Invalid message: ' + JSON.stringify(err.message));
    return;
  }

  // Custom Extension: send `{ "close": true }` to close the client connection
  if (!msg.method && msg.close) {
    return bindings.closeFrontEndConnection();
  }

  if (STUBBED_RESPONSES[msg.method]) {
    sendFrontEndMessage({
      id: msg.id,
      result: STUBBED_RESPONSES[msg.method]
    });
    return;
  }

  switch (msg.method) {
    case 'Debugger.enable':
      pushPendingRequest(msg);
      bindings.enableDebugger();
      break;
    case 'Debugger.disable':
      pushPendingRequest(msg);
      bindings.disableDebugger();
      break;
    default:
      reportErrorToFrontEnd(
        'Unknown method ' + JSON.stringify(msg.method),
        msg.id);
  }
};

bindings.onDebuggerEnabled = function() {
  popPendingRequestsForMethod('Debugger.enable').forEach(function(req) {
    sendFrontEndMessage({
      id: req.id,
      result: {}
    });
  });
};

bindings.onDebuggerDisabled = function() {
  popPendingRequestsForMethod('Debugger.disable').forEach(function(req) {
    sendFrontEndMessage({
      id: req.id,
      result: {}
    });
  });
};

bindings.onDebuggerMessage = function(data) {
  var msg = JSON.parse(data);
  // Ignore the response to "disconnect" request sent by disableDebugger()
  if (msg.command === 'disconnect') return;
  bindings.sendFrontEndMessage(data);
};

function sendFrontEndMessage(msg) {
  bindings.sendFrontEndMessage(JSON.stringify(msg));
}

function reportErrorToFrontEnd(errorMessage, requestId) {
  sendFrontEndMessage({
    id: requestId,
    error: errorMessage
  });
}

/* Unused for now, but we will need this soon
function sendDebuggerCommand(cmd) {
  bindings.sendDebuggerCommand(JSON.stringify(cmd));
}
*/

// Use `Object.create(null)` instead of `{}`, otherwise clients
// may change prototype by sending `{ "method": "__proto__" }`
var pendingRequests = Object.create(null);

function pushPendingRequest(msg) {
  var key = msg.method;
  var queue = pendingRequests[key];
  if (!queue) queue = pendingRequests[key] = [];
  queue.push(msg);
}

function popPendingRequestsForMethod(cmd) {
  var result = pendingRequests[cmd] || [];
  pendingRequests[cmd] = [];
  return result;
}

function debuglog() {
  var msg = Array.prototype.map.call(arguments, inspect).join(' ');
  bindings.log(msg);

  function inspect(val) {
    return typeof val === 'object' ? JSON.stringify(val) : val.toString();
  }
}

// reference unused API
if (0) {
  debuglog();
}

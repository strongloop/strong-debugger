/*
Global methods provided by the C++ bindings
  bindings.sendFrontEndMessage(string)
  bindings.closeFrontEndConnection()
  bindings.enableDebugger()
  bindings.disableDebugger()
  bindings.sendDebuggerCommand(string)

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

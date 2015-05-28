// Global methods provided by the C++ bindings
/* global
sendFrontEndMessage:false,
closeFrontEndConnection:false,
enableDebugger:false,
disableDebugger:false
*/
// sendDebuggerCommand:false,

// Global methods exported by the script for consumption by C++ backend
/* global
onConnection:true,
onFrontEndCommand:true,
onDebuggerEnabled:true,
onDebuggerDisabled:true,
onDebuggerMessage:true
*/

onConnection = function() {
};

onFrontEndCommand = function(line) {
  var msg;
  try {
    msg = JSON.parse(line);
  } catch (err) {
    sendFrontEndMessage(JSON.stringify({
      error: 'Invalid message: ' + JSON.stringify(err.message)
    }));
    return;
  }

  // Custom Extension: send `{ "close": true }` to close the client connection
  if (!msg.method && msg.close) {
    return closeFrontEndConnection();
  }

  switch (msg.method) {
    case 'Debugger.enable':
      pushPendingRequest(msg);
      enableDebugger();
      break;
    case 'Debugger.disable':
      pushPendingRequest(msg);
      disableDebugger();
      break;
    default:
      sendFrontEndMessage(JSON.stringify({
        error: 'Unknown method ' + JSON.stringify(msg.method)
      }));
  }
};

onDebuggerEnabled = function() {
  popPendingRequestsForMethod('Debugger.enable').forEach(function(req) {
    sendFrontEndMessage(JSON.stringify({
      id: req.id,
      result: {}
    }));
  });
};

onDebuggerDisabled = function() {
  popPendingRequestsForMethod('Debugger.disable').forEach(function(req) {
    sendFrontEndMessage(JSON.stringify({
      id: req.id,
      result: {}
    }));
  });
};

onDebuggerMessage = function(data) {
  var msg = JSON.parse(data);
  // Ignore the response to "disconnect" request sent by disableDebugger()
  if (msg.command === 'disconnect') return;
  sendFrontEndMessage(data);
};

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

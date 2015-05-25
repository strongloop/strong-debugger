// Global methods provided by the C++ bindings
/* global
sendFrontEndMessage:false,
sendDebuggerCommand:false,
closeFrontEndConnection:false,
enableDebugger:false,
disableDebugger:false
*/

// Global methods exported by the script for consumption by C++ backend
/* global
onConnection:true,
onFrontEndCommand:true,
onDebuggerEnabled:true,
onDebuggerDisabled:true,
onDebuggerMessage:true
*/

onConnection = function() {
  sendFrontEndMessage('Welcome to the debugger spike. Commands:');
  sendFrontEndMessage('  enable   - enable (attach) V8 debugger');
  sendFrontEndMessage('  disable  - disable (detach) V8 debugger');
  sendFrontEndMessage('  close    - close the connection');
  sendFrontEndMessage('--');
};

onFrontEndCommand = function(cmd) {
  switch (cmd.toLowerCase()) {
    case 'close':
      return closeFrontEndConnection();
    case 'enable':
      return enableDebugger();
    case 'disable':
      return disableDebugger();
    default:
      return sendFrontEndMessage('Unknown command: ' + JSON.stringify(cmd));
  }
};

onDebuggerEnabled = function() {
  sendFrontEndMessage('Attached.');
  sendDebuggerCommand(JSON.stringify({
    seq: 11,
    type: 'request',
    command: 'version'
  }));
};

onDebuggerDisabled = function() {
  sendFrontEndMessage('Detached.');
};

onDebuggerMessage = function(msg) {
  sendFrontEndMessage(msg);
};

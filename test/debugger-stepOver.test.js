'use strict';
var l = require('./lab');

var SCRIPT_UNDER_TEST = l.fixture(function breakBeforeFunctionCall() {
  /*jshint -W087 */
  console.log('init');
  setInterval(function() {
    debugger; // break on line index 3
    callme();
    console.log('back in main');

    function callme() {
      console.log('called');
    }
  }, 50);
});

l.runUsing(l.debugScript(SCRIPT_UNDER_TEST), function(client) {
  return client.verifyScenario(function(s) {
    s.enableDebugger();
    s.delay(200);
    s.expectDebuggerPausedAt(SCRIPT_UNDER_TEST, 3); // lines are 0-based

    s.sendRequest({ method: 'Debugger.stepOver' });
    s.expectResponse();
    s.expectEvent('Debugger.resumed');
    s.expectDebuggerPausedAt(SCRIPT_UNDER_TEST, 4);

    s.sendRequest({ method: 'Debugger.stepOver' });
    s.expectResponse();
    s.expectEvent('Debugger.resumed');
    s.expectDebuggerPausedAt(SCRIPT_UNDER_TEST, 5);
  });
});

'use strict';
var l = require('./lab');

var SCRIPT_UNDER_TEST = l.fixture(function continueToLocation() {
  /*jshint -W087 */
  tick();
  function tick() {
    debugger; // break on line index 3
    console.log('line 4');
    console.log('line 5'); // continue to line index 5
    console.log('line 6');
    setTimeout(tick, 50);
  }
});

l.runUsing(l.debugScript(SCRIPT_UNDER_TEST), function(client) {
  return client.verifyScenario(function(s) {
    s.enableDebugger();
    s.expectDebuggerPausedAt(SCRIPT_UNDER_TEST, 3); // lines are 0-based

    s.sendRequest({ method: 'Debugger.continueToLocation', params: {
      location: {
        scriptId: s.refScriptIdByName(SCRIPT_UNDER_TEST),
        lineNumber: 5,
        columnNumber: 1
      }
    }});
    s.expectResponse();
    s.expectEvent('Debugger.resumed');
    s.expectDebuggerPausedAt(SCRIPT_UNDER_TEST, 5);

    // Run the tick() function again
    s.resume();
    s.expectDebuggerPausedAt(SCRIPT_UNDER_TEST, 3);
    // Verify that the temporary breakpoint set on line 5 is no longer active
    s.resume();
    s.expectDebuggerPausedAt(SCRIPT_UNDER_TEST, 3);
  });
});

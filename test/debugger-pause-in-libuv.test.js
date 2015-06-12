'use strict';
var l = require('./lab');
var m = l.matchers;

var SCRIPT_UNDER_TEST = l.fixture(function infiniteCounterViaInterval() {
  /*jshint -W087 */
  console.log('init');
  var counter = 0;
  setInterval(function() {
    console.log('tick', ++counter);
  }, 400);
});

l.runUsing(l.debugScript(SCRIPT_UNDER_TEST), function(client) {
  return client.verifyScenario(function(s) {
    s.enableDebugger();
    s.delay(200); // wait for "setInterval()" to return

    s.sendRequest({ method: 'Debugger.pause' });
    s.expectResponse();

    s.expectEvent('Debugger.paused', m.containsProperties({
      // the debugger is paused when there is no script running,
      // thus the call stack is empty
      callFrames: []
    }));
    // TODO(bajtos) Perhaps we should call DebugBreak, not `suspend`?
    // Then we should be able to assert the following:
    // s.expectDebuggerPausedAt(SCRIPT_UNDER_TEST, m.isNumber());
  });
});

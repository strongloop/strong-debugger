'use strict';
var l = require('./lab');
var m = l.matchers;

var SCRIPT_UNDER_TEST = l.fixture(function infiniteCounter() {
  /*jshint -W087 */
  console.log('press ENTER to start...');
  process.stdin.once('data', function() {
    var counter = 0;
    while (true)
      counter++;
  });
});

l.runUsing(l.debugScript(SCRIPT_UNDER_TEST), function(client) {
  return client.verifyScenario(function(s) {
    s.enableDebugger();
    s.sendInput('start\n');
    s.delay(300);

    s.sendRequest({ method: 'Debugger.pause' });
    s.expectResponse();
    s.expectDebuggerPausedAt(SCRIPT_UNDER_TEST, m.isNumber());
  });
});

'use strict';
var l = require('./lab');
var m = l.matchers;

var SCRIPT_UNDER_TEST = l.fixture(function infiniteCounter() {
  /*jshint -W087 */
  console.log('press ENTER to start...');
  process.stdin.once('data', function() {
    // This is tricky. We need a code that spends most of the time in JS land
    // so that Debugger.pause stops in a JS frame, but at the same time
    // we need to allow Node runtime to process messages from the test
    // (e.g. to stop the process and dump code coverage data)
    var counter = 0;
    runForSomeTime();
    function runForSomeTime() {
      do { counter++; } while (counter % 1000000);
      // Take a break, let Node runtime to process other async events
      setImmediate(runForSomeTime);
    }
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

'use strict';
var l = require('./lab');
var m = l.matchers;

var SCRIPT_UNDER_TEST = l.fixture(function continueToLocation() {
  /*jshint -W087 */
  console.log('press ENTER to start...');
  process.stdin.once('data', function run() {
    debugger; // line 3
  });
});

l.runUsing(l.debugScript(SCRIPT_UNDER_TEST), function(client) {
  return client.verifyScenario(function(s) {
    s.enableDebugger();
    s.sendInput('run\n');

    s.expectEvent('Debugger.paused', m.containsProperties({
      callFrames: m.startsWith([
        m.containsProperties({
          callFrameId: '0',
          functionName: 'run',
          location: m.containsProperties({
            lineNumber: 3,
            scriptId: s.refScriptIdByName(SCRIPT_UNDER_TEST)
          }),
        }),
      ]),
      reason: 'other',
      data: null
    }));
  });
});

'use strict';
var l = require('./lab');
var m = l.matchers;
var convert = require('./lab/convert');

var SCRIPT_UNDER_TEST = l.fixture(function() {
  console.log('press ENTER to start...');
  process.stdin.once('data', function() {
    console.log('line 2');
    console.log('line 3');
  });
});

l.runUsing(l.debugScript(SCRIPT_UNDER_TEST), function(client) {
  return client.verifyScenario(function(s) {
    s.enableDebugger();
    s.sendRequest({ method: 'Debugger.setBreakpointByUrl', params: {
      url: convert.v8NameToDevToolsUrl(SCRIPT_UNDER_TEST),
      lineNumber: 3
    }});
    s.expectResponse({
      breakpointId: m.isString(),
      locations: [{
        scriptId: s.refScriptIdByName(SCRIPT_UNDER_TEST),
        lineNumber: 3,
        columnNumber: m.isNumber(),
      }]
    });
    s.sendInput('start');
    s.expectDebuggerPausedAt(SCRIPT_UNDER_TEST, 3); // lines are 0-based
  });
});

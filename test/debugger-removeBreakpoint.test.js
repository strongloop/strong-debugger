'use strict';
var l = require('./lab');
var m = l.matchers;
var convert = require('./lab/convert');

var SCRIPT_UNDER_TEST = l.fixture(function() {
  function handleData(data) {
    console.log('line 1 with data %j', data.toString());
    setTimeout(tick, 10);
  }
  function tick() {
    console.log('press ENTER to start...');
    process.stdin.once('data', handleData);
  }
  tick();
});

l.runUsing(l.debugScript(SCRIPT_UNDER_TEST), function(client) {
  return client.verifyScenario(function(s) {
    s.enableDebugger();
    s.sendRequest({ method: 'Debugger.setBreakpointByUrl', params: {
      url: convert.v8NameToDevToolsUrl(SCRIPT_UNDER_TEST),
      lineNumber: 1
    }});
    s.expectResponse(m.containsProperties({
      breakpointId: s.saveRef('bpId', m.isString())
    }));

    s.sendInput('run and break');
    s.expectDebuggerPausedAt(SCRIPT_UNDER_TEST, 1);

    s.sendRequest({ method: 'Debugger.removeBreakpoint', params: {
      breakpointId: s.ref('bpId')
    }});
    s.expectResponse();

    s.resume();
    s.waitForStdOut('press ENTER to start...');

    s.sendInput('run with no break');
    s.waitForStdOut('press ENTER to start...');
  });
});

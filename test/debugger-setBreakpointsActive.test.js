'use strict';
var l = require('./lab');
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
      lineNumber: 2
    }});
    s.expectResponse();

    s.sendInput('run and break');
    s.waitForStdOut('line 1 with data "run and break"');
    s.expectDebuggerPausedAt(SCRIPT_UNDER_TEST, 2);

    s.sendRequest({ method: 'Debugger.setBreakpointsActive', params: {
      active: false
    }});
    s.expectResponse();

    s.resume();
    s.waitForStdOut('press ENTER to start...');

    s.sendInput('run with no break');
    s.waitForStdOut('line 1 with data "run with no break"');
    /*-- the inactive breakpoint is skipped --*/
    s.waitForStdOut('press ENTER to start...');

    s.sendRequest({ method: 'Debugger.setBreakpointsActive', params: {
      active: true
    }});
    s.expectResponse();

    s.sendInput('run and break again');
    s.waitForStdOut('line 1 with data "run and break again"');
    s.expectDebuggerPausedAt(SCRIPT_UNDER_TEST, 2);
  });
});

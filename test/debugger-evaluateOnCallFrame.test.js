'use strict';
var l = require('./lab');
var m = l.matchers;

var SCRIPT_UNDER_TEST = l.fixture(function continueToLocation() {
  /*jshint -W087 */
  console.log('press ENTER to start...');
  process.stdin.once('data', function() {
    var foo = 'bar';
    debugger; // line 4
    console.log(foo);
  });
});

l.runUsing(l.debugScript(SCRIPT_UNDER_TEST), function(client) {
  return client.verifyScenario(function(s) {
    s.enableDebugger();
    s.sendInput('run');
    s.expectDebuggerPausedAt(SCRIPT_UNDER_TEST, 4); // lines are 0-based

    s.sendRequest({ method: 'Debugger.evaluateOnCallFrame', params: {
      expression: 'foo.toUpperCase()',
      callFrameId: '0'
    }});
    s.expectResponse({
      result: {
        description: 'BAR',
        type: 'string',
        value: 'BAR',
      },
      wasThrown: false
    });

    s.sendRequest({ method: 'Debugger.evaluateOnCallFrame', params: {
      expression: 'console',
      callFrameId: '0'
    }});
    s.expectResponse({
      result: {
        className: 'Object',
        description: 'Console',
        objectId: m.isString(),
        type: 'object',
      },
      wasThrown: false
    });

    s.sendRequest({ method: 'Debugger.evaluateOnCallFrame', params: {
      expression: 'throw new Error("expected")',
      callFrameId: '0'
    }});
    s.expectResponse({
      result: {
        className: 'Error',
        description: 'Error: expected',
        objectId: 'ERROR',
        type: 'object',
      },
      wasThrown: true
    });
  });
});

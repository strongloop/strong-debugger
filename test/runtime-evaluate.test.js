'use strict';
var l = require('./lab');
var m = l.matchers;

var SCRIPT_UNDER_TEST = l.fixture(function continueToLocation() {
  process.stdin.on('data', function(data) {
    console.log(data);
  });
});

l.runUsing(l.debugScript(SCRIPT_UNDER_TEST), function(client) {
  return client.verifyScenario(function(s) {
    s.enableDebugger();

    s.sendRequest({ method: 'Runtime.evaluate', params: {
      expression: '1+1',
    }});
    s.expectResponse({
      result: {
        description: '2',
        type: 'number',
        value: 2,
      },
      wasThrown: false
    });

    s.sendRequest({ method: 'Runtime.evaluate', params: {
      expression: 'console',
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

    s.sendRequest({ method: 'Runtime.evaluate', params: {
      expression: 'throw new Error("expected")',
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

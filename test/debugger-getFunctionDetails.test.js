'use strict';
var l = require('./lab');
var m = l.matchers;

var SCRIPT_UNDER_TEST = l.fixture(function continueToLocation() {
  /*jshint -W087 */
  console.log('press ENTER to start...');
  process.stdin.once('data', function() {
    debugger; // line 3
    console.log(hello());
  });

  function hello() { // line 7
    return 'hello';
  }
});

l.runUsing(l.debugScript(SCRIPT_UNDER_TEST), function(client) {
  return client.verifyScenario(function(s) {
    s.enableDebugger();
    s.sendInput('run');
    s.expectDebuggerPausedAt(SCRIPT_UNDER_TEST, 3);

    s.sendRequest({ method: 'Debugger.evaluateOnCallFrame', params: {
      expression: 'hello',
      callFrameId: '0'
    }});
    s.expectResponse({
      result: {
        type: 'function',
        objectId: s.saveRef('objectId', m.isString()),
        className: 'Function',
        description: /^function hello()/,
      },
      wasThrown: false
    });

    s.sendRequest({ method: 'Debugger.getFunctionDetails', params: {
      functionId: s.ref('objectId')
    }});
    s.expectResponse({
      details: {
        location: {
          columnNumber: m.isNumber(),
          lineNumber: 7,
          scriptId: s.refScriptIdByName(SCRIPT_UNDER_TEST),
        },
        functionName: 'hello',
        scopeChain: [],
      },
    });
  });
});

'use strict';
var l = require('./lab');
var m = l.matchers;

var SCRIPT_UNDER_TEST = l.fixture(function continueToLocation() {
  /*jshint -W087 */
  console.log('press ENTER to start...');
  process.stdin.once('data', function() {
    var meta = 42;
    debugger; // line 4
    console.log(meta);
  });
});

l.runUsing(l.debugScript(SCRIPT_UNDER_TEST), function(client) {
  return client.verifyScenario(function(s) {
    s.enableDebugger();
    s.sendInput('run');
    s.expectDebuggerPausedAt(SCRIPT_UNDER_TEST, 4);

    testValueSetter(
      { value: 'string-value' }, // a string
      { type: 'string', value: 'string-value', description: 'string-value' }
    );

    testValueSetter(
      { value: 10 }, // a number
      { type: 'number', value: 10, description: '10' }
    );

    testValueSetter(
      { value: null }, // null
      { type: 'null', subtype: 'null', value: null, description: 'null'}
    );

    testValueSetter(
      { }, // undefined,
      { type: 'undefined', description: 'undefined' }
    );

    testRefSetter(
      'console', // an object
      function(valueId) {
        return {
          type: 'object',
          objectId: valueId,
          className: 'Object',
          description: 'Console'
        };
      }
    );

    // 'function () { [native code] }'
    var logDescription = String(console.log);
    // Workaround for a bug in V8 4.5
    // toString result: "function bound bound ASSERT() { [native code] }"
    // debugger result: "function bound () { [native code] }"
    logDescription = logDescription.replace('bound bound ASSERT', 'bound ');

    testRefSetter(
      'console.log', // a function
      function(valueId) {
        return {
          type: 'function',
          objectId: valueId,
          className: 'Function',
          description: logDescription,
        };
      }
    );

    // helpers (implementation details) below this line

    function testValueSetter(newValue, expectedResult) {
      verifySetter(newValue, expectedResult);
    }

    function testRefSetter(newValueExpr, expectedResultBuilder) {
      s.sendRequest({ method: 'Debugger.evaluateOnCallFrame', params: {
        expression: newValueExpr,
        callFrameId: '0',
      }});
      s.expectResponse({
        result: m.containsProperties({
          objectId: s.saveRef('expectedObjectId', m.isString())
        }),
        wasThrown: false
      });

      var id = s.ref('expectedObjectId');
      verifySetter({ objectId: id }, expectedResultBuilder(id));
    }

    function verifySetter(newValue, expectedResult) {
      s.sendRequest({ method: 'Debugger.setVariableValue', params: {
        variableName: 'meta',
        callFrameId: '0',
        scopeNumber: '0',
        newValue: newValue
      }});
      s.expectResponse();

      s.sendRequest({ method: 'Debugger.evaluateOnCallFrame', params: {
        expression: 'meta',
        callFrameId: '0'
      }});
      s.expectResponse({
        result: expectedResult,
        wasThrown: false
      });
    }
  });
});

'use strict';
var l = require('./lab');
var m = l.matchers;

var SCRIPT_UNDER_TEST = l.fixture(function continueToLocation() {
  /*jshint -W087 */
  console.log('press ENTER to start...');
  process.stdin.once('data', function(data) {
    data = data.toString();
    var inspectedObject = new InspectedClass();
    debugger; // line 5
    console.log(data);
    console.log(inspectedObject);
  });

  function InspectedClass() {
    this.writableProp = 'wr';
    Object.defineProperty(this, 'readonlyProp', { value: 'ro' });
  }
});

l.runUsing(l.debugScript(SCRIPT_UNDER_TEST), function(client) {
  return client.verifyScenario(function(s) {
    s.enableDebugger();
    s.sendInput('run');
    s.expectDebuggerPausedAt(SCRIPT_UNDER_TEST, 5);

    s.findLocalObjectId('inspectedObject', 'anObjectId');
    s.findGlobalObjectId('console.log', 'aFunctionId');

    testSetter({
      type: 'string',
      value: 'string"\'value',
      description: 'string"\'value'
    });

    testSetter(
      { type: 'number', value: 10, description: '10' }
    );

    testSetter(
      { type: 'null', subtype: 'null', value: null, description: 'null'}
    );

    testSetter(
      { type: 'undefined', description: 'undefined' }
    );

    testSetter({
      type: 'object',
      objectId: s.ref('anObjectId'),
      className: 'Object',
      description: 'InspectedClass'
    });

    // 'function () { [native code] }'
    var logDescription = String(console.log);
    // Workaround for a bug in V8 4.5
    // toString result: "function bound bound ASSERT() { [native code] }"
    // debugger result: "function bound () { [native code] }"
    logDescription = logDescription.replace('bound bound ASSERT', 'bound ');

    testSetter({
      type: 'function',
      objectId: s.ref('aFunctionId'),
      className: 'Function',
      description: logDescription,
    });

    // helpers (implementation details) below this line

    function testSetter(valueDescriptor) {
      s.sendRequest({ method: 'Runtime.callFunctionOn', params: {
        objectId: s.ref('anObjectId'),
        functionDeclaration: setPropertyValue.toString(),
        arguments: [
          { value: 'prop' },
          valueDescriptor
        ]
      }});
      s.expectResponse(m.containsProperties({ wasThrown: false }));

      // verify the new property value

      s.sendRequest({ method: 'Debugger.evaluateOnCallFrame', params: {
        expression: 'inspectedObject.prop',
        callFrameId: 0
      }});
      s.expectResponse({
        result: valueDescriptor,
        wasThrown: false
      });
    }
  });
});

// Copied from DevTool's RemoteObject.js
function setPropertyValue(name, value) {
  /* jshint validthis: true */
  this[name] = value;
}

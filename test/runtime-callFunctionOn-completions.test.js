'use strict';
var l = require('./lab');
var m = l.matchers;

var SCRIPT_UNDER_TEST = l.fixture(function continueToLocation() {
  /*jshint -W087 */
  console.log('press ENTER to start...');
  process.stdin.once('data', function(data) {
    debugger; // line 3
  });
});

l.runUsing(l.debugScript(SCRIPT_UNDER_TEST), function(client) {
  return client.verifyScenario(function(s) {
    s.enableDebugger();
    s.sendInput('run');
    s.expectDebuggerPausedAt(SCRIPT_UNDER_TEST, 3);

    s.findGlobalObjectId('console', 'consoleObjectId');

    s.sendRequest({ method: 'Runtime.callFunctionOn', params: {
      objectId: s.ref('consoleObjectId'),
      functionDeclaration: getCompletions.toString(),
      returnByValue: true
    }});

    s.expectResponse({
      result: {
        value: m.containsProperties({
          log: true,
          info: true,
          warn: true,
          error: true,
          // etc.
        }),
      },
      wasThrown: false
    });
  });
});

// Copied from DevTool's RuntimeModel.js and replaced " with '
function getCompletions(primitiveType) {
  /*jshint -W053, proto:true, validthis: true */
  var object;
  if (primitiveType === 'string')
    object = new String('');
  else if (primitiveType === 'number')
    object = new Number(0);
  else if (primitiveType === 'boolean')
    object = new Boolean(false);
  else
    object = this;

  var resultSet = {};
  for (var o = object; o; o = o.__proto__) {
    try {
      var names = Object.getOwnPropertyNames(o);
      for (var i = 0; i < names.length; ++i)
        resultSet[names[i]] = true;
    } catch (e) {
    }
  }
  return resultSet;
}

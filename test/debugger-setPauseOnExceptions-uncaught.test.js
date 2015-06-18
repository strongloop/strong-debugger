'use strict';
var l = require('./lab');
var m = l.matchers;

if (/^v0\.10\./.test(process.version)) {
  l.current().ok(true, '', {
    skip: 'Node v0.10 does not support setPauseOnExceptions' +
      ' for uncaught exceptions only'
  });
  return;
}

var SCRIPT_UNDER_TEST = l.fixture(function() {
  console.log('press ENTER to start...');
  process.stdin.once('data', function run() {
    try {
      throw new Error('expected - caught'); // line 3
    } catch (err) {
      console.error('caught', err.stack);
    }
    throw new Error('expected - uncaught'); // line 7
  });
});

l.runUsing(l.debugScript(SCRIPT_UNDER_TEST), function(client) {
  client.ignoreDebuggeeCrash();

  return client.verifyScenario(function(s) {
    s.sendRequest({ id: 1, method: 'Debugger.setPauseOnExceptions', params: {
      state: 'uncaught',
    }});

    // setPauseOnExceptions requires the debugger to be eventually enabled
    // before it can send back the response
    s.enableDebugger();

    // setPauseOnExceptions response
    s.expectMessage({ id: 1, result: m.isObject() });

    s.skipEvents('Debugger.scriptParsed');
    s.sendInput('run');

    s.expectEvent('Debugger.paused', m.containsProperties({
      callFrames: m.startsWith([
        m.containsProperties({
          callFrameId: '0',
          functionName: 'run',
          location: m.containsProperties({
            lineNumber: 7,
            scriptId: s.refScriptIdByName(SCRIPT_UNDER_TEST)
          }),
        }),
      ]),
      reason: 'exception',
      data: {
        className: 'Error',
        description: 'Error: expected - uncaught',
        objectId: '0',
        type: 'object',
      }
    }));

    s.resume();
  });
});

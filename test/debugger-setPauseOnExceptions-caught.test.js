'use strict';
var l = require('./lab');
var m = l.matchers;

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
    s.enableDebugger();
    s.sendRequest({ method: 'Debugger.setPauseOnExceptions', params: {
      state: 'all',
    }});
    s.expectResponse();

    s.sendInput('run');
    s.expectEvent('Debugger.paused', m.containsProperties({
      callFrames: m.startsWith([
        m.containsProperties({
          callFrameId: '0',
          functionName: 'run',
          location: m.containsProperties({
            lineNumber: 3,
            scriptId: s.refScriptIdByName(SCRIPT_UNDER_TEST)
          }),
        }),
      ]),
      reason: 'exception',
      data: {
        className: 'Error',
        description: 'Error: expected - caught',
        objectId: '0',
        type: 'object',
      }
    }));

    s.resume();
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

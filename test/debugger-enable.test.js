'use strict';
var l = require('./lab');
var m = require('./lab/matchers');

l.runUsing(l.debugScript(l.fixture('periodic-break.js')), function(client) {
  return client.verifyScenario(function(s) {
    s.sendRequest({ id: 1, method: 'Debugger.enable' });
    s.expectResponse();
    s.expectEvent('Debugger.scriptParsed', m.containsProperties({
      scriptId: s.saveRef('scriptId', m.isString()),
      url: /^file:.*test[\\\/]fixtures[\\\/]periodic-break.js/
    }));
    s.skipEvents('Debugger.scriptParsed');
    s.expectEvent('Debugger.paused', {
      callFrames: m.startsWith([
        {
          'this': m.isObject(),
          scopeChain: m.isObject(),
          location: m.containsProperties({
            lineNumber: 2,
            columnNumber: 2,
            scriptId: s.ref('scriptId')
          }),
          functionName: '',
          callFrameId: '0'
        },
      ]),
      reason: m.isString(),
      data: null,
      // ignored: hitBreakpoints, asyncStackTrace
    });
  });
});

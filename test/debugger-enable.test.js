var l = require('./lab');
var m = require('./lab/matchers');

l.runUsing(l.debugScript(l.fixture('periodic-break.js')), function(client) {
  return client.verifyScenario(function(s) {
    s.sendRequest({ id: 1, method:'Debugger.enable' });
    s.expectMessage({ id: 1, result: {}});
    s.expectEvent('Debugger.paused', {
      callFrames: m.startsWith([
        {
          'this': m.isObject(),
          scopeChain: m.isObject(),
          location: m.containsProperties({
            lineNumber: 1,
            columnNumber: 2,
            scriptId: m.isString() // script-id is specific to Node version
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

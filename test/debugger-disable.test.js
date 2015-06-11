'use strict';
var l = require('./lab');

l.runUsing(l.debugScript(l.fixture('periodic-logger.js')), function(client) {
  return waitForClientStdout()
    .timeout(1000, 'Client did not start within 1s')
    .then(function() {
      return client.verifyScenario(function(s) {
        s.enableDebugger();
        s.expectEvent('Debugger.paused');
        s.delay(200);
        s.sendRequest({ method: 'Debugger.disable' });
        s.expectResponse();
      });
    })
    .then(waitForClientStdout)
    .timeout(1000, 'Debuggee was not resumed within 1s');

  function waitForClientStdout() {
    return l.Promise.waitForEvent(client, 'stdout');
  }
});

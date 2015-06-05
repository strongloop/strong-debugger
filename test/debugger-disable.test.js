var l = require('./lab');
var m = require('./lab/matchers');

l.runUsing(l.debugScript(l.fixture('periodic-logger.js')), function(client) {
  return waitForClientStdout()
    .timeout(1000, 'Client did not start within 1s')
    .then(function() {
      return client.verifyScenario(function(s) {
        s.sendRequest({ id: 1, method: 'Debugger.enable' });
        s.expectMessage(m.containsProperties({ id: 1 }));
        // FIXME - skip all events messages instead
        s.expectEvent('Debugger.paused');
        s.delay(200);
        s.sendRequest({ id: 2, method: 'Debugger.disable' });
        s.expectMessage({ id: 2, result: {} });
      });
    })
    .then(waitForClientStdout)
    .timeout(1000, 'Debugee was not resumed within 1s');

  function waitForClientStdout() {
    return l.Promise.waitForEvent(client, 'stdout');
  }
});

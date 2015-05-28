var l = require('./lab');
var m = require('./lab/matchers');

l.run(function() {
  return l.debugScript(l.fixture('periodic-logger.js'))
    .then(waitForClientStdout)
    .timeout(1000, 'Client did not start within 1s')
    .then(function() {
      return this.client.verifyScenario(function(s) {
        s.sendRequest({ id: 1, method: 'Debugger.enable' });
        s.expectMessage(m.containsProperties({ id: 1 }));
        // FIXME - skip all events messages instead
        s.expectMessage(m.containsProperties({
          type: 'event',
          event: 'break',
        }));
        s.delay(200);
        s.sendRequest({ id: 2, method: 'Debugger.disable' });
        s.expectMessage({ id: 2, result: {} });
      });
    })
    .then(waitForClientStdout)
    .timeout(1000, 'Debugee was not resumed within 1s')
    .finally(function() { if (this.client) this.client.close(); });
});

function waitForClientStdout() {
  return waitForEvent(this.client, 'stdout');
}

function waitForEvent(emitter, name) {
  return new l.Promise(function(resolve, reject) {
    emitter.once(name, resolve);
  });
}

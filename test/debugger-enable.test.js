var l = require('./lab');
var m = require('./lab/matchers');

l.run(function() {
  return l.debugScript(l.fixture('periodic-break.js'))
    .then(function(client) {
      return client
        .verifyScenario(function(s) {
          s.sendRequest({ id: 1, method:'Debugger.enable' });
          s.expectMessage({ id: 1, result: {}});
          // FIXME - we should report a DevTools event, not a V8 debugger event
          s.expectMessage(m.containsProperties({
            type: 'event',
            event: 'break',
            body: m.containsProperties({
              sourceLine: 1,
              script: m.containsProperties({
                name: /[\\\/]test[\\\/]fixtures[\\\/]periodic-break\.js$/
              })
            })
          }));
        })
        .finally(client.close.bind(client));
    });
});

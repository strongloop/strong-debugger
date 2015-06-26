'use strict';
var l = require('./lab');
var Promise = l.Promise;

var SCRIPT_UNDER_TEST = l.fixture('http-server.js');

l.runUsing(l.debugScript(SCRIPT_UNDER_TEST), function(client) {
  return Promise.resolve()
    .then(function() {
      return client.verifyScenario(function(s) {
        s.enableDebugger();
      });
    })
    .then(function() {
      var crashed = Promise.waitForEvent(client, 'error')
        .then(function(err) { throw err; });

      var stopped = Promise.join(
        Promise.waitForEvent(client._debugee, 'message'),
        Promise.waitForEvent(client._conn, 'end')
      );

      client._debugee.send({ cmd: 'STOP' });
      return Promise.race([stopped, crashed]);
    });
});

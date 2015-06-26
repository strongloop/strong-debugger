'use strict';
var l = require('./lab');
var dbg = l.Promise.promisifyAll(require('../'));
var net = require('net');

var debuggerPort;

l.it('can restart the debugger', function() {
  return dbg.startAsync(0)
    .then(function() {
      return dbg.stopAsync();
    })
    .then(function() {
      return dbg.startAsync(0);
    })
    .then(function(port) {
      debuggerPort = port;
      // Open two connections, the second connection verifies
      // cleanup of RejectedClient class (providing the timing is right)
      return l.Promise.join(connect(), connect());
    })
    .then(function() {
      return dbg.stopAsync();
    });
});

function connect() {
  var client = net.connect(debuggerPort);
  client.on('error', function(err) {
    l.debuglog('Ignoring client error', err);
  });
  client.on('data', function(chunk) {
    l.debuglog('Client sent data', chunk.toString());
  });
  return l.Promise.waitForEvent(client, 'connect');
}

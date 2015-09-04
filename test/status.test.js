'use strict';
var l = require('./lab');
var dbg = l.Promise.promisifyAll(require('../'));
var expect = l.expect;

l.it('reports debugger status', function() {
  expect(dbg.status()).to.eql({ running: false, port: null });
  return dbg.startAsync(0)
    .then(function(port) {
      expect(dbg.status()).to.eql({ running: true, port: port });
      return dbg.stopAsync();
    })
    .then(function() {
      expect(dbg.status()).to.eql({ running: false, port: null });
    });
});

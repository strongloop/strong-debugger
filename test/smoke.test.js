'use strict';
var l = require('./lab');
var expect = l.expect;

l.it('loads native add-on and enables the debugger server on a dynamic port',
function() {
  var dbg;
  expect(function() { dbg = require('../'); }).to.not.throw();

  l.Promise.promisifyAll(dbg);

  return dbg.startAsync(0)
    .then(function(port) {
      expect(port).to.not.equal(0);
      return dbg.stopAsync();
    });
});

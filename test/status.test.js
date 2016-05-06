// Copyright IBM Corp. 2015. All Rights Reserved.
// Node module: strong-debugger
// US Government Users Restricted Rights - Use, duplication or disclosure
// restricted by GSA ADP Schedule Contract with IBM Corp.

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

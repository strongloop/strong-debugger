'use strict';
var l = require('./lab');
var expect = l.expect;
var dbg = require('../');

var NOOP = function() {};

l.describe('start(port, cb)', function() {
  l.it('throws when port is not a number', function() {
    expect(function() { dbg.start('port', NOOP); })
      .to.throw(/port.*unsigned integer/);
  });

  l.it('throws when port is too large', function() {
    expect(function() { dbg.start(123123, NOOP); })
      .to.throw(/port.*65535/);
  });

  l.it('throws when no callback is provided', function() {
    expect(function() { dbg.start(80); })
      .to.throw(/callback argument/);
  });
});

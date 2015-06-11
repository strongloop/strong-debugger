'use strict';
/* Lab: a laboratory for running automated tests */
var path = require('path');

exports.Promise = require('./promise');

var tap = require('./tap');
exports.it = tap.it;
exports.describe = tap.describe;
exports.current = tap.current;
exports.run = tap.run;
exports.runUsing = tap.runUsing;
exports.waitForPendingSubTests = tap.waitForPendingSubTests;

exports.expect = require('./expect');

exports.fixture = function(name) {
  return path.resolve(__dirname, '..', 'fixtures', name);
};

exports.debugScript = require('./client').debugScript;

exports.debuglog = require('./debuglog');
exports.matchers = require('./matchers');

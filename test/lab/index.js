/* Lab: a laboratory for running automated tests */

exports.Promise = require('./promise');

var tap = require('./tap');
exports.it = tap.it;
exports.describe = tap.describe;
exports.current = tap.current;

exports.expect = require('./expect');

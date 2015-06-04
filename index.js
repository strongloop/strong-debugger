var path = require('path');
var bindings = require('bindings');
var dbg = bindings('debugger');
var debuglogEnabled = require('debug')('strong-debugger').enabled;

var workerPath = require.resolve('./backend/context.js');
var scriptRoot = path.dirname(workerPath) + path.sep;

/**
 * Start the background thread providing TCP server for DevTools protocol.
 * @param {Number} port
 * @param {Function<Error=,Number>} callback
 */
exports.start = function(port, cb) {
  dbg.start(port, scriptRoot, debuglogEnabled, cb);
};

/**
 * Stop the background thread.
 * @param {Function<Error=>} callback
 */
exports.stop = dbg.stop;

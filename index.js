var bindings = require('bindings');
var dbg = bindings('debugger');
var fs = require('fs');
var debuglogEnabled = require('debug')('strong-debugger').enabled;

var scriptPath = require.resolve('./src/worker.js');
var WORKER_SCRIPT = fs.readFileSync(scriptPath, 'utf-8');

/**
 * Start the background thread providing TCP server for DevTools protocol.
 * @param {Number} port
 * @param {Function<Error=,Number>} callback
 */
exports.start = function(port, cb) {
  dbg.start(port, WORKER_SCRIPT, debuglogEnabled, cb);
};

/**
 * Stop the background thread.
 * @param {Function<Error=>} callback
 */
exports.stop = dbg.stop;

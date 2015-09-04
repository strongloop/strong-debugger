'use strict';
var path = require('path');
var bindings = require('bindings');
var dbg = bindings('debugger');
var debuglogEnabled = require('debug')('strong-debugger').enabled;

var workerPath = require.resolve('./backend/context.js');
var scriptRoot = path.dirname(workerPath) + path.sep;

var startCallbacks = [];
var stopCallbacks = [];
var listeningOnPort = -1;

/**
 * Start the background thread providing TCP server for DevTools protocol.
 * @param {Number} port
 * @param {Function<Error=,Number>} callback The first argument is the error
 * (if any), the second argument is the actual port number where the debugger
 * is listening on.
 */
exports.start = function(port, cb) {
  if (!cb) throw new Error('You must supply a callback argument.');

  if (listeningOnPort > 0) {
    // The background thread is already running.
    return process.nextTick(function() {
      cb(null, listeningOnPort);
    });
  }

  startCallbacks.push(cb);
  if (startCallbacks.length > 1) return;

  try {
    dbg.start({
      port: port,
      scriptRoot: scriptRoot,
      debuglogEnabled: debuglogEnabled
    }, onStarted);
  } catch (err) {
    startCallbacks = [];
    throw err;
  }

  function onStarted(err, port) {
    if (!err && port !== undefined) listeningOnPort = port;

    var list = startCallbacks;
    startCallbacks = [];
    list.forEach(function(cb) {
      cb(err, port);
    });
  }
};

/**
 * Stop the background thread.
 * @param {Function<Error=>} callback
 */
exports.stop = function(cb) {
  if (listeningOnPort < 0) {
    // The background thread is not running.
    return process.nextTick(cb);
  }

  stopCallbacks.push(cb);
  if (stopCallbacks.length > 1) return;

  try {
    dbg.stop(onStopped);
  } catch (err) {
    stopCallbacks = [];
    throw err;
  }

  function onStopped(err) {
    listeningOnPort = -1;

    var list = stopCallbacks;
    stopCallbacks = [];
    list.forEach(function(cb) {
      cb(err);
    });
  }
};

/**
 * Get the status of the debugger thread (sync).
 * @return {Object} Status object with the following properties: running, port.
 */
exports.status = function() {
  var running = listeningOnPort > 0;
  return {
    running: running,
    port: running ? listeningOnPort : null
  };
};

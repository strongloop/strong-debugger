'use strict';
/*
Methods provided by the C++ bindings
  bindings.sendFrontEndMessage(string)
  bindings.closeFrontEndConnection()
  bindings.enableDebugger()
  bindings.disableDebugger()
  bindings.sendDebuggerCommand(string)
  bindings.log(string)

Methods exported by the script for consumption by C++ backend
  bindings.onConnection()
  bindings.onFrontEndCommand(string)
  bindings.onDebuggerEnabled()
  bindings.onDebuggerDisabled()
  bindings.onDebuggerMessage(string)
*/
/* global bindings:false */

var context = {
  agents: {},
  eventHandlers: {},

  _reqId: 0,
  _reqCallbacks: {},
  _enabled: false,
  _enableCallbacks: [],
  _afterEnableCallbacks: [],
};

/**
 * Log a message to process.stderr, but only when debuglogs are enabled for
 * strong-debugger module (e.g. DEBUG=strong-debugger).
 * The method accepts a list of values to log, the values are converted
 * to string or json and concatenated with a space.
 */
var debuglog = context.debuglog = function() {
  var msg = Array.prototype.map.call(arguments, inspect).join(' ');
  bindings.log(msg);

  function inspect(val) {
    return typeof val === 'object' ? JSON.stringify(val) :
      val === undefined ? 'undefined' :
      val.toString();
  }
};

bindings.onConnection = function() {
  // no-op
};

/**
 * Switch the V8 runtime to a debugger mode.
 * @param {function()} cb The callback to call after the debugger was enabled.
 */
context.enableDebugger = function(cb) {
  if (!context._enableCallbacks.length) {
    // call binding only if the operation is not already in progress
    bindings.enableDebugger();
  }

  context._enableCallbacks.push(cb);
};

/**
 * Defer execution of the provided function until the debugger is enabled.
 * @param {function()} cb The function to execute.
 */
context.waitForDebuggerEnabled = function(cb) {
  if (context._enabled) return cb();
  debuglog('Debugger is was enabled yet, scheduling the callback for later.');
  context._afterEnableCallbacks.push(cb);
};

bindings.onDebuggerEnabled = function() {
  context._enabled = true;
  if (!context._enableCallbacks.length) return;
  context._enableCallbacks.forEach(function(cb) { cb(); });
  context._enableCallbacks = [];

  context._afterEnableCallbacks.forEach(function(cb) { cb(); });
  context._afterEnableCallbacks = [];
};

/**
 * Turn off the V8 debugger.
 * @param {function()} cb The callback to call after the debugger was disabled.
 */
context.disableDebugger = function(cb) {
  if (context._disableCallbacks) {
    // disable operation is already in progress
    context._disableCallbacks.push(cb);
    return;
  }

  context._disableCallbacks = [cb];
  bindings.disableDebugger();
};

bindings.onDebuggerDisabled = function() {
  context._disabled = false;
  if (!context._disableCallbacks) return;
  context._disableCallbacks.forEach(function(cb) { cb(); });
  delete context._disableCallbacks;
};

/**
 * Send a request to the V8 debugger and get back a reply.
 * @param {String} cmd The command name.
 * @param {Object=} args Request (command) arguments.
 * @param {function(Error, Object, Object)} cb Callback to receive the result
 * of the request. The second callback argument contains the response body,
 * the third argument contains a lookup map to resolve references.
 */
context.sendDebuggerRequest = function(cmd, args, cb) {
  if (!context._enabled)
    return cb('Debugger is not enabled, call "Debugger.enable" first.');

  var id = ++context._reqId;

  // Note: we must not add args object if it was not sent.
  // E.g. resume (V8 request 'continue') does no work
  // correctly when args are empty instead of undefined
  if (args && !('maxStringLength' in args))
    args.maxStringLength = 10000;

  var req = {
    seq: id,
    type: 'request',
    command: cmd,
    arguments: args
  };

  context._reqCallbacks[id] = cb;
  debuglog('Send V8 debugger request', req);
  bindings.sendDebuggerCommand(JSON.stringify(req));
};

bindings.onDebuggerMessage = function(data) {
  debuglog('V8 debugger message received',
    data.slice(0, Math.min(255, data.length)),
    data.length > 255 ? '(...)' : '');

  var msg;
  try {
    msg = JSON.parse(data);
  } catch (err) {
    debuglog('Cannot parse V8 message: ' + err.message);
    return;
  }

  if (msg.type === 'event') {
    if (!msg.event) {
      debuglog('V8 debugger event does not provide event name (?!)', msg);
      return;
    }

    if (context.eventHandlers.hasOwnProperty(msg.event)) {
      var handler = context.eventHandlers[msg.event];
      handler(msg);
    } else {
      debuglog('Ignoring V8 debugger event', data);
    }
    return;
  }

  if (msg.type !== 'response') {
    debuglog('Ignoring V8 debugger message of unknown type.', msg);
    return;
  }

  // Ignore the response to "disconnect" request sent by disableDebugger()
  if (msg.command === 'disconnect') return;

  // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
  var id = msg.request_seq;
  // jscs:enable requireCamelCaseOrUpperCaseIdentifiers

  if (!id) {
    debuglog('Ignoring V8 debugger response without request_seq', data);
    return;
  }

  if (!context._reqCallbacks.hasOwnProperty(id)) {
    debuglog('No callback registered for request id', id);
    return;
  }
  var cb = context._reqCallbacks[id];

  if (!msg.success) {
    var err = new Error(msg.message);
    err.name = 'V8 Error';
    return cb(err);
  }

  var refsLookup = Object.create(null);
  (msg.refs || []).forEach(function(r) {
    refsLookup[r.handle] = r;
  });
  cb(null, msg.body, refsLookup);
};

context._STUBBED_RESPONSES = {
  'CSS.enable': {},
  'Console.enable': {},
  'DOM.enable': {},
  'DOMStorage.enable': {},
  'Database.enable': {},
  'IndexedDB.enable': {},
  'IndexedDB.requestDatabaseNames': { databaseNames: [] },
  'Inspector.enable': {},
  'Network.enable': {},
  'Page.canEmulate': { result: false },
  'Page.canScreencast': { result: false },
  'Page.enable': {},
  'Page.setShowViewportSizeOnResize': {},
  'Profiler.enable': {},
  // TODO detect the status of the debugged process
  // return result:true when --debug-brk
  'Runtime.isRunRequired': {},
  'Profiler.setSamplingInterval': {},
  'Runtime.enable': {},
  'Timeline.enable': {},
  'Worker.canInspectWorkers': { result: false },
  'Worker.setAutoconnectToWorkers': {},
};

bindings.onFrontEndCommand = function(line) {
  debuglog('Front-end command received', line);
  var command;
  try {
    command = JSON.parse(line);
  } catch (err) {
    return context.reportError(
      'Invalid message: ' + JSON.stringify(err.message));
  }

  // Custom Extension: send `{ "close": true }` to close the client connection
  if (!command.method && command.close) {
    return bindings.closeFrontEndConnection();
  }

  var requestId = command.id;
  context._handleFrontEndRequest(command, function(err, result) {
    var response = { id: requestId };
    if (err) {
      response.error = {
        message: err.message || err
      };
    } else {
      response.result = result || {};
    }
    context._sendFrontEndMessage(response);
  });
};

context._handleFrontEndRequest = function(request, cb) {
  if (typeof request.method !== 'string' || !request.method.length) {
    return cb('Invalid request method of type ' + typeof request.method);
  }

  // hasOwnProperty is needed to handle msg.method == '__proto__'
  if (context._STUBBED_RESPONSES.hasOwnProperty(request.method)) {
    return cb(null, context._STUBBED_RESPONSES[request.method]);
  }

  var m = request.method.match(/^([^.]+)\.([^.]+)$/);
  if (!m)
    return cb('Unknown method ' + JSON.stringify(request.method));
  var agentName = m[1];
  var methodName = m[2];

  if (!context.agents.hasOwnProperty(agentName))
    return cb('Unknown agent ' + JSON.stringify(request.method));
  var agent = context.agents[agentName];

  if (!agent.hasOwnProperty(methodName) || methodName[0] === '_')
    return cb('Unknown method ' + JSON.stringify(request.method));

  var method = agent[methodName];
  if (typeof method !== 'function')
    return cb('Unknown method ' + JSON.stringify(request.method));

  try {
    method.call(agent, request.params, cb);
  } catch (err) {
    debuglog('Unhandled error in ' + request.method + '.\n', err.stack || err);
    cb(err);
  }
};

context._sendFrontEndMessage = function(msg) {
  debuglog('Send front-end message', msg);
  bindings.sendFrontEndMessage(JSON.stringify(msg));
};

/**
 * Send an event to DevTools frontend.
 * @param {String} method Method name, e.g. `Debugger.paused`.
 * @param {Object} params Method parameters - a named map argument:value.
 */
context.sendFrontEndEvent = function(method, params) {
  context._sendFrontEndMessage({ method: method, params: params || {} });
};

/**
 * Report an error that is not associated with any particular request id.
 * @param {String|Error} err The error to report.
 */
context.reportError = function(err) {
  debuglog('Unhandled error', err.stack || err);
  context._sendFrontEndMessage({ error: { message: err.message || err } });
};

/**
 * Evaluate an expression in the global context of the debugged process
 * by calling V8 debugger's command "evaluate".
 */
context.evaluateGlobal = function(expression, cb) {
  context.sendDebuggerRequest(
    'evaluate',
    {
      expression: expression,
      global: true,
      maxStringLength: -1
    },
    function(err, result, refs) {
      if (err) return cb(err);
      if (result.type === 'string') {
        return cb(null, result.value);
      }
      cb('evaluateGlobal does not yet support response type ' + result.type);
    });
};

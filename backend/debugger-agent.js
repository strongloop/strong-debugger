'use strict';
/* global context:false, convert:false, NODE_MODULE_VERSION:false */

context.agents.Debugger = {
  _continueToLocationBreakpointId: null,

  enable: function(params, cb) {
    context.enableDebugger(function(err) {
      if (err) return cb(err);
      fetchLoadedScripts();
    });

    function fetchLoadedScripts() {
      context.sendDebuggerRequest(
        'scripts',
        {
          includeSource: false,
          types: 4
        },
        function(err, list) {
          if (err) return cb(err);

          // Send back the response first
          cb();

          // Send "scriptParsed" events after the response
          list.forEach(function(s) {
            var data = convert.v8ScriptDataToDevToolsData(s);
            context.sendFrontEndEvent('Debugger.scriptParsed', data);
          });
        });
    }
  },

  disable: function(params, cb) {
    context.disableDebugger(cb);
  },

  getScriptSource: function(params, cb) {
    context.sendDebuggerRequest(
      'scripts',
      {
        includeSource: true,
        types: 4,
        ids: [params.scriptId]
      },
      function(err, result) {
        if (err) return cb(err);
        // Some modules gets unloaded (?) after they are parsed,
        // e.g. node_modules/express/node_modules/methods/index.js
        // V8 request 'scripts' returns an empty result in such case
        var source = result.length > 0 ? result[0].source : undefined;
        source = source && convert.unwrapScript(source);
        cb(null, { scriptSource: source });
      });
  },

  pause: function(params, cb) {
    context.sendDebuggerRequest('suspend', {}, function(err, result) {
      if (err) return cb(err);
      // Send back the response first
      cb();
      // Send back "Debugger.paused" event afterwards
      context.notifyDebuggerPaused();
    });
  },

  resume: function(params, cb) {
    this._sendContinue(cb);
  },

  stepOver: function(params, cb) {
    this._sendContinue('next', cb);
  },

  stepInto: function(params, cb) {
    this._sendContinue('in', cb);
  },

  stepOut: function(params, cb) {
    this._sendContinue('out', cb);
  },

  _sendContinue: function(stepAction, cb) {
    if (cb === undefined && typeof stepAction === 'function') {
      cb = stepAction;
      stepAction = undefined;
    }

    var args = stepAction ? { stepaction: stepAction } : undefined;
    context.sendDebuggerRequest('continue', args, function(err, result) {
      cb(err);
      if (!err)
        context.sendFrontEndEvent('Debugger.resumed');
    });
  },

  continueToLocation: function(params, cb) {
    var self = this;
    context.sendDebuggerRequest(
      'setbreakpoint',
      {
        type: 'scriptId',
        target: convert.devToolsScriptIdToV8Id(params.location.scriptId),
        line: params.location.lineNumber,
        column: params.location.columnNumber
      },
      function(err, result) {
        if (err) return cb(err);
        self._continueToLocationBreakpointId = result.breakpoint;
        self._sendContinue(undefined, function(err) {
          cb(err);
        });
      });
  },

  setBreakpointByUrl: function(params, cb) {
    if (params.urlRegex !== undefined) {
      // DevTools protocol defines urlRegex parameter,
      // but the parameter is not used by the front-end.
      return cb(
        'Error: setBreakpointByUrl using urlRegex is not implemented.');
    }

    var target = convert.devToolsUrlToV8Name(params.url);
    var req = {
      type: 'script',
      target: target,
      line: params.lineNumber,
      column: params.columnNumber,
      condition: params.condition
    };

    context.sendDebuggerRequest('setbreakpoint', req, function(err, result) {
      if (err) return cb(err);

      // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
      var locations = result.actual_locations
        .map(convert.v8LocationToDevToolsLocation);
      // jscs:enable requireCamelCaseOrUpperCaseIdentifiers

      cb(null, {
        breakpointId: convert.v8BreakpointIdToDevToolsId(result.breakpoint),
        locations: locations
      });
    });
  },

  removeBreakpoint: function(params, cb) {
    this._clearBreakpoint(
      convert.devToolsBreakpointIdToV8Id(params.breakpointId),
      function(err, result) {
        cb(err); // ignore the result, send back an empty response
      });
  },

  _clearBreakpoint: function(id, cb) {
    context.sendDebuggerRequest(
      'clearbreakpoint',
      { breakpoint: id },
      cb);
  },

  setBreakpointsActive: function(params, cb) {
    context.sendDebuggerRequest(
      'listbreakpoints',
      {},
      function(err, result) {
        if (err) return cb(err);

        var bps = result.breakpoints;
        next();

        function next(err, res) {
          if (err) return cb(err);
          if (!bps.length) return cb();
          var bp = bps.shift();
          var req = { breakpoint: bp.number, enabled: params.active };
          context.sendDebuggerRequest('changebreakpoint', req, next);
        }
      });
  },

  setAsyncCallStackDepth: function(params, cb) {
    cb();
  },

  setPauseOnExceptions: function(params, cb) {
    context.waitForDebuggerEnabled(function() {
      var args = [
        { type: 'all', enabled: params.state === 'all' },
        { type: 'uncaught', enabled: params.state === 'uncaught' }
      ];
      next();

      function next(err, res) {
        if (err) return cb(err);
        if (!args.length) return cb(); // ignore any results
        var req = args.shift();
        context.sendDebuggerRequest('setexceptionbreak', req, next);
      }
    });
  },

  evaluateOnCallFrame: function(params, cb) {
    context.sendDebuggerRequest(
      'evaluate',
      {
        expression: params.expression,
        frame: Number(params.callFrameId)
      },
      function(err, result) {
        // Errors from V8 are actually just messages,
        // so we need to fill them out a bit.
        if (err) err = convert.v8ErrorToDevToolsError(err);

        cb(null, {
          result: err || convert.v8ResultToDevToolsResult(result),
          wasThrown: !!err
          // TODO(bajtos) Fill in exceptionDetails on error
        });
      }
    );
  },

  getFunctionDetails: function(params, cb) {
    var handle = Number(params.functionId);
    context.sendDebuggerRequest(
      'lookup',
      {
        handles: [handle],
        includeSource: false
      },
      function(err, responseBody) {
        if (err) return cb(err);
        var data = responseBody[handle] || responseBody;
        var result = convert.v8FunctionLookupToFunctionDetails(data);
        cb(null, result);
      }
    );
  },

  setVariableValue: function(params, cb) {
    var value = convert.devToolsValueToV8Value(params.newValue);

    context.sendDebuggerRequest(
      'setVariableValue',
      {
        name: params.variableName,
        scope: {
          number: Number(params.scopeNumber),
          frameNumber: Number(params.callFrameId)
        },
        newValue: value
      },
      function(err, result) {
        cb(err); // ignore the result
      }
    );
  },

  setOverlayMessage: function(params, cb) {
    if (params && params.message)
      context.debuglog('SET OVERLAY MESSAGE', params.message);
    else
      context.debuglog('CLEAR OVERLAY MESSAGE');
    cb();
  },

  skipStackFrames: function(params, cb) {
    cb();
  },
};

context.eventHandlers.exception =
context.eventHandlers.break = function(event) {
  var tempBpId = context.agents.Debugger._continueToLocationBreakpointId;
  if (!tempBpId) {
    context.notifyDebuggerPaused(event);
    return;
  }

  context.agents.Debugger._clearBreakpoint(tempBpId, function(err, result) {
    if (err) {
      context.debuglog('Cannot clear temporary breakpoint.', err.stack || err);
    } else {
      context.agents.Debugger._continueToLocationBreakpointId = null;
    }
    context.notifyDebuggerPaused(event);
  });
};

context.eventHandlers.afterCompile = function(event) {
  var data = convert.v8ScriptDataToDevToolsData(event.body.script);
  context.sendFrontEndEvent('Debugger.scriptParsed', data);
};

// Workaround for Node v0.12 reporting compileError instead of afterCompile
if (NODE_MODULE_VERSION === 14) {
  context.eventHandlers.compileError = function(event) {
    if (event.body.script && event.body.script.hasOwnProperty('id')) {
      context.eventHandlers.afterCompile(event);
    }
  };
}

context.fetchCallFrames = function(cb) {
  context.sendDebuggerRequest(
    'backtrace',
    {
      inlineRefs: true,
      fromFrame: 0,
      toFrame: 50
    },
    function(err, result, refs) {
      if (err) return cb(err);

      var frames = (result.frames || []).map(function(f) {
        return convert.v8FrameToDevToolsFrame(f, refs);
      });
      cb(null, frames);
    });
};

context.notifyDebuggerPaused = function(event) {
  var exception = event && event.body && event.body.exception;
  context.fetchCallFrames(function(err, frames) {
    if (err) return context.reportError(err);

    context.sendFrontEndEvent('Debugger.paused', {
      callFrames: frames,
      reason: exception ? 'exception' : 'other',
      data: exception ? convert.v8RefToDevToolsObject(exception) : null,
      // TODO: hitBreakpoints: event.hitBreakpoints - needs a test
    });
  });
};

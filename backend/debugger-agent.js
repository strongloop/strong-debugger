/* global context:false, convert:false */

context.agents.Debugger = {
  enable: function(params, cb) {
    context.enableDebugger(cb);
  },

  disable: function(params, cb) {
    context.disableDebugger(cb);
  },

  setAsyncCallStackDepth: function(params, cb) {
    cb();
  },

  setPauseOnExceptions: function(params, cb) {
    cb();
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

context.eventHandlers.break = function(event) {
  context.debuglog('on break', event);
  context.fetchCallFrames(function(err, frames) {
    if (err) return context.reportError(err);

    context.sendFrontEndEvent('Debugger.paused', {
      callFrames: frames,
      // TODO: support reason:'expection' with data:exception ref
      reason: 'other',
      data: null, // TODO: include event.exception if set
      // TODO: hitBreakpoints: event.hitBreakpoints - needs a test
    });
  });
};

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

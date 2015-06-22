'use strict';
/* global context:false, convert:false */

context.agents.Runtime = {
  evaluate: function(params, cb) {
    context.sendDebuggerRequest(
      'evaluate',
      {
        expression: params.expression,
        global: true
      },
      function(err, result) {
        // Errors from V8 are actually just messages,
        // so we need to fill them out a bit.
        if (err) err = convert.v8ErrorToDevToolsError(err);

        cb(null, {
          result: err || convert.v8ResultToDevToolsResult(result),
          wasThrown: !!err,
          // TODO(bajtos) Fill in exceptionDetails on error
        });
      }
    );
  },
};

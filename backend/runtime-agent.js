'use strict';
/* global context:false, convert:false */

var SCOPE_ID_MATCHER = /^scope:(\d+):(\d+)$/;

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

  getProperties: function(params, cb) {
    // Front-end sends the following two requests for Object properties:
    // "params": {"objectId":"78",
    //    "ownProperties":false,"accessorPropertiesOnly":true}
    // "params":{"objectId":"78",
    //    "ownProperties":true,"accessorPropertiesOnly":false}
    //
    // Or the following request for Scope properties:
    // "params":{"objectId":"scope:0:2",
    //    "ownProperties":false,"accessorPropertiesOnly":false}
    //
    // See getProperties() and getInjectedProperties() in
    //   http://src.chromium.org/blink/branches/chromium/1625/Source/core/
    //    inspector/InjectedScriptSource.js
    // for more details.
    var options = {
      ownProperties: params.ownProperties,
      accessorPropertiesOnly: params.accessorPropertiesOnly
    };
    var objectId = params.objectId;
    if (SCOPE_ID_MATCHER.test(params.objectId)) {
      this._getPropertiesOfScopeId(objectId, options, cb);
    } else {
      this._getPropertiesOfObjectId(objectId, options, cb);
    }
  },

  _getPropertiesOfScopeId: function(scopeId, options, cb) {
    var scopeIdMatch = SCOPE_ID_MATCHER.exec(scopeId);
    if (!scopeIdMatch) {
      return cb(new Error('Invalid scope id "' + scopeId + '"'));
    }

    context.sendDebuggerRequest(
      'scope',
      {
        number: Number(scopeIdMatch[2]),
        frameNumber: Number(scopeIdMatch[1])
      },
      function(err, result) {
        if (err) return cb(err);
        var objectId = result.object.ref;
        context.agents.Runtime._getPropertiesOfObjectId(objectId, options, cb);
      });
  },

  _getPropertiesOfObjectId: function(objectId, options, cb) {
    var handle = parseInt(objectId, 10);
    var request = { handles: [handle], includeSource: false };
    context.sendDebuggerRequest(
      'lookup',
      request,
      function(err, result, refs) {
        if (err) return cb(err);

        var obj = result[handle];
        var props = convert.v8ObjectToDevToolsProperties(obj, refs, options);

        cb(null, { result: props });
      });
  },
};

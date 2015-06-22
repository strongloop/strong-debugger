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

  callFunctionOn: function(params, cb) {
    var self = this;
    var returnByValue = params.returnByValue;

    this._createEvaluateParamsForFnCall(
      params.objectId,
      params.functionDeclaration,
      params.arguments,
      function callFunctionWithParams(err, evaluateParams) {
        if (err) return cb(err);

        context.sendDebuggerRequest(
          'evaluate',
          evaluateParams,
          function(err, result) {
            self._handleCallFnOnObjectResponse(
              err, result, returnByValue, cb);
          });
      });
  },

  _createEvaluateParamsForFnCall: function(selfId, declaration, args, cb) {
    args = args || [];

    try {
      var argsData = args.map(this._getFunctionCallArgsData, this);
      var params = this._buildEvaluateParamsFromArgsData(
        selfId,
        declaration,
        argsData);
      cb(null, params);
    } catch (err) {
      cb(err);
    }
  },

  _buildEvaluateParamsFromArgsData: function(selfId, declaration, argsData) {
    argsData = [this._getSelfArgData(selfId)].concat(argsData);

    var argNames = argsData.map(function(a) { return a.code; });
    var argContexts = argsData
      .map(function(a) { return a.context; })
      // filter out empty contexts (value types are context-less)
      .filter(function(c) { return !!c; });

    var expression = '(' + declaration + ').call(' + argNames.join(', ') + ')';

    return {
      expression: expression,
      global: true,
      // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
      additional_context: argContexts
      // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
    };
  },

  _getSelfArgData: function(selfId) {
    var SELF_CONTEXT_NAME = '__strong_debugger_self__';
    return {
      code: SELF_CONTEXT_NAME,
      context: {
        name: SELF_CONTEXT_NAME,
        handle: Number(selfId)
      }
    };
  },

  _getFunctionCallArgsData: function(arg, index) {
    var uniqueId = '__strong_debugger_arg' + index;
    switch (arg.type) {
      case undefined:
      case 'string':
        return { code: JSON.stringify(arg.value.toString()) };
      case 'number':
        return { code: arg.value };
      case 'null':
      case 'undefined':
        return { code: arg.type };
      case 'object':
      case 'function':
        return {
          code: uniqueId,
          context: {
            name: uniqueId,
            handle: Number(arg.objectId)
          }
        };
      default:
        throw new Error('Function arguments of type "' +
          arg.type + '" are not supported.');
    }
  },

  _handleCallFnOnObjectResponse: function(err, response, returnByValue, cb) {
    if (err) {
      return cb(null, {
        err: err,
        wasThrown: true
      });
    }

    var value = Object.create(null);
    if (returnByValue && response.properties) {
      for (var i = 0; i < response.properties.length; i++) {
        value[response.properties[i].name] = true;
      }
    }

    cb(null, {
      result: { value: value },
      wasThrown: false
    });
  },
};

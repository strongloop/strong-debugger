'use strict';

// Based on NodeInspector's lib/convert.js
var convert = {
  v8FrameToDevToolsFrame: function(frame, refs) {
    var scopeChain = frame.scopes.map(function(scope) {
      return {
        object: {
          type: 'object',
          objectId: 'scope:' + frame.index + ':' + scope.index,
          className: 'Object',
          description: 'Object'
        },
        type: convert.v8ScopeTypeToString(scope.type)
      };
    });

    return {
      callFrameId: frame.index.toString(),
      functionName: frame.func.inferredName || frame.func.name,
      location: {
        scriptId: convert.v8ScriptIdToDevToolsId(frame.func.scriptId),
        lineNumber: frame.line,
        columnNumber: frame.column
      },
      scopeChain: scopeChain,
      'this': convert.v8RefToDevToolsObject(frame.receiver)
    };
  },

  v8ScopeTypeToString: function(v8ScopeType) {
    switch (v8ScopeType) {
      case 0:
        return 'global';
      case 1:
        return 'local';
      case 2:
        return 'with';
      case 3:
        return 'closure';
      case 4:
        return 'catch';
      case 5:
        return 'block';
      case 6:
        return 'script';
      default:
        return 'unknown';
    }
  },

  v8ScriptIdToDevToolsId: function(scriptId) {
    return String(scriptId);
  },

  devToolsScriptIdToV8Id: function(scriptId) {
    return Number(scriptId);
  },

  v8BreakpointIdToDevToolsId: function(bpId) {
    return String(bpId);
  },

  devToolsBreakpointIdToV8Id: function(bpId) {
    return Number(bpId);
  },

  v8ScriptDataToDevToolsData: function(v8data) {
    return {
      scriptId: convert.v8ScriptIdToDevToolsId(v8data.id),
      url: convert.v8NameToDevToolsUrl(v8data.name),
      startLine: v8data.lineOffset,
      startColumn: v8data.columnOffset

      /* Properties not set:
       endLine: undefined,
       endColumn: undefined,
       isContentScript: undefined,
       hasSourceURL: undefined,
       */
    };
  },

  v8RefToDevToolsObject: function(ref) {
    var desc = '';
    var type = ref.type;
    var subtype, size, name, objectId;

    switch (type) {
      case 'object':
        name = /#<(\w+)>/.exec(ref.text);
        if (name && name.length > 1) {
          desc = name[1];
          if (desc === 'Array' || desc === 'Buffer') {
            size = ref.properties.filter(function(p) {
              return /^\d+$/.test(p.name);
            }).length;
            desc += '[' + size + ']';
            subtype = 'array';
          }
        } else if (ref.className === 'Date') {
          desc = ref.value || ref.value === 0 ?
            new Date(ref.value).toString() :
            'Invalid Date';
          subtype = 'date';
        } else {
          desc = ref.className || 'Object';
        }
        break;
      case 'regexp':
        type = 'object';
        subtype = 'regexp';
        desc = ref.text || '';
        /*
          We need to collect RegExp flags and append they to description,
          or open issue in NodeJS same as 'RegExp text serialized without flags'
        */
        break;
      case 'function':
        desc = ref.text || 'function()';
        break;
      case 'error':
        type = 'object';
        desc = ref.text || 'Error';
        break;
      default:
        desc = ref.text || '';
        break;
    }
    if (desc.length > 100) {
      desc = desc.substring(0, 100) + '\u2026';
    }

    objectId = ref.handle;
    if (objectId === undefined)
      objectId = ref.ref;

    return {
      type: type,
      subtype: subtype,
      objectId: String(objectId),
      className: ref.className,
      description: desc
    };
  },

  v8ErrorToDevToolsError: function(err) {
    var message = err.message || err.toString();
    var name = err.name || 'Error';
    // Try to match the error name in 'ErrorName: error message'
    var match = /^([^:]+):/.exec(message);
    if (match) name = match[1];

    return {
      type: 'object',
      objectId: 'ERROR',
      className: name,
      description: message
    };
  },

  v8ResultToDevToolsResult: function(result) {
    var subtype;

    if (['object', 'function', 'regexp', 'error'].indexOf(result.type) > -1) {
      return convert.v8RefToDevToolsObject(result);
    }

    if (result.type === 'null') {
      // workaround for the problem with front-end's setVariableValue
      // implementation not preserving null type
      result.value = null;
      subtype = 'null';
    }

    return {
      type: result.type,
      subtype: subtype,
      value: result.value,
      description: String(result.value)
    };
  },

  devToolsValueToV8Value: function(value) {
    if (value.value === undefined && value.objectId === undefined)
      return { type: 'undefined' };
    if (value.objectId)
      return { handle: Number(value.objectId) };
    return value;
  },

  v8ObjectToDevToolsProperties: function(obj, refs, options) {
    var proto = obj.protoObject;
    var props = obj.properties || [];
    var ownProperties = options.ownProperties;
    var accessorPropertiesOnly = options.accessorPropertiesOnly;

    props = props.map(function(prop) {
      var ref = refs[prop.ref];
      return {
          name: String(prop.name),
          writable: !(prop.attributes & 1 << 0),
          enumerable: !(prop.attributes & 1 << 1),
          configurable: !(prop.attributes & 1 << 2),
          value: convert.v8ResultToDevToolsResult(ref),
          isOwn: true // lookup always returns own properties only
        };
    });

    // TODO(bajtos) In the recent V8 versions, the __proto__ property
    // should be returned only when
    //   ownProperties === false && accessorPropertiesOnly === true
    // because it's defined via getter/setter functions

    var shouldAddProto = ownProperties && proto &&
      !props.some(function(p) { return p.name === '__proto__'; });

    if (shouldAddProto) {
      proto = refs[proto.ref];
      if (proto.type !== 'undefined') {
        props.push({
          name: '__proto__',
          value: convert.v8RefToDevToolsObject(proto),
          writable: true,
          configurable: true,
          enumerable: false,
          isOwn: true
        });
      }
    }

    props = props.filter(function(prop) {
      // Node.js does not return get/set property descriptors now (v0.11.11),
      //  therefore we can't fully implement 'accessorPropertiesOnly'.
      // See https://github.com/joyent/node/issues/7139
      var isAccessorProperty = ('get' in prop || 'set' in prop);
      return accessorPropertiesOnly ?
        isAccessorProperty :
        !isAccessorProperty;
    });

    return props;
  },

  // Conversions between v8 file paths and node-inspector urls
  // Kind      Path            Url
  // UNIX      /dir/app.js     file:///dir/app.js
  // Windows   c:\dir\app.js   file:///C:/dir/app.js
  // UNC       \\SHARE\app.js  file://SHARE/app.js
  v8NameToDevToolsUrl: function(v8name) {
    if (!v8name || v8name === 'repl') {
      // Call to `evaluate` from user-land creates a new script with
      // undefined URL. REPL has null main script file and calls
      // `evaluate` with `repl` as the file name.
      //
      // When we send an empty string as URL, front-end opens the source
      // as VM-only script (named "[VM] {script-id}").
      //
      // The empty name of the main script file is displayed as "(program)".
      return '';
    }

    if (/^\//.test(v8name)) {
      return 'file://' + v8name;
    } else if (/^[a-zA-Z]:\\/.test(v8name)) {
      return 'file:///' + v8name.replace(/\\/g, '/');
    } else if (/^\\\\/.test(v8name)) {
      return 'file://' + v8name.substring(2).replace(/\\/g, '/');
    }

    return v8name;
  },

  devToolsUrlToV8Name: function(url) {
    var path = url.replace(/^file:\/\//, '');
    if (/^\/[a-zA-Z]:\//.test(path))
      return path.substring(1).replace(/\//g, '\\'); // Windows disk path
    if (/^\//.test(path))
      return path; // UNIX-style
    if (/^file:\/\//.test(url))
      return '\\\\' + path.replace(/\//g, '\\'); // Windows UNC path

    return url;
  },

  v8LocationToDevToolsLocation: function(v8loc) {
    // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
    return {
      scriptId: convert.v8ScriptIdToDevToolsId(v8loc.script_id),
      lineNumber: v8loc.line,
      columnNumber: v8loc.column
    };
  },

  unwrapScript: function(sourceCode) {
    // See NativeModule.wrapper in node's src/node.js
    var PREFIX =
      '(function (exports, require, module, __filename, __dirname) { ';
    var POSTFIX = '\n});';

    if (!startsWith(sourceCode, PREFIX)) return sourceCode;
    if (!endsWith(sourceCode, POSTFIX)) return sourceCode;
    return sourceCode.slice(PREFIX.length, -POSTFIX.length);

    function startsWith(str, head) {
      return str.length >= head.length &&
             head === str.slice(0, head.length);
    }

    function endsWith(str, tail) {
      return str.length >= tail.length &&
             tail === str.slice(-tail.length, str.length);
    }
  },

  v8FunctionLookupToFunctionDetails: function(handleData) {
    return {
      details: {
        location: {
          scriptId: String(handleData.scriptId),
          lineNumber: handleData.line,
          columnNumber: handleData.column
        },
        functionName: handleData.name || handleData.inferredName,

        // There is a list of scope ids in responseBody.scopes, but not scope
        // details :(
        // We need to issue `scopes` request to fetch scopes details,
        // but we don't have frame number where the function was defined.
        // Let's leave the scopeChain empty for now.
        scopeChain: []
      }
    };
  },
};

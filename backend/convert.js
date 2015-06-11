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
};

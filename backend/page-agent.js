'use strict';
/* global context:false, convert:false */

context.agents.Page = {
  enable: function(params, cb) {
    cb();
  },

  getResourceTree: function(params, cb) {
    context.waitForDebuggerEnabled(function() {
      context.evaluateGlobal(
        'process.mainModule ? process.mainModule.filename : process.argv[1]',
        function(err, mainScript) {
          if (err) return cb(err);
          var mainUrl = convert.v8NameToDevToolsUrl(mainScript);
          cb(null, { frameTree: buildFrameTree(mainUrl) });
        });
    });

    function buildFrameTree(mainUrl) {
      return {
        frame: {
          id: 'nodejs-toplevel-frame',
          url: mainUrl,
          mimeType: 'text/javascript',
          securityOrigin: mainUrl,

          // Front-end keeps a history of local modifications based
          // on loaderId. Ideally we should return such id that it remains
          // same as long as the the debugger process has the same content
          // of scripts and that changes when a new content is loaded.
          //
          // To keep things easy, we are returning an unique value for now.
          // This means that every reload of node-inspector page discards
          // the history of live-edit changes.
          //
          // Perhaps we can use PID as loaderId instead?
          loaderId: createUniqueLoaderId(),
        },
        resources: []
      };
    }

    function createUniqueLoaderId() {
      var randomPart = String(Math.random()).slice(2);
      return Date.now() + '-' + randomPart;
    }
  },

  getResourceContent: function(params, cb) {
    var scriptName = convert.devToolsUrlToV8Name(params.url);

    if (scriptName === '') {
      // When running REPL, main application file is null
      // and node inspector returns an empty string to the front-end.
      // However, front-end still asks for resource content.
      // Let's return a descriptive comment then.
      var content = '// There is no main module loaded in node.\n' +
        '// This is expected when you are debugging ' +
        'node\'s interactive REPL console.';

      return cb(null, { content: content });
    }

    context.sendDebuggerRequest(
      'scripts',
      {
        includeSource: true,
        types: 4,
        filter: scriptName
      },
      function(err, result) {
        if (err) return cb(err);
        // Some modules gets unloaded (?) after they are parsed,
        // e.g. node_modules/express/node_modules/methods/index.js
        // V8 request 'scripts' returns an empty result in such case
        var source = result.length > 0 ? result[0].source : undefined;
        source = source && convert.unwrapScript(source);
        cb(null, { content: source });
      });
  },

  canEmulate: function(params, cb) {
    cb(null, { result: false });
  },

  canScreencast: function(params, cb) {
    cb(null, { result: false });
  },

  setShowViewportSizeOnResize: function(params, cb) {
    cb(null, {});
  },
};

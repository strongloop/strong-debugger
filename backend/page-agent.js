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

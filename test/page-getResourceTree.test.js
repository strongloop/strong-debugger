'use strict';
var l = require('./lab');
var m = l.matchers;

var A_LONG_RUNNING_SCRIPT = 'http-server.js';

l.runUsing(l.debugScript(l.fixture(A_LONG_RUNNING_SCRIPT)), function(client) {
  return client.verifyScenario(function(s) {
    s.sendRequest({ id: 1, method: 'Page.getResourceTree' });

    // getResourceTree requires the debugger to be eventually enabled
    // before it can send back the response
    s.enableDebugger();

    s.expectMessage({ id: 1, result: {
      frameTree: {
        frame: {
          loaderId: m.isString(),
          id: m.isString(),
          url: /^file:\/\/.*test[\\\/]fixtures[\\\/]http-server\.js$/,
          mimeType: 'text/javascript',
          securityOrigin: m.isString(),
        },
        resources: [],
      }
    }});
  });
});

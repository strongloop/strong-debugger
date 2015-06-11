'use strict';
var fs = require('fs');
var l = require('./lab');
var m = l.matchers;

var A_LONG_RUNNING_SCRIPT = l.fixture('http-server.js');
var EXPECTED_CONTENT = fs.readFileSync(A_LONG_RUNNING_SCRIPT, 'utf-8');

l.runUsing(l.debugScript(A_LONG_RUNNING_SCRIPT), function(client) {
  return client.verifyScenario(function(s) {
    s.sendRequest({ id: 1, method: 'Page.getResourceTree' });

    // getResourceTree requires the debugger to be eventually enabled
    // before it can send back the response
    s.enableDebugger();

    s.expectMessage({ id: 1, result: {
      frameTree: m.containsProperties({
        frame: m.containsProperties({
          id: s.saveRef('frameId', m.isString()),
          url: s.saveRef('frameUrl', m.isString()),
        }),
      })
    }});

    s.sendRequest({ method: 'Page.getResourceContent', params: {
      frameId: s.ref('frameId'),
      url: s.ref('frameUrl')
    }});

    s.expectResponse({
      content: EXPECTED_CONTENT
    });
  });
});

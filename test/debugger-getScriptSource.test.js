'use strict';
var fs = require('fs');
var l = require('./lab');
var m = l.matchers;

var SCRIPT_UNDER_TEST = l.fixture('require-http-server.js');
var EXPECTED_CONTENT = fs.readFileSync(l.fixture('http-server.js'), 'utf-8');

l.runUsing(l.debugScript(SCRIPT_UNDER_TEST), function(client) {
  return client.verifyScenario(function(s) {
    s.enableDebugger();
    s.sendInput('load\n');

    s.expectEvent('Debugger.scriptParsed', {
      scriptId: s.saveRef('scriptId', m.isString()),
      url: /^file:.*test[\\\/]fixtures[\\\/]http-server.js$/,
      startLine: 0,
      startColumn: 0,
    });

    s.sendRequest({ method: 'Debugger.getScriptSource', params: {
      scriptId: s.ref('scriptId')
    }});

    s.expectResponse({
      scriptSource: EXPECTED_CONTENT
    });
  });
});

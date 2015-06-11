'use strict';
var l = require('./lab');
var m = require('./lab/matchers');

l.runUsing(l.debugScript(l.fixture('require-http-server.js')),
function(client) {
  return client.verifyScenario(function(s) {
    s.enableDebugger();
    s.sendInput('load\n');
    s.expectEvent('Debugger.scriptParsed', {
      scriptId: m.isString(),
      url: /^file:.*test[\\\/]fixtures[\\\/]http-server.js$/,
      startLine: 0,
      startColumn: 0,
    });
  });
});

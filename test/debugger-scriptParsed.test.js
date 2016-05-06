// Copyright IBM Corp. 2015. All Rights Reserved.
// Node module: strong-debugger
// US Government Users Restricted Rights - Use, duplication or disclosure
// restricted by GSA ADP Schedule Contract with IBM Corp.

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

'use strict';
var l = require('./lab');

var A_LONG_RUNNING_SCRIPT = 'http-server.js';
var reqId = 0;

l.runUsing(l.debugScript(l.fixture(A_LONG_RUNNING_SCRIPT)), function(client) {
  verifyResponseForRequest('Console.enable', {});
  verifyResponseForRequest('Network.enable', {});
  verifyResponseForRequest('Page.enable', {});
  verifyResponseForRequest('Debugger.setAsyncCallStackDepth', {});
  verifyResponseForRequest('Debugger.setOverlayMessage', { message: 'x' }, {});
  verifyResponseForRequest('Debugger.skipStackFrames', {});
  verifyResponseForRequest('Runtime.enable', {});
  verifyResponseForRequest('DOM.enable', {});
  verifyResponseForRequest('CSS.enable', {});
  verifyResponseForRequest('Timeline.enable', {});
  verifyResponseForRequest('Database.enable', {});
  verifyResponseForRequest('DOMStorage.enable', {});
  verifyResponseForRequest('Profiler.enable', {});
  verifyResponseForRequest('Profiler.setSamplingInterval', {});
  verifyResponseForRequest('IndexedDB.enable', {});
  verifyResponseForRequest('Worker.setAutoconnectToWorkers', {});
  verifyResponseForRequest('Inspector.enable', {});
  verifyResponseForRequest('Page.setShowViewportSizeOnResize', {});
  verifyResponseForRequest('Runtime.isRunRequired', {});

  verifyResponseForRequest('Page.canScreencast', { result: false });
  verifyResponseForRequest('Page.canEmulate', { result: false });
  verifyResponseForRequest('Worker.canInspectWorkers', { result: false });

  verifyResponseForRequest('IndexedDB.requestDatabaseNames', {
    databaseNames: []
  });

  return l.waitForPendingSubTests();

  function verifyResponseForRequest(method, params, expectedResult) {
    if (arguments.length === 2) {
      expectedResult = params;
      params = undefined;
    }
    l.describe(method, function() {
      ++reqId;
      return client.verifyScenario(function(s) {
        s.sendRequest({ id: reqId, method: method, params: params });
        s.expectMessage({ id: reqId, result: expectedResult });
      });
    });
  }
});

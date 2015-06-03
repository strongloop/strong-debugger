var l = require('./lab');

var A_LONG_RUNNING_SCRIPT = 'http-server.js';
var reqId = 0;

l.runUsing(l.debugScript(l.fixture(A_LONG_RUNNING_SCRIPT)), function(client) {
  verifyResponseForRequest('Console.enable', {});
  verifyResponseForRequest('Network.enable', {});
  verifyResponseForRequest('Page.enable', {});
  verifyResponseForRequest('Debugger.setPauseOnExceptions', {});
  verifyResponseForRequest('Debugger.setAsyncCallStackDepth', {});
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

  return l.waitForPendingSubTests();

  function verifyResponseForRequest(method, expectedResult) {
    l.describe(method, function() {
      ++reqId;
      return client.verifyScenario(function(s) {
        s.sendRequest({ id: reqId, method: method });
        s.expectMessage({ id: reqId, result: expectedResult });
      });
    });
  }
});

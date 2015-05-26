
var tap = require('tap');

/* A helper for accessing the current test */
exports.current = tap.current.bind(tap);

/* Modify TAP's Mocha API to support promises */
exports.it = wrapWithPromiseHandler(tap.mocha.it);
exports.describe = wrapWithPromiseHandler(tap.mocha.describe);

function wrapWithPromiseHandler(method) {
  return function(name, testFn) {
    method(name, function runTestAndHandlePromiseResult(done) {
      var result = testFn.apply(this, arguments);
      if (result && typeof result.then === 'function') {
        result.then(
          // don't pass through any non-error fulfillment values
          function() { done(); },
          // pass through any errors
          done);
      } else if (!testFn.length) {
        // testFn is synchronous
        done();
      }
    });
  };
}

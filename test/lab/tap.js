'use strict';
var tap = require('tap');
var Promise = require('./promise');

/* A helper for accessing the current test */
exports.current = tap.current.bind(tap);

/* A helper for running a single top-level test function
 * that returns a promise */
exports.run = function(testFn) {
  Promise.resolve()
    // wrap testFn in a promise to convert thrown errors into rejections
    .then(function() { return testFn(); })
    .then(
      function() { tap.current().end(); },
      function(err) { tap.current().threw(err);
 });
};

/* A helper combining run + Promise.using */
exports.runUsing = function() {
  var args = arguments;
  return this.run(function() {
    return Promise.using.apply(Promise, args);
  });
};

exports.waitForPendingSubTests = function() {
  return new Promise(function(resolve, reject) {
    tap.current().test(function(tt) {
      tt.end();
      resolve();
    });
  });
};

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

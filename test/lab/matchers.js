var inspect = require('util').inspect;
var tap = require('tap');

exports.containsProperties = function(expected) {
  return {
    expectedValue: expected,
    test: function(actual) {
      return Object.keys(expected).every(function(k) {
        return k in actual && test(actual[k], expected[k]);
      });
    },
    inspect: function() {
      return '(contains properties ' + inspect(expected) + ')';
    },
  };
};

exports.deepEquals = function(expected) {
  // non-primitive values are compared using deep equal by default
  return expected;
};

tap.Test.prototype.addAssert('assertThat', 2,
function(value, matcher, message, extra) {
  extra.found = value;
  extra.matcher = inspect(matcher);
  extra.wanted = getExpectedValue(matcher);
  return this.assert(
    test(value, matcher),
    message || inspect(matcher) + ' should match ' + inspect(value),
    extra);
});

tap.Test.prototype.addAssert('assertNotThat', 2,
function(value, matcher, message, extra) {
  extra.found = value;
  extra.matcher = inspect(matcher);
  extra.doNotWant = getExpectedValue(matcher);
  return this.assert(
    !test(value, matcher),
    message || inspect(matcher) + ' should not match ' + inspect(value),
    extra);
});

function test(actual, expected) {
  if (expected.test)
    return expected.test(actual);
  if (typeof expected !== 'object')
    return expected === actual;
  for (var k in expected) {
    if (!test(actual[k], expected[k]))
      return false;
  }
  if (Object.keys(expected).length !== Object.keys(actual).length)
    return false;
  return true;
}

function getExpectedValue(expected) {
  if (expected.expectedValue)
    return getExpectedValue(expected.expectedValue);
  if (typeof expected !== 'object')
    return expected;

  var res = new (expected.constructor)();
  for (var k in expected) {
    res[k] = getExpectedValue(expected[k]);
  }
  return res;
}

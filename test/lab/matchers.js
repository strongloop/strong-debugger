'use strict';
var inspect = require('util').inspect;
var tap = require('tap');

exports.hasValueOfType = function(type) {
  return {
    expectedValue: '(any ' + type + ' value)',
    test: function(actual) {
      return actual && typeof actual === type;
    },
    inspect: function() {
      return '(has any ' + type + ' value)';
    },
  };
};

exports.isObject = function() {
  return exports.hasValueOfType('object');
};

exports.isNumber = function() {
  return exports.hasValueOfType('number');
};

exports.isString = function() {
  return exports.hasValueOfType('string');
};

exports.containsProperties = function(expected) {
  return {
    expectedValue: expected,
    test: function(actual) {
      if (!actual || typeof actual !== 'object')
        return false;
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

exports.startsWith = function(expected) {
  return {
    expectedValue: expected,
    test: function(actual) {
      if (!actual.length) return false;
      if (expected.length > actual.length) return false;
      return Object.keys(expected).every(function(ix) {
        return test(actual[ix], expected[ix]);
      });
    },
    inspect: function() {
      return '(array starting with items ' + inspect(expected) + ')';
    },
  };
};

exports.hasMember = function(expected) {
  return {
    expectedValue: [expected],
    test: function(actual) {
      if (typeof actual !== 'object' || actual === null) return false;
      return Object.keys(actual).some(function(ix) {
        return test(actual[ix], expected);
      });
    },
    inspect: function() {
      return '(array containing item ' + inspect(expected) + ')';
    },
  };
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
  if (expected && expected.test)
    return expected.test(actual);
  if (typeof expected !== 'object' || expected === null || actual === null)
    return expected === actual;
  if (typeof actual !== 'object')
    return false; // undefined, a number, etc.
  for (var k in expected) {
    if (!test(actual[k], expected[k]))
      return false;
  }
  if (Object.keys(expected).length !== Object.keys(actual).length)
    return false;
  return true;
}
exports.test = test;

function getExpectedValue(expected) {
  // allow functions to provide a custom expectedValue too
  if (expected && expected.expectedValue)
    return getExpectedValue(expected.expectedValue);
  if (typeof expected !== 'object' || expected === null)
    return expected;

  var res = new (expected.constructor)();
  for (var k in expected) {
    res[k] = getExpectedValue(expected[k]);
  }
  return res;
}

exports.recorder = function() {
  return {
    _values: {},
    save: function(key, expected) {
      var self = this;
      return {
        expectedValue: expected,
        test: function(actual) {
          self._values[key] = actual;
          return test(actual, expected);
        },
        inspect: function() {
          return inspect(expected);
        }
      };
    },
    get: function(key) {
      return this._values.hasOwnProperty(key) ?
        this._values[key] :
        key + ' not found';
    }
  };
};

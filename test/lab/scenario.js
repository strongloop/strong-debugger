var Promise = require('./promise');
var tap = require('./tap');
var inspect = require('util').inspect;
var debuglog = require('./debuglog');
var m = require('./matchers');

module.exports = Scenario;

function Scenario() {
  this._commands = [];
  this.lastReqId = 0;
}

Scenario.prototype.run = function(client) {
  return this._commands.reduce(
    function(cur, next) {
      return cur.then(function() {
        debuglog('SCENARIO STEP %s', inspect(next));
        return next.run(client);
      });
    },
    Promise.resolve());
};

Scenario.prototype.sendRequest = function(req) {
  var id = ++this.lastReqId;
  if (!req.id) { req.id = id; }
  this._commands.push({
    run: function(client) {
      return client.send(req).then(function() {
        tap.current().pass('Send request ' + inspect(req));
      });
    },
    inspect: function() {
      return '(send request ' + inspect(req) + ')';
    }
  });
  return this;
};

Scenario.prototype.expectMessage = function(matcher) {
  this._commands.push({
    run: function(client) {
      return client.receive().then(function(msg) {
        tap.current().assertThat(
          msg, matcher, 'Receive message ' + inspect(matcher));
      });
    },
    inspect: function() {
      return '(expect message that ' + inspect(matcher) + ')';
    }
  });
  return this;
};

Scenario.prototype.expectEvent = function(method, paramMatcher) {
  var matcher = {
    method: method,
    params: paramMatcher ? paramMatcher : m.isObject()
  };
  this.expectMessage(matcher);
};

Scenario.prototype.delay = function(timeInMs) {
  this._commands.push({
    run: function(client) {
      return Promise.delay(timeInMs);
    },
    inspect: function() {
      return '(wait ' + timeInMs + 'ms)';
    }
  });
};

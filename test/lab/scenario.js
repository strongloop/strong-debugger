var Promise = require('./promise');
var tap = require('./tap');
var inspect = require('util').inspect;
var debuglog = require('./debuglog');
var m = require('./matchers');

module.exports = Scenario;

function Scenario() {
  this._commands = [];
  this._recorder = m.recorder();
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
  if (req.id) {
    if (req.id > this.lastReqId) this.lastReqId = req.id;
  } else {
    req.id = ++this.lastReqId;
  }
  this._commands.push({
    run: function(client) {
      resolveAllRefs(req);
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

Scenario.prototype.sendInput = function(text) {
  text = String(text);
  this._commands.push({
    run: function(client) {
      client.stdin.write(text);
      return Promise.resolve();
    },
    inspect: function() {
      return '(send input ' + JSON.stringify(text) + ')';
    }
  });
};

Scenario.prototype.saveRef = function(key, expected) {
  return this._recorder.save(key, expected);
};

Scenario.prototype.ref = function(key) {
  var s = this;
  var result = function resolveReference() {
    return s._recorder.get(key);
  };
  result.inspect = function() {
    return '$REF(' + key + ') ' + inspect(result());
  };
  return result;
};

function resolveAllRefs(data) {
  if (typeof data !== 'object' || data === null) return;
  for (var k in data) {
    var value = data[k];
    if (typeof value === 'function' && value.name === 'resolveReference') {
      data[k] = value();
    } else {
      resolveAllRefs(value);
    }
  }
}

Scenario.prototype.enableDebugger = function() {
  this.sendRequest({ method: 'Debugger.enable' });
  this.expectMessage(m.containsProperties({ id: this.lastReqId }));
};

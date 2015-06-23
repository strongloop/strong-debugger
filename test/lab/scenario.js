'use strict';
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
  this._client = null;
}

Scenario.prototype.run = function(client) {
  var self = this;
  this._client = client;
  return this._commands.reduce(
    function(cur, next) {
      return cur.then(function() {
        debuglog('SCENARIO STEP %s', inspect(next));
        return next.run(client);
      });
    },
    Promise.resolve())
  .finally(function() {
    self._client = null;
  });
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
      return '(send request #' + req.id + ' ' + inspect(req) + ')';
    }
  });
  return this;
};

Scenario.prototype.expectResponse = function(id, resultMatcher) {
  if (arguments.length === 0) {
    resultMatcher = m.isObject();
    id = this.lastReqId;
  } else if (arguments.length === 1) {
    resultMatcher = id;
    id = this.lastReqId;
  }

  this._commands.push({
    run: function(client) {
      return check();
      function check() {
        return client.receive().then(function(msg) {
          if (!msg.hasOwnProperty('id') && msg.hasOwnProperty('method')) {
            debuglog('EXPECT RESPONSE ignored server event');
            return check();
          }

          tap.current().assertThat(
            msg,
            { id: id, result: resultMatcher },
            'Receive response #' + id + ' that ' + inspect(resultMatcher));
        });
      }
    },
    inspect: function() {
      return '(expect response #' + id + ' that ' +
        inspect(resultMatcher) + ')';
    }
  });
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

Scenario.prototype.expectEvent = function(method, paramsMatcher) {
  if (!paramsMatcher) paramsMatcher = m.isObject();
  var eventList = [];
  this._commands.push({
    run: function(client) {
      return check();
      function check(timeoutInMs) {
        return client.receive(timeoutInMs).then(function(msg) {
          eventList.push(msg);
          if (msg.method === method && !m.test(msg.params, paramsMatcher))
            return check(100);
          assertEventInList();
        }).catch(Promise.TimeoutError, function(err) {
          assertEventInList();
        });
      }

      function assertEventInList() {
        tap.current().assertThat(
          eventList,
          m.hasMember({
            method: method,
            params: paramsMatcher
          }),
          'Receive event ' + method + ' with params ' +
            inspect(paramsMatcher));
      }
    },
    inspect: function() {
      return '(expect event ' + method + ' with params ' +
        inspect(paramsMatcher) + ')';
    }
  });
};

Scenario.prototype.skipEvents = function(method) {
  this._commands.push({
    run: function(client) {
      return skip();
      function skip() {
        return client.receive(100).then(function(msg) {
          if (msg.method === method) {
            debuglog('skipped', msg);
            return skip();
          }
          client.undoReceive(msg);
          tap.current().pass('Skip all events ' + method);
        }).catch(Promise.TimeoutError, function(err) {
          debuglog('No more events to skip.');
        });
      }
    },
    inspect: function() {
      return '(skip all events ' + method + ')';
    }
  });
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

Scenario.prototype.waitForStdOut = function(matcher) {
  if (!matcher) matcher = m.isString();
  var dataList = [];
  this._commands.push({
    run: function(client) {
      return check();
      function check(timeoutInMs) {
        return client.readStdOut(timeoutInMs).then(function(data) {
          data = data.toString();
          dataList.push(data);
          if (!m.test(data, matcher))
            return check(100);
          assertDataInList();
        }).catch(Promise.TimeoutError, function(err) {
          assertDataInList();
        });
      }

      function assertDataInList() {
        tap.current().assertThat(
          dataList,
          m.hasMember(matcher),
          'Receive stdout data ' + inspect(matcher));
      }
    },
    inspect: function() {
      return '(wait for stdout ' + inspect(matcher) + ')';
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

  // matcher API
  result.test = function(actual) {
    return m.test(actual, result());
  };

  Object.defineProperty(result, 'expectedValue', {
    get: function() { return result(); }
  });

  return result;
};

Scenario.prototype.refScriptIdByName = function(fullPath) {
  var s = this;

  var result = function resolveReference() {
    var id = s._client.findScriptByName(fullPath);
    return id !== undefined ? id : 'Unknown script ' + fullPath;
  };

  result.inspect = function() {
    var id = s._client.findScriptByName(fullPath);
    var desc = '$SCRIPT_ID(' + fullPath + ')';
    if (id !== undefined) desc = id + ' ' + desc;
    return desc;
  };

  // matcher API
  result.test = function(actual) {
    return m.test(actual, result());
  };

  Object.defineProperty(result, 'expectedValue', {
    get: function() {
      return result();
    }
  });

  return result;
};

Scenario.prototype.expectDebuggerPausedAt = function(scriptPath, lineIndex) {
  var s = this;
  s.skipEvents('Debugger.scriptParsed');
  s.expectEvent('Debugger.paused', m.containsProperties({
    callFrames: m.startsWith([
      m.containsProperties({
        location: m.containsProperties({
          lineNumber: lineIndex,
          scriptId: s.refScriptIdByName(scriptPath)
        }),
      }),
    ]),
  }));
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
  this.expectResponse();
  this.skipEvents('Debugger.scriptParsed');
};

Scenario.prototype.resume = function() {
  this.sendRequest({ method: 'Debugger.resume' });
  this.expectResponse();
  this.expectEvent('Debugger.resumed');
};

Scenario.prototype.findGlobalObjectId = function(globalVar, refKey) {
  this.sendRequest({ method: 'Runtime.evaluate', params: {
    expression: globalVar
  }});
  this.expectResponse(m.containsProperties({
    result: m.containsProperties({
      objectId: this.saveRef(refKey, m.isString())
    }),
  }));
};

Scenario.prototype.findLocalObjectId = function(localVar, refKey) {
  this.sendRequest({ method: 'Debugger.evaluateOnCallFrame', params: {
    expression: localVar,
    frame: 0
  }});
  this.expectResponse(m.containsProperties({
    result: m.containsProperties({
      objectId: this.saveRef(refKey, m.isString())
    }),
  }));
};

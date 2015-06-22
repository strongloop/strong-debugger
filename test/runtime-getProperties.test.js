'use strict';
var l = require('./lab');
var m = l.matchers;

var SCRIPT_UNDER_TEST = l.fixture(function continueToLocation() {
  /*jshint debug:true, proto:true */
  console.log('press ENTER to start...');
  process.stdin.once('data', function printer(data) {
    data = data.toString();
    var inspectedObject = new InspectedClass();
    var protoObject = Object.create(null); protoObject.__proto__ = 42;
    var frozen = { key: 'a-string-value' }; Object.freeze(frozen);
    var sealed = { key: 'a-string-value' }; Object.seal(sealed);
    debugger; // line 8
    console.log(data);
    console.log(inspectedObject);
  });

  function InspectedClass() {
    this.writableProp = 'wr';
    Object.defineProperty(this, 'readonlyProp', { value: 'ro' });
  }
});

l.runUsing(l.debugScript(SCRIPT_UNDER_TEST), function(client) {
  return client.verifyScenario(function(s) {
    s.enableDebugger();
    s.sendInput('run');

    s.expectEvent('Debugger.paused', m.containsProperties({
      callFrames: m.startsWith([
        m.containsProperties({
          callFrameId: '0',
          functionName: 'printer',
          location: m.containsProperties({
            lineNumber: 8,
            scriptId: s.refScriptIdByName(SCRIPT_UNDER_TEST)
          }),
          scopeChain: m.startsWith([{
            object: m.containsProperties({
              objectId: s.saveRef('scopeId', m.isString())
            }),
            type: 'local'
          }]),
        }),
      ]),
    }));

    //
    // Get properties of a scope object
    //
    s.sendRequest({ method: 'Runtime.getProperties', params: {
      objectId: s.ref('scopeId'),
      ownProperties: false,
      accessorProperties: false,
    }});

    s.expectResponse({ result: [
      {
        name: 'data',
        writable: true,
        enumerable: true,
        configurable: true,
        value: {
          type: 'string',
          value: 'run',
          description: 'run'
        },
        isOwn: true,
        // TODO: get, set, wasThrown, symbol
      },
      m.containsProperties({
        name: 'inspectedObject',
        value: m.containsProperties({
          objectId: s.saveRef('objectId', m.isString())
        }),
      }),
      m.containsProperties({
        name: 'protoObject',
        value: m.containsProperties({
          objectId: s.saveRef('protoId', m.isString())
        }),
      }),
      m.containsProperties({
        name: 'frozen',
        value: m.containsProperties({
          objectId: s.saveRef('frozenId', m.isString())
        }),
      }),
      m.containsProperties({
        name: 'sealed',
        value: m.containsProperties({
          objectId: s.saveRef('sealedId', m.isString())
        }),
      }),
    ]});

    //
    // Get properties of a regular object
    //
    s.sendRequest({ method: 'Runtime.getProperties', params: {
      objectId: s.ref('objectId'),
      ownProperties: true,
      accessorProperties: false
    }});

    s.expectResponse({ result: [
      {
        name: 'writableProp',
        writable: true,
        enumerable: true,
        configurable: true,
        value: {
          type: 'string',
          value: 'wr',
          description: 'wr'
        },
        isOwn: true,
        // TODO: get, set, wasThrown, symbol
      },
      {
        name: 'readonlyProp',
        writable: false,
        enumerable: false,
        configurable: false,
        value: {
          type: 'string',
          value: 'ro',
          description: 'ro'
        },
        isOwn: true,
      },
      {
        name: '__proto__',
        value: {
          type: 'object',
          objectId: m.isString(),
          className: 'Object',
          description: 'InspectedClass'
        },
        writable: true,
        configurable: true,
        enumerable: false,
        isOwn: true
      }
    ]});

    //
    // Get properties of a object with non-object __proto__
    //
    s.sendRequest({ method: 'Runtime.getProperties', params: {
      objectId: s.ref('protoId'),
      ownProperties: true,
      accessorProperties: false
    }});

    if (/^v0\.10\./.test(process.version)) {
      // NOTE(bajtos) v0.10 does not correctly support __proto__ overriding
      s.expectResponse({ result: [
        {
          name: '__proto__',
          writable: true,
          enumerable: false,
          configurable: true,
          value: {
            type: 'null',
            objectId: m.isString(),
            description: 'null'
          },
          isOwn: true,
        },
      ]});
    } else {
      s.expectResponse({ result: [
        {
          name: '__proto__',
          writable: true,
          enumerable: true,
          configurable: true,
          value: {
            type: 'number',
            value: 42,
            description: '42'
          },
          isOwn: true,
        },
      ]});
    }

    //
    // Get properties of a frozen object
    //
    s.sendRequest({ method: 'Runtime.getProperties', params: {
      objectId: s.ref('frozenId'),
      ownProperties: true,
      accessorProperties: false
    }});

    s.expectResponse({ result: [
      {
        name: 'key',
        writable: false, // because frozen
        configurable: false, // because frozen
        enumerable: true,
        value: {
          type: 'string',
          value: 'a-string-value',
          description: 'a-string-value'
        },
        isOwn: true,
      },
      {
        name: '__proto__',
        writable: true, // mimic DevTools behaviour
        enumerable: false,
        configurable: true, // mimic DevTools behaviour
        value: {
          type: 'object',
          objectId: m.isString(),
          className: 'Object',
          description: 'Object'
        },
        isOwn: true
      },
    ]});

    //
    // Get properties of a sealed object
    //
    s.sendRequest({ method: 'Runtime.getProperties', params: {
      objectId: s.ref('sealedId'),
      ownProperties: true,
      accessorProperties: false
    }});

    s.expectResponse({ result: [
      {
        name: 'key',
        writable: true,
        configurable: false, // because sealed
        enumerable: true,
        value: {
          type: 'string',
          value: 'a-string-value',
          description: 'a-string-value'
        },
        isOwn: true,
      },
      {
        name: '__proto__',
        writable: true,
        enumerable: false,
        configurable: true, // mimic DevTools behaviour
        value: {
          type: 'object',
          objectId: m.isString(),
          className: 'Object',
          description: 'Object'
        },
        isOwn: true
      },
    ]});
  });
});

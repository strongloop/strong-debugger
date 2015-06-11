'use strict';
var tap = require('tap');
var m = require('./matchers');

tap.test('containsProperties', function(tt) {
  tt.assertThat(
    { key: 'value', extra: 2 },
    m.containsProperties({ key: 'value' }),
    'ignore extra properties');

  tt.assertThat(
    { key: 'pre regex post' },
    m.containsProperties({ key: /regex/ }),
    'apply regex');

  tt.assertThat(
    { key: { nested: 'value' } },
    m.containsProperties({ key: { nested: 'value' } }),
    'nested objects');

  tt.assertThat(
    { key: { nested: 'value', extra: 2 } },
    { key: m.containsProperties({ nested: 'value' }) },
    'matcher nested in an object');

  tt.assertThat(
    { key: { nested: 'value', extra: 2 }, top: 'extra' },
    m.containsProperties({
      key: m.containsProperties({ nested: 'value' })
    }),
    'matcher nested in a matcher');

  tt.assertNotThat(
    { foo: 'bar' },
    m.containsProperties({ key: 'value' }),
    'reject missing property');

  tt.assertThat(
    { key: null, extra: null },
    m.containsProperties({ key: null }),
    'expected property value is null');

  tt.assertNotThat(
    null,
    m.containsProperties({ key: 'value' }),
    'actual value is null, expects a matcher');

  tt.assertNotThat(
    null,
    { key: 'value' },
    'actual value is null, expects an object');

  tt.end();
});

tap.test('deepEquals', function(tt) {
  tt.assertNotThat(
    { key: 'value', extra: 2 },
    m.deepEquals({ key: 'value' }),
    'reject extra property');

  tt.assertNotThat(
    { key: 'value' },
    m.deepEquals({ key: 'value', extra: 2 }),
    'reject missing property');

  tt.end();
});

tap.test('hasValueOfType', function(tt) {
  tt.assertThat('text', m.hasValueOfType('string'));
  tt.assertNotThat({}, m.hasValueOfType('string'));
  tt.assertNotThat(null, m.hasValueOfType('string'));
  tt.assertNotThat(undefined, m.hasValueOfType('string'));

  tt.assertThat({}, m.hasValueOfType('object'));
  tt.assertNotThat('text', m.hasValueOfType('object'));
  tt.assertNotThat(null, m.hasValueOfType('object'));
  tt.assertNotThat(undefined, m.hasValueOfType('object'));

  tt.end();
});

tap.test('startsWith', function(tt) {
  tt.assertThat(
    [1, 2, 3],
    m.startsWith([1, 2]),
    'accepts number items');

  tt.assertNotThat(
    [1, 2, 3],
    m.startsWith([2, 1]),
    'rejects number items');

  tt.assertThat(
    [{ key: 'value1', extra: 'value' }, { key: 'value2' }],
    m.startsWith([m.containsProperties({ key: 'value1' })]),
    'accepts deep matchers');

  tt.assertNotThat(
    [{ key: 'value1', extra: 'value' }, { key: 'value2' }],
    m.startsWith([m.containsProperties({ key: 'value1', extra: 'invalid' })]),
    'accepts deep matchers');

  tt.assertNotThat(
    { 0: 'v1', 1: 'v2' },
    m.startsWith(['v1']),
    'rejects object values');

  tt.end();
});

tap.test('hasMember', function(tt) {
  tt.assertThat(
    [1, 2, 3],
    m.hasMember(2),
    'accepts number item');

  tt.assertNotThat(
    [1, 2, 3],
    m.hasMember(5),
    'rejects number item');

  tt.assertNotThat(
    null,
    m.hasMember(5),
    'handles expected value "null"');

  tt.assertThat(
    [{ k: 'v1', e: 'e1' }, { k: 'v2', e: 'e2' }],
    m.hasMember(m.containsProperties({ k: 'v2' })),
    'accepts matcher');

  tt.assertNotThat(
    [{ k: 'v1', e: 'e1' }, { k: 'v2', e: 'e2' }],
    m.hasMember(m.containsProperties({ k: 'v3' })),
    'rejects matcher');

  tt.end();
});

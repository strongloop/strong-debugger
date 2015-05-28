var tap = require('tap');
var m = require('./matchers');

tap.test('containsProperty', function(tt) {
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

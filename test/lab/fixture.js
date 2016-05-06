// Copyright IBM Corp. 2015. All Rights Reserved.
// Node module: strong-debugger
// US Government Users Restricted Rights - Use, duplication or disclosure
// restricted by GSA ADP Schedule Contract with IBM Corp.

'use strict';
var fs = require('fs');
var path = require('path');

module.exports = getFixturePath;

function getFixturePath(nameOrFn) {
  var type = typeof nameOrFn;
  switch (type) {
    case 'string':
      return path.resolve(__dirname, '..', 'fixtures', nameOrFn);
    case 'function':
      return createFixture(nameOrFn);
    default:
      throw new TypeError('Unsupported type of nameOrFn argument - ' + type);
  }
}

function createFixture(fn) {
  var testName = path.basename(require.main.filename,
        '.test' + path.extname(require.main.filename));
  var fname = 'generated-' + testName + '.js';
  var fullpath = getFixturePath(fname);
  var content = fn.toString()
    .replace(/^function\s*[a-zA-Z_]*\([^\)]*\)\s*{[\r\n]*/m, '')
    .replace(/\s*}$/, '\n');
  fs.writeFileSync(fullpath, content, 'utf-8');
  return fullpath;
}

'use strict';

var fs = require('fs');
var vm = require('vm');

var sourcePath = require.resolve('../../backend/convert');
var sourceCode = fs.readFileSync(sourcePath, 'utf-8');
sourceCode += '\nconvert;';

module.exports = vm.runInThisContext(sourceCode, sourcePath);

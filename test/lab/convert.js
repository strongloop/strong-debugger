// Copyright IBM Corp. 2015. All Rights Reserved.
// Node module: strong-debugger
// US Government Users Restricted Rights - Use, duplication or disclosure
// restricted by GSA ADP Schedule Contract with IBM Corp.

'use strict';

var fs = require('fs');
var vm = require('vm');

var sourcePath = require.resolve('../../backend/convert');
var sourceCode = fs.readFileSync(sourcePath, 'utf-8');
sourceCode += '\nconvert;';

module.exports = vm.runInThisContext(sourceCode, sourcePath);

// Copyright IBM Corp. 2015. All Rights Reserved.
// Node module: strong-debugger
// US Government Users Restricted Rights - Use, duplication or disclosure
// restricted by GSA ADP Schedule Contract with IBM Corp.

'use strict';
/* Use Bluebird as the Promise implementation */
var Promise = module.exports = require('bluebird');

Promise.waitForEvent = function(emitter, name) {
  return new Promise(function(resolve, reject) {
    emitter.once(name, resolve);
  });
};

Promise.onPossiblyUnhandledRejection(function(err) {
  console.error('POSSIBLY UNHANDLED REJECTION', err.stack);
});

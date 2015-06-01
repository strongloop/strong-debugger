/* Use Bluebird as the Promise implementation */
var Promise = module.exports = require('bluebird');

Promise.waitForEvent = function(emitter, name) {
  return new Promise(function(resolve, reject) {
    emitter.once(name, resolve);
  });
};

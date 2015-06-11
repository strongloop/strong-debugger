'use strict';
console.log('press ENTER to start...');
process.stdin.once('data', function() {
  require('./http-server');
});

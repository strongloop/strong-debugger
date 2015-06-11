'use strict';
var counter = 0;
console.log('tick', counter);
setInterval(function() {
  console.log('tick', ++counter);
  debugger;
}, 50);

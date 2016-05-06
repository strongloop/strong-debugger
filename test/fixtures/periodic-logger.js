// Copyright IBM Corp. 2015. All Rights Reserved.
// Node module: strong-debugger
// US Government Users Restricted Rights - Use, duplication or disclosure
// restricted by GSA ADP Schedule Contract with IBM Corp.

'use strict';
var counter = 0;
console.log('tick', counter);
setInterval(function() {
  console.log('tick', ++counter);
  debugger;
}, 50);

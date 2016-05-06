// Copyright IBM Corp. 2015. All Rights Reserved.
// Node module: strong-debugger
// US Government Users Restricted Rights - Use, duplication or disclosure
// restricted by GSA ADP Schedule Contract with IBM Corp.

'use strict';
var http = require('http');

var server = http.createServer(function(req, resp) {
  resp.end('Hello world\n');
});

server.listen(3000, function() {
  console.log('listening on port 3000');
});

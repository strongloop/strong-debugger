'use strict';
var http = require('http');

var server = http.createServer(function(req, resp) {
  resp.end('Hello world\n');
});

server.listen(3000, function() {
  console.log('listening on port 3000');
});

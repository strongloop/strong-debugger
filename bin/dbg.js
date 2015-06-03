var fork = require('child_process').fork;
var net = require('net');
var WebSocket = require('ws');
var split = require('split');

var target = process.argv[2];
if (!target) {
  console.log('Usage:');
  console.log('  %s app.js [port]', process.argv[0]);
  process.exit(1);
}

var child = fork(require.resolve('../test/lab/run-in-debugger'), [target]);
child.on('exit', function(code) {
  console.log('Child exited with code %s', code);
  process.exit();
});

child.on('message', function(msg) {
  if (msg.cmd !== 'DEBUGGER_LISTENING') return;
  var port = msg.port;

  var server = new WebSocket.Server({ port: 8080 }, function() {
    console.log('Start webserver in Arc\'s devtools/frontend:');
    console.log('  $ cd strong-arc/devtools/frontend');
    console.log('  $ python -m SimpleHTTPServer');
    console.log('Open the debugger in your browser:');
    console.log(
      '  $ open http://localhost:8000/inspector.html?ws=localhost:8080');
  });

  server.on('connection', function(ws) {
    var client = net.connect(port);
    var clientReader = client.pipe(split());

    ws.on('message', function(msg) {
      client.write(msg + '\r\n');
    });

    ws.on('close', function() {
      client.end();
    });

    clientReader.on('data', function(line) {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(line);
    });

    client.on('close', function() { ws.close(); });
    client.on('end', function() { ws.close(); });
  });
});

process.on('exit', function() {
  child.kill();
});

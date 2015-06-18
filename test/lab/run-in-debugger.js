'use strict';
var target = process.argv[2];
if (!target) {
  console.log('Usage:');
  console.log('  %s app.js [port]', process.argv[0]);
  process.exit(1);
}

// Init the debugger module
var port = +process.argv[3] || 0;
var dbg = require('../..');

process.on('message', function(msg) {
  if (msg.cmd !== 'STOP') return;
  dbg.stop(function() {
    process.send({ cmd: 'DEBUGGER_STOPPED' });
  });
});

dbg.start(port, function(err, port) {
  if (err) throw err;

  if (process.send) {
    process.nextTick(function() {
      process.send({ cmd: 'DEBUGGER_LISTENING', port: port });
    });
  } else {
    console.log('debugger listening at 127.0.0.1:%d', port);
  }

  // Reset argv to not include the runner (at argv[1]).
  process.argv = process.argv.slice(0, 1).concat(process.argv.slice(2));

  // Run as if app is the main module
  require('module')._load(
    require('path').resolve(process.argv[1]),
    null, // parent
    true  // isMain
  );
});

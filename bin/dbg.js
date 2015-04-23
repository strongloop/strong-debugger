#!/usr/bin/env node

var target = process.argv[1];
if (!target) {
  console.log('Usage:');
  console.log('  %s app.js', process.argv[0]);
  process.exit(1);
}

// Init the debugger module
var dbg = require('../');
dbg.start(4000, function(err, port) {
  if (err) throw err;
  console.log('debugger listening at 127.0.0.1:%d', port);

  // Reset argv to not include the runner (at argv[1]).
  process.argv = process.argv.slice(0, 1).concat(process.argv.slice(2));

  // Run as if app is the main module
  require('module')._load(
    require('path').resolve(process.argv[1]),
    null, // parent
    true  // isMain
  );
});

var counter = 0;
setInterval(function() {
  console.log('tick', ++counter);
  debugger;
}, 800);

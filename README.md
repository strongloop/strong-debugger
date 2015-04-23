# strong-debugger

DevTools Remote Debugging Protocol provider for Node.js and io.js

## Spike How To

 1. Clone the project and run
  ```
  $ node-gyp rebuild
  ```

 2. Start the sample app with the debugger attached:
  ```
  $ ./bin/dbg.js app.js
  ```

 3. Open a new terminal and connect to the TCP server via telnet:
  ```
  $ telnet 127.0.0.1 4000
  ```

 4. Send "enable" to enable the debugger. The sample app makes periodic calls
  of `debugger;`, thus the process will be paused soon.

 5. Send "disable" to disable the debuger. This will resume execution of the
   app and you will see more ticks printed in the app console.

 6. Send "close" to disconnect from the debugger server.


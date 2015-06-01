# strong-debugger

DevTools Remote Debugging Protocol provider for Node.js and io.js

## Spike How To

 1. Clone the project and run
  ```
  $ node-gyp rebuild
  ```

 2. Start the sample app with the debugger attached:
  ```
  $ node test/lab/run-in-debugger.js test/fixtures/periodic-logger.js 4000
  ```

 3. Open a new terminal and connect to the TCP server via telnet:
  ```
  $ telnet 127.0.0.1 4000
  ```

 4. Send the following line to enable the debugger. The sample app makes
  periodic calls of `debugger;`, thus the process will be paused soon.

  ```json
  { "id": 1, "method": "Debugger.enable" }
  ```

 5. Send the following line to disable the debuger. This will resume execution
   of the app and you will see more ticks printed in the app console.

  ```json
  { "id": 2, "method": "Debugger.disable" }
  ```

 6. Send `{ "close": true }` to disconnect from the debugger server.


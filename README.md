# strong-debugger

DevTools Remote Debugging Protocol provider for Node.js and io.js

## Spike How To

 1. Clone the project and run
  ```
  $ node-gyp rebuild
  ```

 2. Start an HTTP server in Arc' devtools/frontend folder to get DevTools
    front-end:
  ```
  $ cd strong-arc/devtools/frontend
  $ python -m SimpleHTTPServer
  ```

 3. Start the sample app with the debugger attached and proxied via websocket:
  ```
  $ node bin/dbg.js test/fixtures/periodic-logger.js
  ```

 4. Open the debugger in Chrome
  ```
  $ open http://localhost:8000/devtools/inspector.html?ws=localhost:8080
  ```

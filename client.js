'use strict';

var net = require('net');
var util = require('util');
var stream = require('stream');
var newlineJson = require('newline-json');
var debug = require('debug')('strong-debugger:client');

/**
 * Create a client connection - a duplex object stream that accepts and
 * produces objects (messages).
 *
 * The returned stream emits "connect" even after it has connected.
 *
 * @param {Number} port The port where the debugger is listening.
 * @return {DuplexStream}
 */
exports.connect = function(port) {
  var socket = net.connect(port);
  return new ClientStream(socket);
};

function ClientStream(socket) {
  stream.Duplex.call(this, { objectMode: true });
  this._socket = socket;
  var self = this;

  this._reader = new (newlineJson.Parser)();
  this._socket.pipe(this._reader);

  // give it a kick whenever the source is readable
  // read(0) will not consume any bytes
  this._reader.on('readable', function() {
    debug('reader readable');
    self.read(0);
  });

  this._reader.on('end', function() {
    debug('socket closed');
    self.push(null); // EOF
  });

  this._writer = new (newlineJson.Stringifier)();
  this._writer.pipe(this._socket);

  this._socket.on('connect', function() {
    debug('connected');
    self.emit('connect');
  });

  // For SRC.pipe(DEST), DEST errors are emitted on SRC, but not the other way
  // around. As a result:
  //   - reader errors are emitted on conn too
  //   - socket errors are emitted on writer too
  // Therefore it is enough to listen on writer errors only.
  this._writer.on('error', function(err) { self.emit('error', err); });
}
util.inherits(ClientStream, stream.Duplex);

ClientStream.prototype._read = function(size) {
  debug('_read');
  var chunk, readMore;
  while (true) {
    chunk = this._reader.read();
    debug('read', chunk);
    if (chunk === null) break;
    debug('received data', chunk);
    readMore = this.push(chunk);
    if (!readMore) break;
  }
};

ClientStream.prototype._write = function(chunk, encoding, next) {
  debug('send data', chunk);
  this._writer.write(chunk, encoding, next);
};

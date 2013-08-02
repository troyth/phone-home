// Connect to server
var io = require('socket.io-client')
var socket = io.connect('localhost:8080', {reconnect: true});

console.log('2');

// Add a connect listener
socket.on('connect', function(socket) { 
    console.log('Connected!');
});
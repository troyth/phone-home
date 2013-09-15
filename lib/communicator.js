var events = require("events"),
    util = require("util"),
    colors = require("colors"),
    io = require("socket.io-client"),
    _ = require("lodash"),
    __ = require("../lib/fn.js"),
    delivery,
    freq;//max frequency for sending reports, determined by server



/**
 * Process Codes
 * SIGHUP        1       Term    Hangup detected on controlling terminal
                              or death of controlling process
 * SIGINT        2       Term    Interrupt from keyboard
 * SIGQUIT       3       Core    Quit from keyboard
 * SIGILL        4       Core    Illegal Instruction
 * SIGABRT       6       Core    Abort signal from abort(3)
 * SIGFPE        8       Core    Floating point exception
 * SIGKILL       9       Term    Kill signal
 * SIGSEGV      11       Core    Invalid memory reference
 * SIGPIPE      13       Term    Broken pipe: write to pipe with no readers
 * SIGALRM      14       Term    Timer signal from alarm(2)
 * SIGTERM      15       Term    Termination signal
 *
 *
 *
 * http://www.slac.stanford.edu/BFROOT/www/Computing/Environment/Tools/Batch/exitcode.html
 *
 */


/**
*
* Globals
*
**/
pFILEPATH = "../p";//where the password is stored if it exists
STRING_TOKEN = '_';//token for parsing filenames into metadata
PHOTO_FILEPATH_NAME = '/photos/';
PHOTO_FILEPATH = __dirname + PHOTO_FILEPATH_NAME;


/**
*
* Socket
*
* Connect to a single global socket
*
**/

Socket = {
  used: [],
  buffer: [],
  socket: null,

  connect: function( host ) {
    this.socket = io.connect(host, {reconnect: true});

    //unique id for this connection
    var uid = __.uid();

    // Add the host source url to the list of socket host urls that
    // are currently in use - this is used by the filter function
    // above to remove any host urls that we've already encountered
    // or used to avoid blindly attempting to reconnect on them.
    this.used.push({
      host: host,
      uid: uid
    });

    //create buffer for this connection to send data in report cycles
    this.buffer[ host ] = {
      uid: uid
    };

    return this.socket;
  }
};

/**
 * Communicator
 * @constructor
 *
 * @param {Object} opts
 */
function Communicator( opts ) {

  if ( !(this instanceof Communicator) ) {
    return new Communicator( opts );
  }

  // Ensure opts is an object
  opts = opts || {};

  /* @todo
  var inject, timer;

  inject = {};
  */

  // Initialize this Board instance with
  // param specified properties.
  _.assign( this, opts );

  // Easily track state of hardware
  this.ready = false;

  // Registry of inputs and outputs by name
  this.register = [];


  // If no debug flag, default to false
  // TODO: Remove override
  this.debug = true;

  if ( !("debug" in this) ) {
    this.debug = false;
  }

  /* @todo
  if ( !("repl" in this) ) {
    this.repl = true;
  }*/

  // List of inputs (typically sensors)
  this.inputs = null;

  // List of outputs (actuators, displays, etc)
  this.outputs = null;

  // Human readable name (if one can be detected)
  this.name = opts.name || '';

  // Create a Repl instance and store as
  // instance property of this firmata/board.
  // This will reduce the amount of boilerplate
  // code required to _always_ have a Repl
  // session available.
  //
  // If a sesssion exists, use it
  // (instead of creating a new session)
  //
  /* @todo
  if ( this.repl ) {
    if ( Repl.ref ) {

      inject[ this.id ] = this;

      Repl.ref.on( "ready", function() {
        Repl.ref.inject( inject );
      });

      this.repl = Repl.ref;
    } else {
      inject[ this.id ] = inject.board = this;
      this.repl = new Repl( inject );
    }
  }*/


  /**
  *
  * Initialization
  *
  **/
  // Set up connection to server with web sockets
  this.socket = Socket.connect.call( this, host );

  this.socket.on('connected', function(){
    console.log('connected!');
  });

}

// Inherit event api
util.inherits( Communicator, events.EventEmitter );



module.exports = Communicator;


// References:
// https://github.com/rwaldron/johnny-five/blob/master/lib/board.js
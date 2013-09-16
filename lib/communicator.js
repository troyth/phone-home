var EventEmitter = require('events').EventEmitter,
    util = require("util"),
    fs = require("fs"),
    colors = require("colors"),
    io = require("socket.io-client"),
    five = require("johnny-five"),
    dl  = require('delivery'),
    _ = require("lodash"),
    __ = require("../lib/fn.js"),
    available_sources = require("../sources"),
    delivery;



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
var pFILEPATH = "../p";//where the password is stored if it exists
var STRING_TOKEN = '_';//token for parsing filenames into metadata
var PHOTO_FILEPATH_NAME = '/photos/';
var PHOTO_FILEPATH = __dirname + PHOTO_FILEPATH_NAME;

// all the dependencies that need to be ready before beginning
var dependencies_ready = [];

/**
*
* Socket
*
* Connect to a single global socket
*
**/

var Socket = {
  used: null,
  buffer: null,
  socket: null,

  connect: function( communicator, host ) {
    this.socket = io.connect(host, {reconnect: true});

    //unique id for this connection
    var uid = __.uid();

    // Add the host source url to the list of socket host urls that
    // are currently in use - this is used by the filter function
    // above to remove any host urls that we've already encountered
    // or used to avoid blindly attempting to reconnect on them.
    if(this.used == null){
      this.used = [];//initialize array
    }
    this.used.push({
      host: host,
      uid: uid
    });

    return uid;
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

  // array of buffers of data to send on report cycles
  // each element of the array corresponds to a single
  // socket, and therefore either a server or another
  // communicator on the local network
  this.buffers = [];

  // max frequency for sending reports, determined by server
  this.freq = null;

  // Human readable name (if one can be detected)
  this.name = opts.name || '';

  // @todo: Repl would go here


  /**
  *
  * Initialization
  *
  **/
  this.log("info", "Communicator.constructor", "attempting to connect to server at: " + this.machine.homes.server.url);
  

  if(this.debug){

    var self = this;
    setTimeout(function(){
      //self.onSourceReady();
      self.initSources( self.onSourceReady );
    }, 1000);
    

    return true;

  }
  // not debug
  else{
    // Set up connection to server with web sockets
    var socketUID = Socket.connect.call( this, this.machine.homes.server.url );

    //create buffer for this connection to send data in report cycles
    this.buffers.push = {
      host: this.machine.homes.server.url,
      uid: socketUID
    };

    // parse machine.json sources to construct and
    // log dependencies
    this.initSources( this.onSourceReady );

    this.socket.on('connected', function(){
      Communicator.log("info", "Communicator.constructor", "connected to server");

      // handshake protocol with server
      this.handshake();
    });
  }
}//end Communicator


// Inherit event api
util.inherits( Communicator, EventEmitter );



/**
*
* onSourceReady
*
* Fired each time a new dependency ready event is fired.
* Tests if all dependencies are ready, if so, emits ready from
* the communicator.
*
**/
Communicator.prototype.onSourceReady = function( ){
  //check to see if still waiting on any dependencies
  for(var d in dependencies_ready){
    if(dependencies_ready[d] === false){
      return false;
    }
  }

  // emit ready from communicator
  this.emit("ready");
};



/**
*
* initSourceListeners
*
* Initialize all listeners for the ready signal from
* each top level object per source dependency (eg. board
* for Johnny-Five).
**/
Communicator.prototype.initSourceListeners = function( callback ){
  if(dependencies_ready[ "johnny-five" ] !== undefined){
    this.board.on("ready", function(){
      dependencies_ready[ "johnny-five" ] = true;
      callback.call();
    });
  }

  if(dependencies_ready[ "raspicam" ] !== undefined){
    //@todo
  }

  if(dependencies_ready[ "delivery.js" ] !== undefined){
    delivery.on('delivery.connect',function(del){
      dependencies_ready[ "delivery.js" ] = true;
      callback.call();
    });
  }
};


/**
*
* initSources
*
* Initialize all of the top level objects required by each
* source type (eg. board for Johnny-Five)
*
**/
Communicator.prototype.initSources = function( callback ){
  // initialize all sources
  for(var i in this.machine.inputs){
    // if source not already initialized
    if(dependencies_ready[ this.machine.inputs[i].source ] === undefined){
      dependencies_ready[ this.machine.inputs[i].source ] = false;

      switch( this.machine.inputs[i].source ){
        case "johnny-five":
          this.log("info", "Communicator.initSources", "initializing Johnny-Five board");
          this.board = new five.Board();

          /*
          this.board.on("ready", function(){
            dependencies_ready[ "johnny-five" ] = true;
            callback.call( this );
          });
*/
          break;
        case "raspicam":
          //@todo: raspicam constructor
          // communicator.raspicam = new Raspicam();

          // add delivery.js to list of dependencies
          dependencies_ready[ "delivery.js" ] = false;
          break;

        default:
          break;
      }
    }// end if not already defined
    if(dependencies_ready[ "delivery.js" ] === undefined){
      if(this.machine.inputs[i].payload === "binary"){
        delivery = dl.listen( socket );
        delivery.connect();
      }
    }
  }// end for all machine.inputs

  callback.call();
};




/*
  //check if any photo/video imports, if so, initialize Delivery.js for file transfer
  for(var i in config.imports){
    if(config.imports[i].type == "photo" || config.imports[i].type == "timelapse" || config.imports[i].type == "video"){
      console.log('\n\n\nINITIALIZING DELIVERY.js');
      delivery = dl.listen( socket );
    delivery.connect();

    delivery.on('delivery.connect',function(delivery){
      console.log('delivery ready');
        DELIVERY_READY = true; //set delivery ready flag
        delivery = delivery; //assign delivery to global variable

        delivery.on('send.start',function(filePackage){
            FILE_PACKAGES[ filePackage.uid ] = filePackage.name;
        });

        delivery.on('send.success',function(uid){
          //console.log('send.success with uid: '+ uid);
          
          //if(typeof FILE_PACKAGES[ uid ] != 'undefined'){
          //  fs.unlinkSync(PHOTO_FILEPATH + FILE_PACKAGES[ uid ]);
          //  console.log('\n\n SUCCESS DELETING FILE at: ' + PHOTO_FILEPATH + FILE_PACKAGES[ uid ]);
          //  FILE_PACKAGES[ uid ] = undefined;
          //}
        });

        console.log('\n\n\nINITIALIZING DELIVERY IMPORTS');
        //initialize file-transfer-based sensors
        initDeliveryImports();
        console.log('delivery imports initialized\n\n');
    });
    break;
    }
  }
}*/

/**
*
* handshakeSuccess
*
* Callback function for handling handshake success
*
**/

Communicator.prototype.handshakeSuccess = function( confirm ){
  // set machine id given by server
  this.machine.id = confirm.id;

  // set frequency of updates given by server
  this.freq = confirm.freq; 

  // if Louis server sends back a password on initial
  // connection or if password needs to be updated,
  // create or update the local password file
  if(confirm.password){
    this.machine.password = confirm.password;

    // write new password to local disc
    fs.writeFile(pFILEPATH, confirm.password, {encoding: 'utf8'}, function(err) {
      if(err){
        console.log("Error: trying to save new password to disc with message: " + err);
      }else{
        Communicator.log("info", "Communicator.handshake", "new password saved");
      }
    }); 
  }else{
    // can assume password confirmed as server won't send confirm.success if not
    Communicator.log("info", "Communicator.handshake", "password confirmed");
  }

  
/*
  console.log('\n\n\nINITIALIZING BOARD IMPORTS');
  //initialize Johnny-Five Arduino sensors
  initBoardImports();
  console.log('board imports initialized');

  console.log('\n\n\nBEGINNING REPORT CYCLE');
  //begin the reporting cycle
  setTimeout(function(){
    report();
  }, FREQ);
*/
};

/**
*
* handshake
*
* Shake hands with server to configure connection
*
**/
Communicator.prototype.handshake = function( ){

  // check for password
  if(fs.existsSync(pFILEPATH)){
    this.machine.password = fs.readFileSync(pFILEPATH, {encoding: 'utf8'});
  }

  this.log("info", "Communicator.handshake", "sending config to server");

  // send machine configuration to the server
  Socket.emit('config', this.machine);

  // handle confirmation error
  Socket.on('confirm.error', function( err ){
    this.log("error", "Communicator.handshake", "Handshake error with server with msg: " + err);
    
    // kill process to restart connection attempt (must wrap in forever)
    process.exit("SIGABRT");
  });

  // handle confirmation success
  Socket.on("confirm.success", this.handshakeSuccess);

};





/**
*
* Custom log function with color-coding
*
* Ported from Johnny-Five by @rwaldron
*
**/
Communicator.prototype.log = function( /* type, module, message [, long description] */ ) {
  var args = [].slice.call( arguments ),
      type = args.shift(),
      module = args.shift(),
      message = args.shift(),
      color = Communicator.prototype.log.types[ type ];

  if ( this.debug ) {
    console.log([
      // Timestamp
      String(+new Date()).grey,
      // Module, color matches type of log
      module.magenta,
      // Message
      message[ color ],
      // Miscellaneous args
      args.join(", ")
    ].join(" "));
  }
};

Communicator.prototype.log.types = {
  error: "red",
  fail: "orange",
  warn: "yellow",
  info: "cyan"
};







module.exports = Communicator;


// References:
// https://github.com/rwaldron/johnny-five/blob/master/lib/board.js
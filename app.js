//module dependencies
var io = require('socket.io-client')
	, five = require("johnny-five")
	, RaspiCam = require("raspicam")
	, extend = require('util')._extend
	, dl  = require('delivery')
    , fs  = require('fs')
    , rmdir = require('rimraf');

//load and parse the machine.json config file
var config = require('./machine');

//a variable that describes the attributes of the Raspberry Pi that this code is running on
var machine = {};
machine.name = config.name;
machine.imports = [];


//a buffer to store the sensor values between emissions to the server
var buffer = {
	busy: false,
	imports: {}
};

var pFILEPATH = "./p";//where the password is stored if it exists
var STRING_TOKEN = '_';

//so the server can parse the photo filename into useful information
config.token = STRING_TOKEN;
config.file_pattern = {
	"import_name": 0,
	"type": 1,
	"timestamp": 2,
	"offset": 3,
	"count": 4,
	"encoding": 5
};

//reporting frequency in ms - the higher the number, the less frequent updates can be sent from machines - will be set upon confirmation from server
var FREQ = -1;

var REPORT_INTERVAL_ID;

var TIMELAPSE_TIMEOUT = 999999999;//20000;//after this time, kill the timelapse and start another one

//maximum attempts to try to write to a busy buffer
var MAX_ATTEMPTS = 5;

var PHOTO_FILEPATH_NAME = '/photos/';
var PHOTO_FILEPATH = __dirname + PHOTO_FILEPATH_NAME;

//initialize socket and delivery globally so other functions can emit events
var socket;
var delivery;
var DELIVERY_READY = false;//ready flag

//store all files sent with Delivery.js as FilePackages to be immediately deleted
var FILE_PACKAGES = [];


console.log('\n\n\nINITIALIZING JOHNNY-FIVE BOARD');
//instantiate the Johnny-Five board object
var board = new five.Board();

//once the board is ready, begin the socket io driven boot sequence
board.on("ready", function() {

	console.log('board ready');
	console.log('\n\n\nINITIALIZING CONNECTION TO LOUIS SERVER');
	//connect to the Louis server using socket.io
	socket = io.connect(config.server, {reconnect: true});

	//listen for the server connection
	socket.on('connect', function() { 
	    console.log('connected to Louis server');
	    console.log('\n\n\nINITIALIZING LOUIS SERVER HANDSHAKE');

	    //append password to config if machine is already registered with Louis server
	    if(fs.existsSync(pFILEPATH)){
	    	config.password = fs.readFileSync(pFILEPATH, {encoding: 'utf8'});
	    }

	    //send configuration as handshake initialization to the Louis server
	    socket.emit('config', config);

	    socket.on('confirm.error', function(err){
	    	console.log('Handshake error with Louis server of type: ' + err);
	    	//TODO: implement re-send
	    });

	    //listener for the Louis handshake confirmation
	    socket.on('confirm.success', function(confirm){
	    	//set variables sent from Louis server
	    	machine.id = confirm.id; //id given by Louis server
	    	FREQ = confirm.freq; //frequency of updates, specified by Louis server

	    	//if Louis server sends back a password (on initial connection or if password needs to be updated), update the persistent store
	    	if(confirm.password){
	    		machine.password = confirm.password;
	    		console.log('new password: '+ machine.password);
	    		fs.writeFile(pFILEPATH, confirm.password, {encoding: 'utf8'}, function(err) {
				    if(err) console.log("Error: trying to save new password to disc with message: " + err);
				}); 
	    	}

	    	console.log('handshake confirmed');

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
					    	/*
					    	if(typeof FILE_PACKAGES[ uid ] != 'undefined'){
					    		fs.unlinkSync(PHOTO_FILEPATH + FILE_PACKAGES[ uid ]);
					    		console.log('\n\n SUCCESS DELETING FILE at: ' + PHOTO_FILEPATH + FILE_PACKAGES[ uid ]);
					    		FILE_PACKAGES[ uid ] = undefined;
					    	}*/
					    });

					    console.log('\n\n\nINITIALIZING DELIVERY IMPORTS');
					    //initialize file-transfer-based sensors
					    initDeliveryImports();
					    console.log('delivery imports initialized\n\n');
					});
					break;
	    		}
	    	}

	    	console.log('\n\n\nINITIALIZING BOARD IMPORTS');
	    	//initialize Johnny-Five Arduino sensors
	    	initBoardImports();
	    	console.log('board imports initialized');

	    	console.log('\n\n\nBEGINNING REPORT CYCLE');
	    	//begin the reporting cycle
	    	setTimeout(function(){
	    		report();
	    	}, FREQ);
	    });
	});
});

	


/**
*
* report
*
* Sends the buffer of all sensor data to the server 
* according to the given frequency, FREQ
*
**/
function report(){
	REPORT_INTERVAL_ID = setInterval(function(){
		buffer.busy = true;

		var report = {
			id: machine.id,
			timestamp: new Date().getTime(),
			imports: buffer.imports
		};

		//send report to Louis server
		socket.emit('report', report);

		//send all files to be transfered via Delivery.js
		for(var i in buffer.imports){
			if(buffer.imports[i].type == "timelapse"){
				if(DELIVERY_READY == true){
					for(var p in buffer.imports[i].values){
					
						//console.log("\n\n***SENDING TIMELAPSE PHOTO AT: ");
						//console.log(buffer.imports[i].path + buffer.imports[i].values[p].value);
						console.log(buffer.imports[i].values[p].value);
						
					    delivery.send({
					    	name: buffer.imports[i].values[p].value,
					    	path: buffer.imports[i].path + buffer.imports[i].values[p].value
					    });

					}//for each photo
				}//if DELIVERY_READY
			}//if photo or timelapse			
		}
		
		for(var i in buffer.imports){
			buffer.imports[i].values = [];
		}
		buffer.busy = false;

		console.log('+++++++ reported to Louis server\n');

	}, FREQ);
}

/**
*
* initBoardImports
*
* Creates the controller objects for each sensor using
* Johnny-Five and the Raspberry Pi Camera protocols and
* stores an object with import name and this object in
* the machine object.
*
**/

function initBoardImports(){
	for(var imp in config.imports){
		//use an anonymous function to give define a new scope for the variable i
		(function() {
			var i = imp;
			var _import = config.imports[i];

		    var sensor;

		    if(_import.source == "arduino"){
		    	switch(_import.type){
		    		case "analog":
		    			sensor = new five.Sensor({
		    				pin: _import.pin,
		    				freq: _import.freq,
		    				range: _import.range
		    			});

		    			//create the sensor buffer
		    			buffer.imports[i] = {
		    				name: _import.name,
		    				type: _import.type,
		    				values: [] 
		    			};

		    			//set up event listeners to read values
		    			sensor.on("read", function( err, value ) {
						    //kill the process if NaN is returned, use forever to restart
						  	if(isNaN(value)){
						  		process.exit(1);
						  	}

						  	//make multiple attemps to write to buffer incase buffer is busy writing to socket
						  	var attempts = 0;
						  	while(attempts < MAX_ATTEMPTS){
						  		if(buffer.busy == false){

						  			//write sensor value to buffer with a timestamp
						  			buffer.imports[i].values.push( {
								  		timestamp: new Date().getTime(),
								  		value: value
								  	});

						  			attempts = MAX_ATTEMPTS;
						  		}else{
						  			attempts++;
						  		}
						  	}
						  });
		    			break;
		    		default:
		    			break;
		    	}
		    }

		})();//end anonymous function
	}//end master for loop
}


function initDeliveryImports(){
	for(var imp in config.imports){
		//use an anonymous function to give define a new scope for the variable i
		(function() {
			var i = imp;
			var _import = config.imports[i];

		    var sensor;
			if(_import.source == "raspicam"){
		    	switch(_import.type){
					case "timelapse":
						console.log("INITIALIZING TIMELAPSE IMPORT");

						var sensor = new RaspiCam({
							mode: _import.type,
							freq: _import.freq,
							encoding: _import.encoding,
							timeout: TIMELAPSE_TIMEOUT
						});

						//create the sensor buffer
						buffer.imports[i] = {
							name: _import.name,
							type: _import.type,
							values: []
						};

						initTimelapseSensor(sensor, _import, i, true);

						break;
					default:
						break;
				}//end switch _import.type
		    }//end if raspicam

		})();//end anonymous function
	}//end master for loop
}





function initTimelapseSensor(sensor, _import, i, init){

	if(!init){
		//remove all photos in previous timelapse directory
		rmdir( sensor.filepath, function(err){
			if(err) console.log('error trying to remove previous timelapse directory');
			console.log('\nDELETED PREVIOUS TIMELAPSE DIRECTORY AND PHOTOS\n');
		});
	}//end if !init

	var now_timestamp = new Date().getTime();

	//set sensor filename
	sensor.filename = _import.name + STRING_TOKEN + 
		'timelapse' + STRING_TOKEN + 
		now_timestamp + STRING_TOKEN + 
		_import.freq + STRING_TOKEN + 
		'%08d' + STRING_TOKEN + 
		'.' + _import.encoding;

	//set sensor filepath
	sensor.filepath = PHOTO_FILEPATH + now_timestamp + '/';

	//update buffer.imports[i].path
	buffer.imports[i].path = PHOTO_FILEPATH + now_timestamp + '/';


	//make new directory based on current timestamp
	console.log('\n       MKDIR: making directory: '+ sensor.filepath);
	fs.mkdirSync( sensor.filepath );
	fs.chmodSync( sensor.filepath, '777');


	//start capture process
	sensor.start();
	console.log('*******\n\n\nSTARTING TIMELAPSE CHILD PROCESS with PID: '+ sensor.child_process.pid + '\n\n');

	//set up event listeners on initialize
	if(init){
		console.log('\nSETTING UP LISTENERS!');
		//set up event listeners to read values
		sensor.on("read", function( err, photoname ) {
		    //console.log('app.js::timelapse read::photo taken with filename: '+ photoname);

		  	var attempts = 0;

		  	//try to register the photo MAX_ATTEMPTS times or timeout depending on business (semaphore) of buffer
		  	while(attempts < MAX_ATTEMPTS){
		  		if(buffer.busy == false){
		  			buffer.imports[i].values.push( {
				  		timestamp: new Date().getTime(),
				  		value: photoname
				  	});

		  			attempts = MAX_ATTEMPTS;
		  		}else{
		  			attempts++;
		  		}
		  	}
		});

		sensor.on('start.success', function(){
			console.log('************************** CAM STARTED!');
		});

		//set up listener for sensor process exit to perpetuate the process
		sensor.on('raspicam.exit', function(err){
			console.log('\napp.js::raspicam.exit emitted\n');

			setTimeout(function(){
				initTimelapseSensor(sensor, _import, i, false);
			}, FREQ*2);
		});
	}//end if init

	//return sensor;
}
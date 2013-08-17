//module dependencies
var io = require('socket.io-client')
	, five = require("johnny-five")
	, RaspiCam = require("raspicam")
	, extend = require('util')._extend
	, dl  = require('delivery')
    , fs  = require('fs');

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


console.log('\n\n\nINITIALIZING BOARD');
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

	    if(fs.existsSync(pFILEPATH)){
	    	config.password = fs.readFileSync(pFILEPATH, {encoding: 'utf8'});
	    	console.log('fetched password: '+ config.password);
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
	    	machine.id = confirm.id;
	    	FREQ = confirm.freq;

	    	//TODO: write this to a persistent file
	    	if(confirm.password){
	    		machine.password = confirm.password;
	    		console.log('new password: '+ machine.password);
	    		fs.writeFile(pFILEPATH, confirm.password, {encoding: 'utf8'}, function(err) {
				    if(err) console.log("Error: trying to save new password to disc with message: " + err);
				}); 
	    	}

	    	console.log('handshake confirmed');

	    	//check if any photo/video imports, if so, initialize delivery for file transfer
	    	for(var i in config.imports){
	    		if(config.imports[i].type == "photo" || config.imports[i].type == "timelapse" || config.imports[i].type == "video"){
	    			console.log('\n\n\nINITIALIZING DELIVERY');
	    			delivery = dl.listen( socket );
					delivery.connect();

					delivery.on('delivery.connect',function(delivery){
						console.log('delivery ready');
					    DELIVERY_READY = true;
					    delivery = delivery;
					});
					break;
	    		}
	    	}

	    	console.log('\n\n\nINITIALIZING IMPORTS');
	    	//initialize sensors
	    	initImports();

	    	console.log('imports initialized');
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

		for(var i in buffer.imports){
			if(buffer.imports[i].type == "photo" || buffer.imports[i].type == "timelapse"){
				if(DELIVERY_READY == true){
					for(var p in buffer.imports[i].values){
					
						console.log("\n\n***SENDING PHOTO AT: ");
						console.log('.' + PHOTO_FILEPATH_NAME + buffer.imports[i].values[p].value);
						console.log('\n\n');
						
					    delivery.send({
					    	name: buffer.imports[i].values[p].value,
					    	path : '.' + PHOTO_FILEPATH_NAME + buffer.imports[i].values[p].value
					    });

					    delivery.on('send.start',function(filePackage){
					    	console.log('\n\nsend.start');
					      	FILE_PACKAGES[ filePackage.uid ] = filePackage.name;
					    });

					    delivery.on('send.success',function(uid){
					    	console.log('send.success with uid: '+ uid);

					    	if(typeof FILE_PACKAGES[ uid ] != 'undefined'){
					    		fs.unlinkSync(PHOTO_FILEPATH + FILE_PACKAGES[ uid ]);
					    		console.log('\n\n SUCCESS DELETING FILE at: ' + PHOTO_FILEPATH + FILE_PACKAGES[ uid ]);
					    		FILE_PACKAGES[ uid ] = undefined;
					    	}
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
* initImports
*
* Creates the controller objects for each sensor using
* Johnny-Five and the Raspberry Pi Camera protocols and
* stores an object with import name and this object in
* the machine object.
*
**/

function initImports(){
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
						    //kill the process if NaN is returned
						  	if(isNaN(value)){
						  		process.exit(1);
						  	}

						  	var attempts = 0;

						  	while(attempts < MAX_ATTEMPTS){
						  		if(buffer.busy == false){
						  			//console.log('pushing value: '+ value + ' into buffer import number: '+ i);

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
		    }else if(_import.source == "raspicam"){
		    	switch(_import.type){
		    		case "photo":
		    			console.log("INITIALIZING PHOTO IMPORT");
		    			
		    			var filename = _import.name + STRING_TOKEN + 
			    			'photo' + STRING_TOKEN + 
			    			new Date().getTime() + STRING_TOKEN + 
			    			_import.delay + STRING_TOKEN + 
			    			'1' + STRING_TOKEN + 
			    			'.' + _import.encoding;

				    	sensor = new RaspiCam({
				    		mode: _import.type,
							freq: _import.freq,
							encoding: _import.encoding,
							delay: _import.delay,
							filepath: PHOTO_FILEPATH,
							lifetime: FREQ * 10//photo will be deleted after this time passes
						});

						sensor.start();

						//create the sensor buffer
						buffer.imports[i] = {
							name: _import.name,
							type: _import.type,
							values: [] 
						};

						//set up event listeners to read values
						sensor.on("read", function( err, photoname ) {
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
						console.log("photo import ready");
						break;
					case "timelapse":
						console.log("INITIALIZING TIMELAPSE IMPORT");

						var filename = _import.name + STRING_TOKEN + 
							'timelapse' + STRING_TOKEN + 
							new Date().getTime() + STRING_TOKEN + 
							_import.freq + STRING_TOKEN + 
							'%d' + STRING_TOKEN + 
							'.' + _import.encoding;

						console.log('\n\n\nRaspiCam:');
						console.dir(RaspiCam);


						sensor = new RaspiCam({
				    		mode: _import.type,
							freq: _import.freq,
							encoding: _import.encoding,
							timeout: _import.timeout,
							filepath: PHOTO_FILEPATH,
							filename: filename
						});

						sensor.start();

						//create the sensor buffer
						buffer.imports[i] = {
							name: _import.name,
							type: _import.type,
							values: []
						};

						//set up event listeners to read values
						sensor.on("read", function( err, photoname ) {
						    console.log('app.js::timelapse read::photo taken with filename: '+ photoname);

						  	var attempts = 0;

						  	//try to register the photo MAX_ATTEMPTS times or timeout depending on business (semaphore) of buffer
						  	while(attempts < MAX_ATTEMPTS){
						  		if(buffer.busy == false){
						  			buffer.imports[i].values.push( {
								  		timestamp: new Date().getTime(),
								  		value: photoname
								  	});

								  	console.log('\n\n\nPHOTO FILENAME ADDED TO BUFFER: '+ photoname);

						  			attempts = MAX_ATTEMPTS;
						  		}else{
						  			attempts++;
						  		}
						  	}
						});
						console.log("timelapse import ready");
						break;
					case "video":
						//there's no reason I can think of to include video
						break;
					default:
						break;
				}
		    }

		    var machine_import = {
		    	name: _import.name,
		    	id: i,
		    	sensor: sensor
		    };

		    machine.imports.push( machine_import );
		})();//end anonymous function
	}//end master for loop
}
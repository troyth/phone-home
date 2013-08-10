//module dependencies
var io = require('socket.io-client')
	, five = require("johnny-five-plus-raspicam")
	, extend = require('util')._extend;

//load and parse the machine.json config file
var config = require('./machine');

//a variable that describes the attributes of the Raspberry Pi that this code is running on
var machine = {};
machine.name = config.name;
machine.imports = [];

//a buffer to store the sensor values between emissions to the server
var buffer = {
	busy: false,
	imports: []
};


//reporting frequency in ms - the higher the number, the less frequent updates can be sent from machines - will be set upon confirmation from server
var FREQ = -1;

var REPORT_INTERVAL_ID;

//maximum attempts to try to write to a busy buffer
var MAX_ATTEMPTS = 5;

var IMAGE_FILEPATH = __dirname + '/images/';

//initialize socket globally so other functions can emit events
var socket;


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

	    //send configuration as handshake initialization to the Louis server
	    socket.emit('config', config);

	    //listener for the Louis handshake confirmation
	    socket.on('confirm', function(confirm){
	    	console.log('handshake confirmed');
	    	machine.id = confirm.id;
	    	FREQ = confirm.freq;

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
		
		socket.emit('report', {
			id: machine.id,
			timestamp: new Date().getTime(),
			imports: buffer.imports
		});

		for(var i in buffer.imports){
			buffer.imports[i].values = [];
		}
		buffer.busy = false;

		console.log('just reported!');

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
	for(var i in config.imports){
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
					  			console.log('pushing value: '+ value + 'into buffer import number: '+ i);

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
			    	sensor = new five.RaspiCam({
			    		mode: _import.mode,
						freq: _import.freq,
						encoding: _import.encoding,
						delay: _import.delay,
						filepath: IMAGE_FILEPATH,
						mode: _import.mode
					});

					//create the sensor buffer
					buffer.imports[i] = {
						name: _import.name,
						type: _import.type,
						values: [] 
					};

					//set up event listeners to read values
					sensor.on("read", function( err, imagepath ) {
					    //kill the process if NaN is returned
					  	if(isNaN(imagepath)){
					  		process.exit(1);
					  	}

					  	var attempts = 0;

					  	while(attempts < MAX_ATTEMPTS){
					  		if(buffer.busy == false){
					  			buffer.imports[i].values.push( {
							  		timestamp: new Date().getTime(),
							  		value: imagepath
							  	});

					  			attempts = MAX_ATTEMPTS;
					  		}else{
					  			attempts++;
					  		}
					  	}
					  });
					break;
				case "video":
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

	    buffer.imports.push(  );

	    machine.imports.push( machine_import );
	}
}
//module dependencies
var io = require('socket.io-client')
	, five = require("johnny-five")
	, extend = require('util')._extend;

//load and parse the machine.json config file
var config = require('./machine');

//connect to the Louis server using socket.io
var socket = io.connect(config.server, {reconnect: true});

//a variable that describes the Raspberry Pi that this code is running on
var machine = {};
machine.name = config.name;
machine.imports = [];

//a buffer to store the sensor values between emissions to the server
var buffer = {
	busy: false,
	imports: []
};

var temp_buffer = {
	dirty: false,
	imports: []
};

//reporting frequency in ms - the higher the number, the less frequent updates can be sent from machines - will be set upon confirmation from server
var FREQ = -1;

var REPORT_INTERVAL_ID;

//maximum attempts to try to write to a busy buffer
var MAX_ATTEMPTS = 5;

var IMAGE_FILEPATH = __dirname + '/images/';

//instantiate the Johnny-Five board object
var board = new five.Board();

//listen for the server connection
socket.on('connect', function() { 
    console.log('Connected!');

    socket.emit('config', config);

    socket.on('confirm', function(confirm){
    	console.log('confirmed!');
    	machine.id = confirm.id;
    	FREQ = confirm.freq;

    	loadImports();

    	report();
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
	setTimeout(function(){
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
	}, FREQ);
}

/**
*
* loadImports
*
* Creates the controller objects for each sensor using
* Johnny-Five and the Raspberry Pi Camera protocols and
* stores an object with import name and this object in
* the machine object.
*
**/

function loadImports(){
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
	    	sensor = new five.RaspiCam({
				freq: 2000,
				length: 18000,
				filepath: IMAGE_FILEPATH,
				mode: 'still'
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
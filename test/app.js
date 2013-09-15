var home = require("phone-home")
	, machine = require('./machine');//machine.json

/**
*
* Initialize all sensors and actuators in machine.json
* 
* Uses machine.json to load handlers (eg. Johnny-Five, node-raspicam, etc)
* and initialize listeners and create objects (eg. sensors, cameras) in communicator
*
* Triggers "ready" event when complete
*
**/
var communicator = new home.Communicator( machine );


/**
*
* Begin the app
*
**/
communicator.on("ready", function(){

	/**
	*
	* Additional setup and bindings for each sensor and actuator
	*
	**/
	//cycle through inputs to bind listeners and make changes individually
	for(var input in phone_home.inputs){
		switch( phone_home.inputs[input].source){
			case "johnny-five":

				break;
		}
	}

	//cycle through outputs to bind listeners and make changes individually
	for(var output in phone_home.outputs){

	}


	/**
	*
	* Start sending reports to the server and driving actuators based on logic
	* above and signals from the server
	*
	**/
	phone_home.start();


});
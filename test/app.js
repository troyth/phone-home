var phone_home = require("phone-home");

/**
*
* Initialize all sensors and actuators in machine.json
* 
* Uses machine.json to load handlers (eg. Johnny-Five, node-raspicam, etc)
* and initialize listeners and create objects (eg. sensors, cameras)
*
* Triggers "ready" event on phone_home when complete
*
**/
phone_home.init();


/**
*
* Begin the app
*
**/
phone_home.on("ready", function(){

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
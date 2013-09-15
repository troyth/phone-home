#Phone Home

A Node.js app for connecting physical inputs and outputs - sensors and actuators - to a server using primarily Web Sockets. Phone Home is built to be run on a Raspberry Pi running Node.js and paired with the [Louis](https://github.com/troyth/louis) server.

__Note: below describes more of a roadmap than the current implementation. It will be updated shortly. Comments are welcome.__



## Ambition

The general scenario is this: design and build an object - a chair, a table, a door, a wall, a floor - and fit it out with an array of sensors and actuators. Then deploy it in physical space (eg. a room, a public square, anywhere with wifi). Now what? Connect it to the cloud, to a server that can log the values of your sensors, and store the binaries of, say, photos and audio you will record. That server, [Louis](https://github.com/troyth/louis) if you follow the convention here, has an API, so you can build apps on top of it that will connect your object to other objects. Through the same connection you used to beam up your data, you can beam down commands to the actuators in your object. Now you have the pieces of an architectural symphony, you just have to orchestrate it.

Phone Home is the part that lets you send your object into the world have it just work, automatically. That is, you will pre-program it, using the protocols that allow Phone Home to talk to the Louis server, so that all you need to do is connect it to wifi, and it will start streaming to the cloud.



## Approach

The approach borrows from Node.js modular conventions like `package.json`, to define modules, or `component.json` to determine components. Here, we use `machine.json` to define the core parameters of your, well, machine.

The `autostart.sh` file is a shell script (yet to be implemented!) that will run the `app.js` file of Phone Home upon boot up of the Raspberry Pi. First, the app fires up a Web Socket connection to the server (_not currently the case, but I'm changing this soon_), then it completes a handshake with the Louis server sending the relevant `machine.json` information and any security protocol (eg. password).

Once the handshake is complete, the Phone Home app looks at the `machine.json` file to see which types of sensors and actuators it needs to construct, and if it needs to initialize [Delivery.js](https://github.com/liamks/Delivery.js) for binary file transfer. Finally, when it begins to receive sensor values, it stores them in a buffer object. Depending on the frequency specified by the Louis server in the handshake, it sends the buffered values through the Web Socket and also any collected binary files with Delivery.js every Nms. The Louis server is calibrated to listen for and collect this information in a database.



## machine.json

Phone Home relies heavily on the `machine.json` file that specifies the id of a machine (typically a Raspberry Pi connected to an array of sensors and actuators) that wishes to stream its data to a particular server. At the top level, it includes the machine `name`, the (Louis) `server` IP or web address, and `inputs` and `outputs`. For example:

	{
		"name": "my_machine_001",
		"server": "http://api.server.com:3001",
		"imports": {},
		"exports": {}
	}


Each input (sensors) and output (actuators) is identified by a `name` attribute. The initialization script contructs specific types of objects for each primarily based on the `source` and `payload` attributes.


### Source Types

The `source` parameter refers to the input module that will provide the sensor data. It can take the following values:

*	`johnny-five` refers to data coming from a sensor connected to an Arduino paired with the Raspberry Pi through a serial port running through the [Johnny-Five](https://github.com/rwaldron/johnny-five) module.
*	`raspicam` refers to images and videos coming from a Raspberry Pi camera using the [Raspicam](https://github.com/troyth/node-raspicam) module.

Additional source types will be added with time, such as bytestreams from a USB mic, etc.


### Payload Types

The `payload` parameter determines the transport mechanism. It can take the following values:

*	`serial` is data that can be serialized and sent via a Web Socket to the server
*	`binary` is binary data that is currently transported using [Delivery.js](https://github.com/liamks/Delivery.js)


### Additional Parameters

*	`name` (required) is the name that will be stored in the server database for the sensor/actuator
*	`type` augments the source and payload types, taking values such as `analog` or `digital` for Johnny-Five connected sensors, or `timelapse` or `video` for a Raspberry Pi camera
*	`params` is an object with parameters that will be passed to the sensor/actuator constructor; these depend on the sensor type and its source


## Example

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
		for(var in in phone_home.inputs){

		}

		//cycle through outputs to bind listeners and make changes individually
		for(var out in phone_home.outputs){

		}

		/**
		*
		* Start sending reports to the server and driving actuators based on logic
		* above and signals from the server
		*
		**/
		phone_home.start();

	});


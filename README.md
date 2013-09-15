#Phone Home

A Node.js app for connecting physical inputs and outputs - sensors and actuators - to a server using primarily Web Sockets. Phone Home is built to be run on a Raspberry Pi running Node.js and paired with the [Louis](https://github.com/troyth/louis) server.

__Note: below describes more of a roadmap than the current implementation. It will be updated shortly. Comments are welcome.__



## Ambition

The general scenario is this: design and build an object - a chair, a table, a door, a wall, a floor - and fit it out with an array of sensors and actuators. Then deploy it in physical space (eg. a room, a public square, anywhere with wifi). Now what? Either connect it to the cloud or directly to other objects on the same local network.

The [Louis](https://github.com/troyth/louis) server was designed to connect to Phone Home over Web Sockets in order to log the values of your sensors, store binary files (eg. photos, video, audio, etc.), perform complex analysis, and send back signals to trigger actuators. Louis also has a Web Sockets API and an HTTP API so you can build apps on top of it that will connect your object to other objects with apps ("programs" in a more architecture-friendly language) that will determine and distribute outputs based on inputs, as well as on the physical configuration of the space itself.

Phone Home has an autostart shell script, so when you deploy your Raspberry Pi enabled objects anywhere in the world, all you have to do is power them on, provide a wifi signal, and your objects will automatically initialize and begin to connect to the server.


## Approach

The approach borrows from Node.js modular conventions like `package.json`, to define modules, or `component.json` to determine components. Here, we use `machine.json` to define the core parameters of your, well, machine.

The `autostart.sh` file is a shell script (yet to be implemented!) that will run the `app.js` file of Phone Home upon boot up of the Raspberry Pi. First, the app fires up a Web Socket connection to the server (_not currently the case, but I'm changing this soon_), then it completes a handshake with the Louis server sending the relevant `machine.json` information and any security protocol (eg. password).

Once the handshake is complete, the Phone Home app looks at the `machine.json` file to see which types of sensors and actuators it needs to construct, and if it needs to initialize [Delivery.js](https://github.com/liamks/Delivery.js) for binary file transfer. Finally, when it begins to receive sensor values, it stores them in a buffer object. Depending on the frequency specified by the Louis server in the handshake, it sends the buffered values through the Web Socket and also any collected binary files with Delivery.js every Nms. The Louis server is calibrated to listen for and collect this information in a database.

## Communicator

The communicator is the principal object abstraction provided by Phone Home (similar to the Board object provided by Johnny-Five). It is named for the [communicator](http://antoinebertin.tumblr.com/post/26215160310/the-e-t-communicator-was-connected-to-tree) in the 1982 film, [E.T.](http://www.imdb.com/title/tt0083866/), which was an assembly of many sensors, actuators and displays to help E.T. phone home.

![E.T.\'s communicator](http://upload.wikimedia.org/wikipedia/commons/4/4c/ET_Communicator_Cropped.jpg)

The communicator consists of a single Rasberry Pi running Node.js and connected to any number of sensors and actuators allowing a physical object to collect information from its environment and pass it on to a server, and to affect it's environment by triggering its actuators from either local logic or commands from a server.



## machine.json

Phone Home relies heavily on the `machine.json` file that specifies the id of a machine (typically a Raspberry Pi connected to an array of sensors and actuators) that wishes to stream its data to a particular server. At the top level, it includes the machine `name`, the (Louis) `server` IP or web address, and `inputs` and `outputs`. For example:

	{
		"name": "my_machine_001",
		"server": "http://api.server.com:3001",
		"inputs": {},
		"outputs": {}
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


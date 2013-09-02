#Phone Home

A Node.js app for connecting physical inputs and outputs - sensors and actuators - to a server using primarily Web Sockets. Phone Home is built to be run on a Raspberry Pi running Node.js and paired with the [Louis](https://github.com/troyth/louis) server.

__Note: below describes more of a roadmap than the current implementation. It will be updated shortly. Comments are welcome.__


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


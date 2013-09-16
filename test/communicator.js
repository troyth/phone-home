var home = require("../lib/phone-home"),
	machine = require('./machine');//machine.json

var communicator = new home.Communicator({
	machine: machine,
	debug: true
});


exports["static"] = {
	"Communicator": function( test ){
		test.expect(1);
		test.ok( communicator , "Communicator()");
		test.done();
	},
	"Communicator.ready": function( test ){
		test.expect(1);
		console.log('testing');

		var ready = false;
		communicator.on("ready", function(){
			ready = true;
			console.log('ready!!!');
		});

		setTimeout(function(){
			test.ok(ready, "Communicator.ready");
			test.done();
		}, 1500);

		

		
	}

};

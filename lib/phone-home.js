/*
 * phone-home
 * https://github.com/troyth/phone-home
 *
 * Copyright (c) 2013 Troy Conrad Therrien <troyth@gmail.com>
 * Licensed under the MIT license.
 */
var es6 = require("es6-collections");


[
  "Communicator"
].forEach(function( constructor ) {
  module.exports[ constructor ] = require(
    "../lib/" + constructor.toLowerCase()
  );
});
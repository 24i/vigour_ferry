var pliant = require('pliant')
	, config = require("./config")
	, packer = require('./launcher')

module.exports = exports = pliant.fn(config, packer)
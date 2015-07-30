var temp = require('./temp')
	, pkg = require('./package.json')
	, config = require("./config")
	, packer = require('./launcher')

module.exports = exports = temp.makeModule(pkg, config, packer)
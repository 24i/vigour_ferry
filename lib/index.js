var pliant = require('vigour-pliant')
var config = require('./config')
var packer = require('./launcher')

module.exports = exports = pliant.fn(config, packer)

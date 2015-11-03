#!/usr/bin/env node

var pliant = require('vigour-pliant')
var config = require('../lib/config')
var packer = require('../lib/launcher')

pliant.bin(config, packer)

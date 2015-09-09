#!/usr/bin/env node

var pliant = require('pliant')
var config = require('../config')
var packer = require('../launcher')

pliant.bin(config, packer)

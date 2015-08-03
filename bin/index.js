#!/usr/bin/env node

var pliant = require('pliant')
	, config = require("../config")
	, packer = require('../launcher')

pliant.bin(packer, config)
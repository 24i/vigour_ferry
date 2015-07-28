#!/usr/bin/env node

var temp = require('./temp')
	, pkg = require('../package.json')
	, config = require("../config")
	, packer = require('..')

temp.doIt(pkg, config, packer)
#!/usr/bin/env node

var temp = require('../temp')
	, pkg = require('../package.json')
	, config = require("../config")
	, packer = require('../launcher')

temp.makeBin(pkg, config, packer)
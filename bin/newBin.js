#!/usr/bin/env node

var path = require('path')
	, program = require('commander')
	, Promise = require('promise')
	, fs = require('vigour-fs')
	, VObj = require('vigour-js/object')
	, flatten = require('vigour-js/util/flatten')
	, config = require("../newConfig")
	, pkg = require('../package.json')
	, packer = require('..')
	, readFile = Promise.denodeify(fs.readFile)
	, opts = new VObj({})
	, defaults = {}
	, files = {}
	, env = {}
	, cli = {}
	, finale = {}
	, files = []
	, key
	, isConfig
	, defaultEntry
	,	envEntry
	, cliEntry
	, value
	, lastKeySeen // TODO: Allow multiple isConfig keys
	, tags = {}	


program	
	.version(pkg.version)
	.usage("[options]")


for (key in config.items) {
	isConfig = config.items[key].isConfig

	defaultEntry = config.items[key].d
	if (defaultEntry) {
		// console.log("d", key, defaultEntry)
		set(defaults, key, defaultEntry, "defaults")
		isConfig && addConfig(key, defaultEntry)
	}

	envEntry = config.items[key].env
	if (envEntry) {
		value = process.env[envEntry]
		if (value) {
			// console.log('env', key, value)
			set(env, key, value, "env")
			isConfig && addConfig(key, value)
		}
	}

	cliEntry = config.items[key].cli
	if (cliEntry) {
		program.option(cliEntry
			, config.items[key].desc)	
	}
}
program.parse(process.argv)

for (key in config.items) {
	isConfig = config.items[key].isConfig

	cliEntry = config.items[key].cli
	getter = config.items[key].getter
	if (cliEntry) {
		if (getter) {
			value = program[getter]
			if (value) {
				// console.log('cli', key, value)
				set(cli, key, value, "cli")
				isConfig && addConfig(key, value)
			}	
		} else {
			throw new Error("No getter")
		}
	}
}

function addConfig (k, v) {
	lastKeySeen = k
	files = files.concat(v
		.split(","))
}

set(finale, lastKeySeen, files, "finale")
files.reduce(function (prev, curr, indx, arry) {
	return prev.then(function (p) {
		return readFile(curr, 'utf8')
			.catch(function (reason) {
				console.error("Can't read file", curr)
			})
			.then(function (data) {
				p.merge(JSON.parse(data))
				return p
			})
			.catch(function (reason) {
				console.error("Can't parse or merge", curr)
			})
	})
}, Promise.resolve(new VObj({})))
	.then(function (fileConf) {
		var flat
			, key
		opts.merge(defaults)
		// console.log("defaults", defaults)
		opts.merge(fileConf.raw)
		// console.log("fileConf.raw", fileConf.raw)
		opts.merge(env)
		// console.log("env", env)
		opts.merge(cli)
		// console.log("cli", cli)
		opts.merge(finale)
		// console.log("finale", finale)
		// console.log('CONFIG', opts.raw)
		console.log("-", tags)
		flat = flatten((opts.raw).vigour)
		for (key in flat) {
			if (tags[key]) {
				// console.log(tags[key], key, flat[key])
			} else {
				// console.log("file", key, flat[key])
			}
		}
		// packer(opts.raw)
	})
	.catch(console.error)

function set (o, k, v, tag) {
	var parts = k.split(".")
		, l = parts.length
		, i
		, ref = o
	tags[k] = tag
	for (i = 0; i < l - 1; i += 1) {
		if (!ref[parts[i]]) {
			ref[parts[i]] = {}
		}
		ref = ref[parts[i]]
	}
	ref[parts[i]] = v
}
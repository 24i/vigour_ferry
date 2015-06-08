#!/usr/bin/env node

var path = require('path')
	, program = require('commander')
	, Promise = require('promise')
	, fs = require('vigour-fs')
	, VObj = require('vigour-js/object')
	, flatten = require('vigour-js/util/flatten')
	, config = require("../config")
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
	, tag


program	
	.version(pkg.version)
	.usage("[options]")


for (key in config.items) {
	isConfig = config.items[key].isConfig

	defaultEntry = config.items[key].d
	if (defaultEntry) {
		set(defaults, key, defaultEntry)
		isConfig && addConfig(key, defaultEntry)
	}

	envEntry = config.items[key].env
	if (envEntry) {
		value = process.env[envEntry]
		if (value) {
			set(env, key, value, "env clobbers")
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
				set(cli, key, value, "cli clobbers")
				isConfig && addConfig(key, value)
			}	
		} else {
			throw new Error("No getter")
		}
	}
}

if (lastKeySeen) {
	set(finale, lastKeySeen, files.join(","))	
}

files.reduce(function (prev, curr, indx, arry) {
	return prev.then(function (p) {
		return readFile(path.join(process.cwd(), curr), 'utf8')
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
		opts.merge(fileConf.raw)
		opts.merge(env)
		opts.merge(cli)
		opts.merge(finale)
		flat = flatten(opts.raw, ".")
		for (key in tags) {
			console.log(tags[key], key, flat[key])
		}

		packer(opts.raw)
	})
	.catch(function (reason) {
		console.error("Oops", reason, reason.stack)
	})

function set (o, k, v, tag) {
	var parts = k.split(".")
		, l = parts.length
		, i
		, ref = o
	if (tag) {
		tags[k] = tag
	}	
	for (i = 0; i < l - 1; i += 1) {
		if (!ref[parts[i]]) {
			ref[parts[i]] = {}
		}
		ref = ref[parts[i]]
	}
	ref[parts[i]] = v
}

function addConfig (k, v) {
	lastKeySeen = k
	files = files.concat(v
		.split(","))
}
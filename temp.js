var path = require('path')
	, program = require('commander')
	, Promise = require('promise')
	, log = require('npmlog')
	, fs = require('vigour-fs')
	, VObj = require('vigour-js/object')
	, flatten = require('vigour-js/util/flatten')
	, readFile = Promise.denodeify(fs.readFile)
	, opts = new VObj({})
	, defaults = {}
	, env = {}
	, cli = {}
	, finale = {}
	, files = []
	, lastKeySeen // TODO: Allow multiple isConfig keys
	, tags = {}
	, tag

module.exports = exports = {}

exports.makeModule = function (pkg, config, packer) {
	return function (options) {
		prepConfig(config)
		addFinale()
		return reduceFiles()
			.then(function (fileConf) {
				var flat
					, key
				opts.merge(defaults)
				opts.merge(fileConf.raw)
				opts.merge(options)
				opts.merge(finale)
				flat = flatten(opts.raw, ".")
				for (key in tags) {
					log.info(tags[key], key, flat[key])
				}

				return opts.raw
			})
			.then(function (opts) {
				return packer(opts)
			})	
	}
}

exports.makeBin = function (pkg, config, packer) {
	var key
		, isConfig
		, value
		, cliEntry
		, getter
	program	
		.version(pkg.version)
		.usage("[options]")

	prepConfig(config, true, true)
	
	program.parse(process.argv)

	for (key in config.items) {
		isConfig = config.items[key].isConfig

		cliEntry = config.items[key].cli
		getter = config.items[key].getter
		if (cliEntry) {
			if (getter) {
				value = program[getter]
				if (cliEntry.indexOf("--no-") === 0) {
					if (!value) {
						set(cli, key, value, "cli clobbers")
					}
				} else {
					if (value) {
						set(cli, key, value, "cli clobbers")
						isConfig && addConfig(key, value)
					}
				}
			} else {
				throw new Error("No getter")
			}
		}
	}

	addFinale()

	reduceFiles(true, true)
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
				log.info(tags[key], key, flat[key])
			}

			return opts.raw
		})
		.then(function (opts) {
			packer(opts)
		})
}

function prepConfig (config, doEnv, doCli) {
	var defaultEntry
		, key
		, isConfig
		,	envEntry
		, value
		, cliEntry
	for (key in config.items) {
		isConfig = config.items[key].isConfig

		defaultEntry = config.items[key].d
		if (defaultEntry) {
			set(defaults, key, defaultEntry)
			isConfig && addConfig(key, defaultEntry)
		}

		if (doEnv) {
			envEntry = config.items[key].env
			if (envEntry) {
				value = process.env[envEntry]
				if (value) {
					set(env, key, value, "env clobbers")
					isConfig && addConfig(key, value)
				}
			}
		}

		if (doCli) {
			cliEntry = config.items[key].cli
			if (cliEntry) {
				program.option(cliEntry
					, config.items[key].desc)	
			}
		}
	}
}

function addFinale () {
	if (lastKeySeen) {
		set(finale, lastKeySeen, files.join(","))	
	}
}

function reduceFiles (doEnv, doCli) {
	return files.reduce(function (prev, curr, indx, arry) {
		return prev.then(function (p) {
			return readFile((path.isAbsolute(curr)
					? curr
					: path.join(process.cwd(), curr))
				, 'utf8')
				.then(function (data) {
					p.merge(JSON.parse(data))
					return p
				}
				, function (reason) {
					log.warn("Can't read file", curr)
					return p
				})
				.catch(function (reason) {
					log.error("Can't parse or merge", curr)
				})
		})
	}, Promise.resolve(new VObj({})))
		.catch(function (reason) {
			log.error("Oops", reason, reason.stack)
		})
}

function set (obj, key, val, tag) {
	var parts = key.split(".")
		, l = parts.length
		, i
		, ref = obj
	if (tag) {
		tags[key] = tag
	}	
	for (i = 0; i < l - 1; i += 1) {
		if (!ref[parts[i]]) {
			ref[parts[i]] = {}
		}
		ref = ref[parts[i]]
	}
	ref[parts[i]] = val
}

function addConfig (key, val) {
	lastKeySeen = key
	files = files.concat(val
		.split(","))
}
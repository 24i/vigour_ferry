var https = require('https')
	, proc = require('child_process')
	, path = require('path')

	, log = require('npmlog')
	, Promise = require('promise')
	, Blake = require('blake2s')
	, fs = require('vigour-fs')
	, vConfig = require('vigour-js/util/config')
	, hash = require('vigour-js/util/hash')
	, State = require('./State')
	, packerUtil = require('./packerUtil')
	, helpers = require('./helpers')
	, Transformer = require('./Transformer')
	, ShaHistory = require('./ShaHistory')
	, shaHistory

	, read = Promise.denodeify(fs.readFile)
	, write = Promise.denodeify(fs.writeFile)
	, mkdirp = Promise.denodeify(fs.mkdirp)
	, readdir = Promise.denodeify(fs.readdir)
	, remove = Promise.denodeify(fs.remove)
	, exists = function (path) {
		return new Promise(function (resolve, reject) {
			fs.exists(path, resolve)
		})
	}
	, transformer
	, state

module.exports = exports = Version

function Version (sha, config) {
	var self = this
	transformer = new Transformer(config)
	shaHistory = new ShaHistory(config)
	self.config = config
	self.sha = sha
	state = new State(config)
	self.root = path.join(self.config.assetRoot, self.config.shaDir, self.sha)
	self.packagePath = path.join(self.root
		, 'package.json')
	self.manifestPath = path.join(self.root
		, self.config.buildDir
		, 'manifest.json')
	self.appCacheManifestPath = path.join(self.root
		, self.config.buildDir
		, 'manifest.appcache')
	self.getManifest = helpers.getter(function () {
		log.info("Creating manifest")
		return self.getPkg()
			.then(function (pkg) {
				return self.makeManifest(pkg)
			})
			.catch(state.log("Can't make manifest"))
			.then(function (manifest) {
				return mkdirp(self.manifestPath.slice(0
					, self.manifestPath.lastIndexOf('/')))
					.then(function () {
						return manifest
					})
			})
			.then(function (manifest) {
				return write(self.manifestPath, manifest, 'utf8')
			})
			.catch(state.log("Can't write manifest"))
			.then(function () {
				return self.manifestPath
			})
	})

	self.getAppCacheManifest = helpers.getter(function () {
		log.info("Creating app cache manifest")
		return self.getPkg()
			.then(function (pkg) {
				return self.makeAppCacheManifest(pkg)
			})
			.catch(state.log("Can't make app cache manifest"))
			.then(function (acm) {
				return mkdirp(self.appCacheManifestPath.slice(0
					, self.appCacheManifestPath.lastIndexOf('/')))
					.then(function () {
						return acm
					})
			})
			.then(function (acm) {
				return write(self.appCacheManifestPath, acm, 'utf8')
			})
			.catch(state.log("Can't write app cache manifest"))
			.then(function () {
				return self.appCacheManifestPath
			})
	})

	self.getPkg = helpers.getter(function () {
		log.info("Creating pkg")
		return read(self.packagePath, 'utf8')
			.then(function (str) {
				var parsed = JSON.parse(str)
				parsed.sha = self.sha
				parsed.repository.branch = self.config.git.branch
				if (self.config.git.branch === "dev") {
					parsed.version = helpers.hNow()
						+ " "
						+ "(" + self.sha + ")"
				}
				vConfig.parse(parsed.vigour
					, parsed
					, [{ 'repository.branch': 'branches' }])
				return parsed
			})
	})

	self.get = helpers.getter(function () {
		return exists(self.root)
			.then(function (exists) {
				var dl
				if (exists) {
					log.info("We already have", self.sha)
					return self.archive()
						.catch("Can't archive")

				} else {
					dl = self.download()
					dl.catch(state.log("Can't download"))
						.then(self.cleanup.bind(self))
						.catch(state.log("Can't clean up"))
						.then(self.archive.bind(self))
						.catch(state.log("Can't archive"))
					return dl
				}
			})
	})
}

Version.prototype.prep = function () {
	var self = this
	log.info("Preparing", self.sha)
	return self.get()
		.catch(state.log("Can't get version"))
		.then(function () {
			return self.getAppCacheManifest()
		})
		.catch(state.log("Can't create app cache manifest"))
		.then(function () {
			return self.getManifest()
		})
		.catch(state.log("Version.getManifest() fails"))
}

Version.prototype.getAsset = function (file, params, shaRequest, quiet) {
	var self = this
	return self.getPkg()
		.catch(state.log("Can't get pkg"))
		.then(function (pkg) {
			var allTransforms = pkg.vigour.packer.transforms || {}
				, transforms
			if (file.indexOf('/') === 0) {
				file = file.slice(1)
			}
			if (file === "") {
				file = pkg.vigour.packer.web
			}
			if (!quiet) {
				log.info("Getting ", file)
			}
			transforms = (file in allTransforms)
				? allTransforms[file]
				: false

			if (transforms) {
				if (!quiet) {
					log.info("Getting transform", file, transforms, params)
				}
				return self.getTransformed(file
					, transforms
					, params
					, shaRequest)
			} else {
				return path.join(self.root, file)
			}
		})
		.catch(state.log("Can't get transformed"))
}

Version.prototype.getTransformed = function (file, transforms, params, shaRequest) {
	var self = this
		, l = transforms.length
		, i
		, id = ""
		, toSave = {}
		, required
		, nb
		, j
		, originalPath
		, transformedPath
	for (i = 0; i < l; i += 1) {
		required = transformer[transforms[i]].params
		nb = required.length
		for (j = 0; j < nb; j += 1) {
			id += params[required[j]]
			toSave[required[j]] = params[required[j]]
		}
	}
	id = hash(id)
	originalPath = path.join(self.root, file)
	transformedPath = originalPath
		+ '_'
		+ id
		+ path.extname(file)
	return exists(transformedPath)
		.catch(state.log("Can't call exists"))
		.then(function (exists) {
			var p
			if (exists) {
				transformer.history.save(file, id, toSave)
				return transformedPath
			} else {
				p = read(originalPath, 'utf8')
					.then(function (data) {
						return self.getPkg()
							.then(function (pkg) {
								return transformer.transform(data
									, transforms
									, params
									, pkg)
							})
					})
					.then(function (newData) {
						if (newData.length === 0) {
							throw new Error("transformed file data has a size of 0")
						}
						return write(transformedPath, newData, 'utf8')
					})
					.then(function () {
						transformer.history.save(file, id, toSave)
						return transformedPath
					})
				// if (shaRequest) {
				//	return false
				// } else {
					return p
				// }
			}
		})
		.catch(state.log("Can't get transformed "))
}

Version.prototype.replayTransforms = function () {
	var self = this
	transformer.history.get()
		.catch(state.log("Can't get transform history"))
		.then(function (history) {
			self.getPkg()
				.catch(state.log("Can't get pkg"))
				.then(function (pkg) {
					var file
						, id
						, params
						, arr = []
					for (file in history) {
						if (pkg.vigour.packer.transforms[file]) {
							for (id in history[file]) {
								arr.push({
									file: file
									, params: history[file][id]
								})
							}
						}
					}
					arr.reduce(function (previous, current, index, array) {
							return previous.then(function () {
								return self.getAsset(current.file
									, current.params
									, undefined
									, true)
										.catch(state.log("Can't replay transform"))
							})
						}
						, Promise.resolve())
							.catch(state.log("Can't replay transforms"))
							.then(function () {
								log.info("Done replaying transforms")
							})
				})
		})
}

Version.prototype.makeAppCacheManifest = function (pkg) {
	var self = this
	return new Promise(function (resolve, reject) {
		var acm
		try {
			acm = "CACHE MANIFEST\n"
			acm += "#" + pkg.version + "\n"
			acm += pkg.vigour.packer.web + "\n"
			self.expandStars(pkg.vigour.packer.assets
				, self.root
				, function (err, extended) {
					if (err) {
						err.message += ": Error expanding stars"
						err.path = pkg.vigour.packer.assets
						reject(err)
						return
					}
					// Next
					assets = packerUtil.listify(extended)
					packerUtil.asyncForIn(assets
						, addAsset
						, function (err) {
							if (err) {
								reject(err)
								return
							}
							acm += "NETWORK:\n"
							acm += "*\n"
							resolve(acm)
						})
				})
			function addAsset (assets, asset, cb) {
				acm += asset + "\n"
				setTimeout(function () {
					cb(null)
				}, 0)
			}
		} catch (e) {
			console.error("Error", e)
			console.warn("Do you have `vigour.packer.web` and `vigour.packer.assets` in you package.json?")
		}
	})
}

Version.prototype.makeManifest = function (pkg) {
	var self = this
	return new Promise(function (resolve, reject) {
		var manifest = {
				commitHash: pkg.sha
				, assets: {

				}
			}
		manifest.main = pkg.vigour.packer.main
		manifest.version = pkg.version
		self.expandStars(pkg.vigour.packer.assets
			, self.root
			, function (err, extended) {
				if (err) {
					err.message += ": Error expanding stars"
					err.path = pkg.vigour.packer.assets
					reject(err)
					return
				}
				// Next
				assets = packerUtil.listify(extended)
				packerUtil.asyncForIn(assets
					, addAsset
					, function (err) {
						var manifestStr
						if (err) {
							reject(err)
							return
						}
						try {
							manifestStr = JSON.stringify(manifest)
						} catch (e) {
							e.message += ": Error stringifying manifest"
							reject(e)
							return
						}
						// Next
						resolve(manifestStr)
					})
			})

		function addAsset (assets, asset, cb) {
			fs.readFile(path.join(self.root, asset), function (err, data) {
				if (err) {
					cb(err)
				} else {
					blake = new Blake(32)
					blake.update(data)
					insertAsset(manifest.assets, asset, blake.digest('hex'))
					cb(null)
				}
			})
		}

		function insertAsset (obj, assetPath, hashed) {
			var ref = obj
				, parts = assetPath.split('/')
				, name = parts.pop()
				, part
			while(part = parts.shift()) {
				if (!ref[part]) {
					ref[part] = {}
				}
				ref = ref[part]
			}
			ref[name] = hashed
		}
	})
}

Version.prototype.archive = function () {
	var self = this
		, mustErase = false
	log.info('Archiving sha')
	return shaHistory.get()
		.catch(state.log("Can't archive sha"))
		.then(function (history) {
			if (history.indexOf(self.sha) === -1) {
				history.push(self.sha)
			}
			while (history.length >= self.config.maxHistory) {
				mustErase = true
				history.shift()
			}
			if (mustErase) {
				self.removeShas(history)
			}
			return history
		})
		.then(function (newHistory) {
			shaHistory.save(newHistory)
		})
}

Version.prototype.removeShas = function (history) {
	var self = this
	return readdir(path.join(self.config.assetRoot
			, self.config.shaDir))
		.catch(state.log("Can't read shas directory"))
		.then(function (files) {
			var toErase = files.filter(function (item) {
					return item !== '.gitignore'
						&& history.indexOf(item) === -1
				})
			return Promise.all(
				toErase.map(function (item) {
					return remove(path.join(self.config.assetRoot
							, self.config.shaDir
							, item))
						.catch(state.log("Can't remove obsolete sha"))
				})
			)
		})
}

Version.prototype.download = function () {
	var self = this
	log.info("Downloading version", self.sha)
	return new Promise(function (resolve, reject) {
		log.info("Checking GitHub for existance of", self.sha)
		var options
		if (self.sha === '_local') {
			resolve(self.getLocal())
		} else {
			options = {
				hostname: self.config.git.api.hostname
				, path: '/' + path.join('repos'
					, self.config.git.owner
					, self.config.git.repo
					, 'git'
					, 'commits'
					, self.sha)
				, headers: self.config.git.api.headers
				, method: 'HEAD'
			}
			req = https.request(options
				, function (res) {
					var error
					res.on('error', reject)
					if (res.statusCode !== 200) {
						error = new Error(
							"GitHub doesn't return 200 for this sha")
						error.sha = self.sha
						error.statusCode = res.statusCode
						error.invalidRequest = true
						error.options = options
						return reject(error)
					}
					resolve(self.clone())
				})
			req.on('error', reject)
			req.end()
		}
	})
}

Version.prototype.getLocal = function () {
	var self = this
	log.info(helpers.hNow() + " Copying ", self.config.src)
	return new Promise(function (resolve, reject) {
		log.info("heapUsed: ", process.memoryUsage().heapUsed)
		sh('cp -fR '
				+ self.config.src
				+ ' '
				+ self.sha
			, { cwd: path.join(self.config.assetRoot, self.config.shaDir) }
			, function (error, stdout, stderr) {
				log.info("heapUsed: ", process.memoryUsage().heapUsed)
				if (error) {
					console.log(stdout)
					console.error(stderr)
					reject(error)
				} else {
					log.info(helpers.hNow(), "Done cloning")
					resolve(stdout)
				}
			})
	})
}

Version.prototype.clone = function () {
	var self = this
	log.info(helpers.hNow() + " Cloning ", self.config.git.repo)
	return new Promise(function (resolve, reject) {
		log.info("heapUsed: ", process.memoryUsage().heapUsed)
		sh('git clone --depth=1 -b '
				+ self.config.git.branch
				+ ' '
				+ self.config.git.url
				+ ':'
				+ self.config.git.owner
				+ '/'
				+ self.config.git.repo
				+ '.git'
				+ ' '
				+ self.sha
			, { cwd: path.join(self.config.assetRoot, self.config.shaDir) }
			, function (error, stdout, stderr) {
				log.info("heapUsed: ", process.memoryUsage().heapUsed)
				if (error) {
					reject(error)
				} else {
					log.info(helpers.hNow(), "Done cloning")
					resolve(stdout)
				}
			})
	})
}

Version.prototype.cleanup = function () {
	var self = this
	log.info("Removing `.git` directory from", self.sha)
	return remove(path.join(self.root, '.git'))
}

Version.prototype.expandStars = function (src, rootPath, cb) {
	var acc = []
		, nbPending = 0
		, errors = []
	function traverse (obj) {
		var key
		for (key in obj) {
			acc.push(key)
			if (typeof obj[key] === 'object') {
				traverse(obj[key])
			} else if (obj[key] === '*') {
				nbPending += 1
				expand(obj, key, path.join(rootPath, acc.join('/')), expandDone)
			}
			acc.pop()
		}

		function expandDone (err) {
			nbPending -= 1
			done(err)
		}
	}

	traverse(src)
	done()

	function expand (obj, key, rootPath, callback) {
		fs.walk(rootPath, {
				exclude: /^\./
			}
			, function (err, tree) {
				obj[key] = tree
				callback(null)
			})
	}

	function done (err) {
		if (err) {
			errors.push(err)
		}
		if (nbPending === 0) {
			if (errors.length === 0) {
				cb(null, src)
			} else {
				cb(errors)
			}
		}
	}
}

function sh (command, opts, cb) {
	log.info('Executing `', command, '`\n\tCWD:', opts.cwd )
	
	// log.info('Setting UID to'
	//	, process.env.GIT_UID
	//	, "(" + typeof parseInt(process.env.GIT_UID, 10) + ")")
	// process.setuid(parseInt(process.env.GIT_UID, 10))
	proc.exec(command
		, { cwd: opts.cwd }
		, cb)
}
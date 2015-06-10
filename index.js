var https = require('https')
	, path = require('path')
	, repl = require('repl')
	, url = require('url')
	, btoa = require('btoa')
	, fs = require('vigour-fs')
	
	, express = require('express')
	, oboe = require('oboe')
	, compress = require('compression')
	, bodyParser = require('body-parser')
	, Promise = require('promise')
	, concat = require('concat-stream')
	, log = require('npmlog')
	, diskspace = require('diskspace')

	// , vCloud = require('vigour-js/browser/network/cloud')
	// 	.inject(require('vigour-js/browser/network/cloud/datacloud'))
	, flatten = require('vigour-js/util/flatten')
	, ajax = require('vigour-js/browser/network/ajax')
	, readFile = Promise.denodeify(fs.readFile)
	, remove = Promise.denodeify(fs.remove)
	, readdir = Promise.denodeify(fs.readdir)
	, cp = Promise.denodeify(fs.cp)
	
	, Version = require('./Version')
	, PrepQueue = require('./PrepQueue')
	, helpers = require('./helpers')
	, ShaHistory = require('./ShaHistory')
	, shaHistory
	, State = require('./State')
	, ErrorManager = require('./ErrorM')
	, error
	, serverPkg = require('./package.json')
	, git = require('./git')
	, config
	, state
	, prepQueue = new PrepQueue()
	, live
	, server
	, web
	, github
	, gitListener
	, latestNewSha
	, r

module.exports = exports = function (opts) {
	var self = this
		, action

	config = opts.vigour.packer

	if (config.cleanup) {
		action = cleanup
	} else if (config.release) {
		config.releaseRepo.name = config.git.repo
			+ config.releaseRepo.suffix
		config.releaseRepo.absPath = path.join(
			path.dirname(process.cwd())
			, config.releaseRepo.name)
		action = release
	} else if (config.deploy) {
		action = serve
	} else if (!config.src) {
		config.releaseRepo.name = config.git.repo
			+ config.releaseRepo.suffix
		config.git.api.headers.Authorization = "Basic "
			+ btoa(config.git.username
				+ ":"
				+ config.git.password)
	}

	if (action) {
		return action()
	}
	
	try {
		config.slack.pathPart = "/services/"
			+ config.slack.id
	} catch (e) {
		// log.warn("Slack config invalid", e, e.stack)
	}

	if (!config.git.branch) {
		config.git.branch = "master"
	}

	log.info("CONFIG", JSON.stringify(config, null, 2))

	web = express()
	github = express()
		
	
	error = new ErrorManager(config)
	state = new State(config)
	shaHistory = new ShaHistory(config)
	web.use(compress())
	// web.use(logRequest)
	web.use(getUA)
	web.get('/'
		, getSha
		, fbMeta
		, addHeaders
		, serveIndex
		, serveCode(500))
	web.post('/status'
		, bodyParser.urlencoded({
			extended: true
		})
		, serveStatus
		, serveCode(500))
	web.get('/manifest.json'
		, serveManifest
		, addHeaders
		, serveFile
		, warnDevMid("Can't serve manifest.json")
		, serveCode(500))
	web.get('/favicon.ico'
		, getSha
		, prepFavicon
		, serveFile
		// , warnDevMid("Can't serve favicon.ico")
		, serveCode(500))
	web.get('/robots.txt'
		, prepRobots
		, serveFile
		// , warnDevMid("Can't serve robots.txt")
		, serveCode(500))
	web.get('/geo'
		, prepGeo
		, serveFile
		, warnDevMid("Can't serve geo")
		, serveCode(500))
	web.get('/native/:sha/*'
		, prepShaRequest
		, getSha
		, fbMeta
		, getAsset
		, addHeaders
		, serveFile
		, serveCode(404))
	web.get('*'
		, getSha
		, fbMeta
		, getAsset
		, addHeaders
		, serveFile
		, notfound
		, serveCode(500))

	web.use(serveCode(400))

	github.post('/push', handleHookshot)
	github.use(serveCode(404))

	init()
		.catch(state.log("Can't init", true))
}

function warnDevMid (msg) {
	return function (req, res, next) {
		state.warnDev(msg)
		next()
	}
}



function serveStatus (req, res, next) {
	var err
	log.info("Heard request for status")

	if (!config.slack.token) {
		err = new Error("Slack misconfigured")
		err.TODO = "Check slack token"
		state.log("Won't send status", undefined, true)(err)
		res.status(401).end()
	} else if (req.body.token === config.slack.token) {
		if (req.body.text === 'status' || ~req.body.text.indexOf(config.git.branch)) {
			diskspace.check('/', function (err, total, free, status) {
				var du
					, text
					, reply
				if (err) {
					state.log("Can't get disk space", true)(err)
					next()
				} else {
					if (status !== 'READY') {
						state.log("Can't get disk space", true)(new Error("status not ready"))
						log.warn("status", status)
						next()
					} else {
						du = Math.round(100*free/total) + "%"
						text = "branch: " + config.git.branch
							+ "\nlive: " + live.sha
							+ "\nfreeSpace: " + du
						try {
							reply = JSON.stringify({
								text: text
								, username: error.instance_ip
							}, null, 2)
							log.info("Responding", reply)
							res.end(reply)
						} catch (e) {
							state.log("Can't stringify or send status", true)(e)
							next()
						}
					}
				}
			})
		} else {
			log.info("Ignoring status request targeted at different branch")
			res.status(200).end()
		}
	} else {
		state.log("Won't send status", undefined, true)(new Error("Wrong token"))
		res.status(401).end()
	}
}

function init () {
	var self = this
	return getLatestSha()
		.catch(state.log("Can't get latest SHA", true))
		.catch(wrongBranch)
		.then(offerSha)
		.catch(state.log("Can't offer SHA"))
		.then(acceptRequests)
		.catch(state.log("Can't accept requests", true))
		.then(acceptHookshots)
		.catch(state.log("Can't accept hookshots", true))
}

function wrongBranch (reason) {
	if (reason.message === 'Not Found') {
		throw new Error("Branch not found")
	} else {
		throw reason
	}
}

function getLatestSha () {
	return new Promise(function (resolve, reject) {
		var options
			, req
		if (config.src) {
			resolve('_local')
		} else {
			try {
				options = {
					hostname: config.git.api.hostname
					, path: path.join('/repos'
						, config.git.owner
						, config.releaseRepo.name
						, 'commits'
						, config.git.branch)
					, headers: config.git.api.headers
				}
				log.info("Getting latest", options)
			} catch (e) {
				log.error("Git misconfigured, check owner, repo and branch")
				return reject(new Error("Invalid config"))
			}
			req = https.request(options
				, function (res) {
					var concatenate
						,	err 
					res.on('error', function (err) {
						err.options = options
						reject(err)
					})
					if (res.statusCode === 401) {
						log.error("Git unauthorized, check username and password")
						err = new Error("Invalid config")
						reject(err)
					} else if (res.statusCode === 404) {
						log.error("Repo or branch not found")
						err = new Error("Invalid config")
						err.TODO = "Check git username and password"
						reject(err)
					} else {
						concatenate = concat(function (data) {
							var parsed
							try {
								parsed = JSON.parse(data)
							} catch (e) {
								reject(e)
							}
							if (parsed.sha) {
								resolve(parsed.sha)	
							} else {
								reject(parsed)
							}
						})
						res.pipe(concatenate)	
					}
				})
			log.info(helpers.hNow() + " Asking Github for latest commit on branch", config.git.branch)
			req.on('error', function (err) {
				err.options = options
				reject(err)
			})
			req.end()
		}
	})
}

function checkSpace () {
	return new Promise(function (resolve, reject) {
		diskspace.check('/', function (err, total, free, status) {
			var percent
				, msg
			if (err) {
				reject(err)
			} else {
				if (status !== 'READY') {
					log.warn("Can't get disk space")
					log.warn("status", status)
				} else {
					msg = "Free space left: " + free/total
							+ " \ 1 AKA ( " + Math.round(100*free/total) + "% )"
					if (free/total < config.minFreeSpace) {
						log.warn(msg)
						state.warnDev(msg, true)
					} else {
						log.info(msg)
					}
				}
				resolve()
			}
		})
	})
}

function offerSha (sha) {
	var v
		, ready
	v = new Version(sha, config)
	latestNewSha = sha

	ready = prepQueue.add()
		.catch(function (reason) {
			reason.addRejected = true
			throw reason
		})
		.catch(state.log("Prep canceled"))
		.then(function () {
			return v.prep()
		})
		.catch(state.log("Can't prepare version (" + sha + ")"))
		.then(function (value) {
				prepQueue.done()
				return value
			}
			, function (reason) {
				prepQueue.canceled(reason)
				throw reason
			})
		.catch(state.log("Can't run queued prep"))
		.then(goLive)
		.catch(state.log("Can't go Live"))
		.then(checkSpace)
		.catch(state.log("Can't check disk space"))
		.catch(function (reason) {
			var msg = "GoLive failed! "
			if (!reason.newerVersion
				&& !reason.addRejected
				&& !reason.invalidRequest) {
				try {
					msg += " reason: " + JSON.stringify(reason)
				} catch (e) {
					msg += " (unable to stringify reason)"
				}
				reason.warned = true
				state.warnDev(msg)
			}
			throw reason
		})

	function goLive () {
		return new Promise(function (resolve, reject) {
			var error
				, t
			if (latestNewSha !== sha) {
				error = new Error("Go Live canceled: a newer version has been pushed")
				error.newerVersion = true
				return reject(error)
			}
			live = v
			t = Date.now()
			log.info(helpers.hNow() + " New version live:", live.sha)
			resolve(state.get()
				.then(function (data) {
					data.lastGoLive = t
					return state.save(data)
						.then(function () {
							return live		
						})
				}))
			v.replayTransforms()
		})
	}

	return ready
}

// function notifyCloud (version) {
// 	var nbRetries = 0
// 		, t = setTimeout(function () {
// 			try {
// 				attempt(false)	
// 			}
// 			catch (e) {
// 				console.error(e)
// 			}
// 		}, config.cloudNotificationDelay)

// 	log.info("Notifying cloud in "
// 		+ config.cloudNotificationDelay
// 		+ " ms")

// 	function attempt (isRetry) {
// 		if (latestNewSha !== version.sha) {
// 			throw new Error("Cloud notification canceled: "
// 				+ "a newer version has been pushed")
// 		}
// 		log.info(helpers.hNow() + " Notifying cloud")
// 		if (isRetry) {
// 			nbRetries += 1
// 		} else {
// 			nbRetries = 0
// 		}
// 		version.getPkg()
// 			.catch(state.log("Can't get pkg"))
// 			.then(function (pkg) {
// 				return new Promise(function (resolve, reject) {
// 					var cloud = new vCloud(pkg.vigour.cloud)
// 						, time
// 						, retryTime
// 						, welcomed = false
// 					cloud.on('welcome', function () {
// 						welcomed = true
// 						log.info("Welcomed by cloud")
// 						cloud.data.get('app').val = {
// 							version: pkg.version
// 						}
// 						time = setTimeout(function () {
// 							cloud.socket.disconnect()
// 							log.info(helpers.hNow() + " Cloud notified of version `"
// 								+ pkg.version
// 								+ "`")
// 							resolve()
// 						}, config.cloudDisconnectDelay)
// 					})
// 					retryTime = setTimeout(function () {
// 						if (!welcomed) {
// 							if (nbRetries < config.notifyCloudRetries) {
// 								log.info("Retrying to notify cloud")
// 								attempt(true)
// 							} else {
// 								reject("Max retries reached")
// 							}
// 						}
// 					}, config.notifyCloudRetryDelay)
// 				})
// 			})
// 			.catch(state.log("Can't notify cloud"))
// 	}
// }

function acceptRequests () {
	if (!server) {
		server = web.listen(config.port)
		log.info('Listening for requests on port ', config.port)
	}	else {
		throw new Error("`server` already exists")
	}
}

function startRepl () {
	r = repl.start({
		useGlobal: true
	})
	r.context.context = {
		config: config
		, env: process.env
		, getuid: process.getuid
		, live: live
		, server: server
		, web: web
	}
}

function acceptHookshots () {
	gitListener = github.listen(config.git.port)
	log.info("Listening for hookshots on port", config.git.port)
}

// MIDDLEWARE

// function logRequest (req, res, next) {
// 	log.info(helpers.hNow(), req.method, req.originalUrl)
// 	next()
// }

function prepFavicon (req, res, next) {
	req.sendPath = path.join(req.sha.root
		, 'favicon.ico')
	res.set('access-control-allow-origin', '*')

	setHeaders(res, {
		cache: true
		, cdnCache: false
	})
	next()
}

function prepRobots (req, res, next) {
	req.sendPath = path.join(__dirname, 'robots.txt')
	res.set('access-control-allow-origin', '*')

	setHeaders(res, {
		cache: false
		, cdnCache: false
	})
	next()
}

function prepGeo (req, res, next) {
	req.sendPath = path.join(__dirname, 'geo.json')
	res.set('access-control-allow-origin', '*')

	setHeaders(res, {
		cache: false
		, cdnCache: true
	})
	next()
}

function prepShaRequest (req, res, next) {
	var requestedPath = req.url.slice(1)
	requestedPath = requestedPath.slice(requestedPath.indexOf('/') + 1)
	requestedPath = requestedPath.slice(requestedPath.indexOf('/') + 1)
	log.info('specific SHA requested', req.params.sha)
	req.filePath = requestedPath
	req.setHeaderOptions = {
		cache: true
		, cdnCache: true
	}
	req.shaRequest = true
	next()
}

function getSha (req, res, next) {
	if (req.params.sha) {
		req.sha = new Version(req.params.sha, config)
		next()
	} else if (live) {
		req.sha = live
		next()
	} else {
		// TODO
		log.error("In getSha, neither `req.params.sha` nor `live` are truthy")
		next()
	}
}

function getUA (req, res, next) {
	req.ua = req.get('user-agent')
	req.ua = (typeof req.ua === "string" || req.ua instanceof String)
		? req.ua.replace(/\(\d+\)$/, "")
		: ""
	// log.info("ua", req.ua)
	next()
}

function fbMeta (req, res, next) {
	if (req.ua.indexOf('facebook') !== -1) {
		log.info("Facebook scraper request")
		req.sha.getPkg()
			.catch(state.log("Can't get pkg to get Facebook defaults"))
			.then(function (pkg) {
				var item
					, meta = {
						"og:title": pkg.vigour.packer.fbDefaults.title
						, "og:description": pkg.vigour.packer.fbDefaults.description
						, "og:image": pkg.vigour.packer.fbDefaults.image
					}
					, prop
					, str = ''
				for (item in req.query) {
					if (item.indexOf('og:') === 0) {
						if (item === 'og:image') {
							meta[item] = pkg.vigour.img
								+ path.join('/image'
									, req.query[item]
									, '1200'
									, '630')
						} else {
							meta[item] = req.query[item]
						}
					}
				}
				for (prop in meta) {
					str += '<meta property="'
						+ prop
						+ '" content="'
						+ meta[prop]
						+ '" />'
				}
				setHeaders(res)
				log.info("Sending ", str)
				res.end(str)
			})
			.catch(state.log("Can't create meta string for facebook scraper"))
			.catch(function (reason) {
				log.warn("500", "Facebook meta tags")
				res.status(500).end()
			})
	} else {
		next()
	}
}

function getAsset (req, res, next) {
	req.originalFilePath = url.parse(
		(req.filePath || req.url))
		.pathname
	
	
	req.sha.getAsset(req.originalFilePath
		, {
			fsRoot: (req.query.fsRoot) ? req.query.fsRoot : ""
			, ua: req.ua
		}
		, req.shaRequest)
		.catch(state.log("Can't get asset"))
		.then(function (path) {
			if (path) {
				req.sendPath = path
				next()
			} else {
				res.status(503)
					.set('retry-after', config.retryAfter)
					.end()
			}
		}
		, function (reason) {
			// TODO Respond as a function of reason
			log.error('Asset not found')
			notfound(req, res, next)
		})
}

function addHeaders (req, res, next) {
	res.set('access-control-allow-origin', '*')
	setHeaders(res,	req.setHeaderOptions)
	next()
}

function serveCode (code) {
	return function (req, res, next) {
		log.warn(code, req.originalUrl)
		res.status(code).end(code + " " + req.originalUrl)
	}
}

function notfound (req, res, next) {
	var i
	if (!req.pathCandidate) {
		req.pathCandidate = req.originalFilePath
	}
	
	i = req.pathCandidate.indexOf('/')
	req.pathCandidate = (i === -1)
		? ''
		: req.pathCandidate
			.slice(i + 1)
	if (path.extname(req.pathCandidate) === '') {
		serveIndex(req, res, next)
	} else {
		res.sendFile(path.join(req.sha.root, req.pathCandidate)
			, function (err) {
				if (err) {
					if (err.code === 'ECONNABORT' && res.statusCode === 304) {
						// log.info('304', req.pathCandidate)
					} else if (err.code === 'ENOENT') {
						notfound(req, res, next)
					} else {
						err.path = req.pathCandidate
						log.error(helpers.hNow(), err)
					}
				} else {
					// log.info(res.statusCode, req.pathCandidate)
				}
			})
	}
}

function serveIndex (req, res, next) {
	req.sha.getPkg()
		.then(function (pkg) {
			var indexPath = path.join(req.sha.root
				, pkg.vigour.packer.web)
			req.sendPath = indexPath
			res.sendFile(indexPath
				, function (err) {
					if (err) {
						if (err.code === 'ECONNABORT'
							&& res.statusCode === 304) {
								// log.info('304', indexPath)
						} else {
							err.path = indexPath
							log.error(helpers.hNow(), err)
							next()
						}
					} else {
						// log.info(res.statusCode, indexPath)
					}
				})
		})
		.catch(function () {
			res.status(400).send("Invalid SHA")
		})
}

function serveManifest (req, res, next) {
	req.sendPath = live.manifestPath
	next()
}

function serveFile (req, res, next) {
	res.sendFile(req.sendPath
		, function (err) {
			if (err) {
				if (err.code === 'ECONNABORT' && res.statusCode === 304) {
					// log.info('304', req.sendPath)
				} else if (err.code === 'ENOENT') {
					next()
				} else {
					err.path = req.sendPath
					log.error(helpers.hNow(), err)
				}
			} else {
				// log.info(res.statusCode, req.sendPath)
			}
		})
}

function handleHookshot (req, res, next) {
	var r
		, h
		, branch
		, sha
	log.info(helpers.hNow() + " Received hookshot")
	oboe(req)
		.node('ref', function (ref) {
			r = ref
			finish.call(this)
			return oboe.drop;
		})
		.node('head_commit.id', function (headCommit) {
			h = headCommit
			finish.call(this)
			return oboe.drop;
		})
		.node('*', function () {
			return oboe.drop;
		})
		.done(function (body) {
			finish.call(this)
		})

	function finish () {
		if (r && h) {
			this.abort()
			try {
				branch = r.slice(r.lastIndexOf('/') + 1)
				if (branch === config.git.branch || branch === '_local') {
					sha = (branch === '_local')
						? '_local'
						: h
					offerSha(sha)
				} else {
					log.info("Ignoring hookshot from branch", branch)
				}
			} catch (e) {
				res.status(400).end()
			}
			res.status(202).end()
		}
	}
}

// HELPERS

function setHeaders (res, opts) {
	var maxage = 31556900	// ~ 1 year in seconds
	res.set("cache-control", (opts && opts.cache)
			? "public, no-transform, max-age=" + maxage
			: "public, max-age=0")
	res.set("Edge-Control", (opts && opts.cdnCache)
			? "!no-cache, max-age=" + maxage
			: "public, max-age=0")

	// res.set("cache-control", "public, max-age=0")
	// res.set("Edge-Control", "public, max-age=0")
}

function getReleaseRepo () {
	return new Promise(function (resolve, reject) {
		fs.exists(config.releaseRepo.absPath, function (exists) {
			if (exists) {
				resolve()
			} else {
				resolve(
					git.isReleaseOnGitHub(config)
						.then(function (is) {
							if (is) {
								return git.cloneRelease(config)
							} else {
								return git.createRelease(config)
									.then(function () {
										return git.cloneRelease(config)	
									})
							}
						})
				)
			}
		})
	})
}

function syncAssets () {
	return new Promise(function (resolve, reject) {
		helpers.sh('rm -rf *'
			, { cwd: config.releaseRepo.absPath }
			, function (error, stdout, stderr) {
				if (error) {
					reject(error)
				} else {
					console.log("Copying assets")
					resolve(fs.expandStars(config.assets, process.cwd())
						.then(flatten)
						.then(function (newAssets) {
							var key
								, arr = []
							newAssets['package.json'] = true
							for (key in newAssets) {
								arr.push(cp(path.join(process.cwd(), key)
									, path.join(config.releaseRepo.absPath, key)))
							}
							return Promise.all(arr)
						})
					)
				}
			})
	})
}



function release () {
	return getReleaseRepo()
		.then(function () {
			return git.checkoutRelease(config)
		})
		.then(function () {
			return git.pullRelease(config)
		})
		.then(syncAssets)
		.then(function () {
			return git.commitRelease(config)
		})
		.catch(function (reason) {
			log.error("oops", reason)
		})
}

function sendFiles () {
	return helpers.sh("scp -i " + config.server.identity
			+ " " + config.server.ssh.id
			+ " " + config.server.ssh.key
			+ " " + config.server.ssl.cert
			+ " " + config.server.ssl.key
			+ " " + path.join(__dirname, "install.sh")
			+ " " + path.join(process.cwd(), ".package.json")
			+ " " + config.server.user
			+ "@" + config.server.ip
			+ ":" + config.server.remoteHome)
		.then(function (stdout) {
			console.log(stdout)
		})
}

function install () {
	return helpers.sh("ssh -i " + config.server.identity
			+ " " + config.server.user
			+ "@" + config.server.ip
			+ " " + "\"" + "screen -d -m ./install.sh" + " '" + config.server.ssl.password + "'\"")
		.then(function (stdout) {
			console.log(stdout)
		})
}

function serve () {
	log.info("Server config", config.server)
	return sendFiles()
		.then(install)
		.then(function () {
			log.info("DONE")
		})
		.catch(function (reason) {
			log.error("UH OH", reason)
		})
}

function cleanup () {
	return Promise.all(
		[ path.join(config.assetRoot, "shas/")
		, path.join(config.assetRoot, "state.json")
		, path.join(config.assetRoot, "history.json")
		].map(function (item) {
			if (item[item.length - 1] === "/") {
				return readdir(item)
					.then(function (files) {
						return Promise.all(files.map(function (i) {
							if (i !== ".gitignore") {
								return remove(path.join(item, i))
							} else {
								return Promise.resolve()
							}
						}))
					})
			} else {
				return remove(item)
			}
		})
	)
}
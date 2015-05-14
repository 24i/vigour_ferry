var config = require('./config')
	, https = require('https')
	, path = require('path')
	, repl = require('repl')
	, url = require('url')
	
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

	
	, Version = require('./Version')
	, PrepQueue = require('./PrepQueue')
	, helpers = require('./helpers')
	, shaHistory = require('./shaHistory')
	, state = require('./state')
	, error = require('./error')

	, web = express()
	, server
	, github = express()
	, gitListener
	, live
	, latestNewSha
	, prepQueue = new PrepQueue()

	, r

function warnDevMid (msg) {
	return function (req, res, next) {
		state.warnDev(msg)
		next()
	}
}

web.use(compress())
web.use(logRequest)
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

function serveStatus (req, res, next) {
	if (req.body.token === config.slack.token) {
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
	return getLatestSha()
		.catch(wrongBranch)
		.catch(state.log("Can't get latest SHA", true))
		.then(offerSha)
		.catch(fixCatch)
		.then(acceptRequests)
		.catch(state.log("Can't accept requests", true))
		.then(acceptHookshots)
		.catch(state.log("Can't accept hookshots", true))
}

// startRepl()

function fix (reason) {
	return shaHistory.removeLatest()
		.then(Version.prototype.removeSha
			, state.log("Can't remove latest SHA", false, true))
		.then(getLatestSha)
		.catch(wrongBranch)
		.catch(state.log("Can't get latest SHA after removing it", true))
		.then(offerSha)
}

function wrongBranch (reason) {
	if (reason.message === 'Not Found') {
		throw new Error("Branch not found")
	}
}

function fixCatch (reason) {
	return fix(reason)
}

function getLatestSha () {
	return new Promise(function (resolve, reject) {
		var options
			, req
		if (config.offlineMode) {
			resolve('_local')
		} else {
			options = {
				hostname: config.git.api.hostname
				, path: path.join('/repos'
					, config.git.owner
					, config.git.repo
					, 'commits'
					, config.git.branch)
				, headers: config.git.api.headers
			}
			req = https.request(options
				, function (res) {
					var concatenate
					res.on('error', function (err) {
						err.options = options
						reject(err)
					})
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

	v = new Version(sha)
	latestNewSha = sha

	ready = prepQueue.add()
		.catch(function (reason) {
			reason.addRejected = true
			throw reason
		})
		.catch(state.log("Prep canceled"))
		.then(checkSpace)
		.catch(state.log("Can't check disk space"))
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
		// .then(notifyCloud)
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
			var delay = live ? config.goLiveDelay : 0
			log.info("Going live in " + delay + " ms")
			setTimeout(function () {
				var error
					, t
				if (latestNewSha !== sha) {
					error = new Error("Go Live canceled: a newer version has been pushed")
					error.newerVersion = true
					reject(error)
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
			}, delay)
			log.info("Replaying transforms")
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
	gitListener = github.listen(config.git.listener.port)
	log.info("Listening for hookshots on port", config.git.listener.port)
}

// MIDDLEWARE

function logRequest (req, res, next) {
	log.info(helpers.hNow(), req.method, req.originalUrl)
	next()
}

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
		req.sha = new Version(req.params.sha)
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
	log.info("ua", req.ua)
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
						log.info('304', req.pathCandidate)
					} else if (err.code === 'ENOENT') {
						notfound(req, res, next)
					} else {
						err.path = req.pathCandidate
						log.error(helpers.hNow(), err)
					}
				} else {
					log.info(res.statusCode, req.pathCandidate)
				}
			})
	}
}

function serveComingSoon (req, res, next) {
	res.sendFile(config.comingSoonPath
		, function (err) {
			if (err) {
				if (err.code === 'ECONNABORT'
					&& res.statusCode === 304) {
						log.info('304', config.comingSoonPath)
				} else {
					err.path = config.comingSoonPath
					log.error(helpers.hNow(), err)
					next()
				}
			} else {
				log.info(res.statusCode, config.comingSoonPath)
			}
		})
}

function serveComingSoonAppCacheManifest (req, res, next) {
	res.sendFile(config.comingSoonAppCacheManifestPath
		, function (err) {
			if (err) {
				if (err.code === 'ECONNABORT'
					&& res.statusCode === 304) {
						log.info('304', config.comingSoonAppCacheManifestPath)
				} else {
					err.path = config.comingSoonAppCacheManifestPath
					log.error(helpers.hNow(), err)
					next()
				}
			} else {
				log.info(res.statusCode, config.comingSoonAppCacheManifestPath)
			}
		})
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
								log.info('304', indexPath)
						} else {
							err.path = indexPath
							log.error(helpers.hNow(), err)
							next()
						}
					} else {
						log.info(res.statusCode, indexPath)
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
					log.info('304', req.sendPath)
				} else if (err.code === 'ENOENT') {
					next()
				} else {
					err.path = req.sendPath
					log.error(helpers.hNow(), err)
				}
			} else {
				log.info(res.statusCode, req.sendPath)
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
var express = require('express')
	, fs = require('vigour-fs')
	, Logger = require('../logger')
	, log = new Logger(__filename.slice(__filename.lastIndexOf('/') + 1))
	, vObject = require('vigour-js/object')
	, defaultOptions = {
		port: 80
	}

module.exports = exports = Server

function Server (options, assets) {
	var self = this

	self.opts = new vObject(defaultOptions)
	self.opts.merge(options)

	self.port = self.opts.port.val
	self.uid = self.opts.uid.val
	self.assets = assets
	self.app = express()
	self.mtimes = {}

	// Just logs every incoming request before passing it along to the next middleware
	self.app.use(function (req, res, next) {
		log.info(now(), req.method, req.originalUrl)
		next()
	})

	self.app.get('/geo', function (req, res, next) {
		res.set('access-control-allow-origin', '*')
		self.setHeaders(res
			, false // Clients should never cache this
			, true) // Akamai should cache for ~ 1 year
		res.sendFile(__dirname + '/geo.json'
			, function (err) {
				if (err) {
					log.error(now(), err)
					// TODO Warn dev
				}
			})
	})

	self.app.use(function (req, res, next) {
		self.assets.get(req, function (err, path, cache, sCache) {
			if (err) {
				if (err.notFound) {
					log.info(now(), "sending 404 for", req.originalUrl)
					res.status(404).end()
				} else if (err.isInternal) {
					log.error(now(), "sending 500 for", req.originalUrl)
					res.status(500).end()
				} else if (err.invalidRequest) {
					log.info(now(), "sending 400 for", req.originalUrl)
					res.status(400).end()
				} else {
					log.error(now(), "assets.get error", err)
					// TODO
					res.status(500).end()	
				}
				return
			}
			log.info(now(), 'sending', path)
			res.set('access-control-allow-origin', '*')
			self.setHeaders(res, cache, sCache)
			res.sendFile(path
				, function (err) {
					if (err) {
						err.message += ": sendFile error"
						log.error(now(), err)
						// TODO Warn dev
					}
				})
		})
	})
}

Server.prototype.setHeaders = function (res, cache, sCache) {
	var maxage = 31540000
	if (cache) {
		res.set("cache-control", "public, no-transform, max-age=" + maxage)
	} else {
		res.set("cache-control", "public, max-age=0")
	}
	if (sCache) {
		res.set("Edge-Control", "!no-cache, max-age=" + maxage)
	} else {
		res.set("Edge-Control", "public, max-age=0")
	}
}

Server.prototype.start = function (cb) {
	var self = this
	if (!self.server) {
		// TODO Make sure the assets are ready before listening, but do the asset stuff without sudo permissions
		self.server = self.app.listen(self.port)
		log.info(now(), 'listening on port ', self.port)
		process.setuid(self.uid)
		// TODO make sure assets can't be initialized twice
		self.assets.init(function (err) {
			if (err) {
				log.error(now(), 'Error initializing assets', err)
				// TODO
				return
			}
			
			cb()
		})
	}
}

Server.prototype.teardown = function () {
	this.server.close()
}

function now () {
	var date = new Date()
		, dateTime = date.getUTCFullYear()
			+ "/"
			+ pad(date.getUTCMonth(), 2)
			+ "/"
			+ pad(date.getUTCDay(), 2)
			+ " "
			+ pad(date.getUTCHours(), 2)
			+ ":"
			+ pad(date.getUTCMinutes(), 2)
			+ ":"
			+ pad(date.getUTCSeconds(), 2)
			+ "."
			+ pad(date.getUTCMilliseconds(), 3)
return dateTime
}

function pad (nb, digits) {
	var l = nb.toString().length
		, add = digits - l
	while (add > 0) {
		nb = "0" + nb
		add -= 1
	}
	return nb
}

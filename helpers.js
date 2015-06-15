var Promise = require('promise')
	, proc = require('child_process')
module.exports = exports = {}

exports.getter = function (create) {
	var pending = {}
		, cache = {}
	function resolvePending (key, value) {
		settle(null, key, value)
	}
	function rejectPending (key, reason) {
		settle(reason, key)
	}
	function settle (err, key, data) {
		var cb
		while (cb = pending[key].shift()) {
			cb(err, data)
		}
	}
	return function () {
		var self = this
			, key = arguments[0] || 'defaultKey'
		return new Promise(function (resolve, reject) {
			if (pending[key]) {
				pending[key].push(cb)
			} else {
				pending[key] = [cb]
			}
			if (cache[key]) {
				resolvePending(key, cache[key])
			} else {
				create.apply(self, arguments)
					.then(
						function (value) {
							resolvePending(key, value)
							cache[key] = value
						}
						, function (reason) {
							rejectPending(key, reason)
						})
			}
			function cb (err, value) {
				if (err) {
					reject(err)
				} else {
					resolve(value)
				}
			}
		})
	}
}

exports.hNow = function () {
	var date = new Date()
		, dateTime = date.getUTCFullYear()
			+ "/"
			+ pad(date.getUTCMonth() + 1, 2)
			+ "/"
			+ pad(date.getUTCDate(), 2)
			+ " "
			+ pad(date.getUTCHours(), 2)
			+ ":"
			+ pad(date.getUTCMinutes(), 2)
			+ ":"
			+ pad(date.getUTCSeconds(), 2)
			+ " UTC"

	function pad (val, nbDigits) {
		var missing = nbDigits - val.toString().length
		while (missing > 0) {
			val = "0" + val
			missing -= 1
		}
		return val
	}
	return dateTime
}


exports.sh = function (command, opts, cb) {
	var p
	if (!opts) {
		opts = { }
	}
	if (!opts.cwd) {
		opts.cwd = __dirname	
	}
	p = new Promise(function (resolve, reject) {
		console.log('Executing `', command, '`\n\tCWD:', opts.cwd)
		proc.exec(command
		, { cwd: opts.cwd }
		, function (error, stderr, stdout) {
			if (error) {
				console.error(stderr)
				reject(error)
			} else {
				resolve(stdout)
			}
		})	
	})
	if (cb) {
		p.then(function (val) {
			cb(null, val)
		}, cb)
	}
	return p
}

exports.serveCode = function (code) {
	return function (req, res, next) {
		log.warn(code, req.originalUrl)
		res.status(code).end(code + " " + req.originalUrl)
	}
}
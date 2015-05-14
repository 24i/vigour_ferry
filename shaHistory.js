var path = require('path')
	, log = require('npmlog')
	, Promise = require('promise')
	, fs = require('vigour-fs')
	, config = require('./config')
	, state = require('./state')
	, helpers = require('./helpers')

	, read = Promise.denodeify(fs.readFile)
	, write = Promise.denodeify(fs.writeFile)
	, shaHistory = {}

module.exports = exports = shaHistory

shaHistory.path = path.join(config.assetRoot
	, config.shaHistoryName)
shaHistory.resolvePending = function (value) {
	this.settle(null, value)
}
shaHistory.rejectPending = function (reason) {
	this.settle(reason)
}
shaHistory.settle = function (err, data) {
	var cb
	while (cb = this.pending.shift()) {
		cb(err, data)
	}
}
shaHistory.get = helpers.getter(function () {
	log.info("Getting sha history", shaHistory.path)
	return read(shaHistory.path, 'utf8')
		.then(function (data) {
			var value = JSON.parse(data)
			return value
		}
		, function (reason) {
			var value
			if (reason.code === 'ENOENT') {
				value = []
				return value
			} else {
				throw reason
			}
		})
		.catch(state.log("Can't get parsed sha history"))
})
shaHistory.save = function (newHistory) {
	return write(shaHistory.path
			, JSON.stringify(newHistory)
			, 'utf8')
		.catch(state.log("Can't write sha history"))
}

shaHistory.removeLatest = function () {
	var self = this
	return self.get()
		.then(function (history) {
			var latest = history.pop()
			self.save(history)
			return latest
		})
}
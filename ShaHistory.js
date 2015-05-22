var path = require('path')
	, log = require('npmlog')
	, Promise = require('promise')
	, fs = require('vigour-fs')
	, State = require('./State')
	, helpers = require('./helpers')

	, read = Promise.denodeify(fs.readFile)
	, write = Promise.denodeify(fs.writeFile)
	, state

module.exports = exports = ShaHistory

function ShaHistory (config) {
	state = new State(config)
	this.path = path.join(config.assetRoot
		, config.shaHistoryName)
}

ShaHistory.prototype.resolvePending = function (value) {
	this.settle(null, value)
}
ShaHistory.prototype.rejectPending = function (reason) {
	this.settle(reason)
}
ShaHistory.prototype.settle = function (err, data) {
	var cb
	while (cb = this.pending.shift()) {
		cb(err, data)
	}
}
ShaHistory.prototype.get = helpers.getter(function () {
	return read(this.path, 'utf8')
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
ShaHistory.prototype.save = function (newHistory) {
	return write(this.path
			, JSON.stringify(newHistory)
			, 'utf8')
		.catch(state.log("Can't write sha history"))
}

ShaHistory.prototype.removeLatest = function () {
	var self = this
	return self.get()
		.then(function (history) {
			var latest = history.pop()
			self.save(history)
			return latest
		})
}
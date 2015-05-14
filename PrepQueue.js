var Promise = require('promise')
	, pending = false
	, next = false

module.exports = exports = PrepQueue

function PrepQueue () {}

PrepQueue.prototype.add = function () {
	var error
	return new Promise(function (resolve, reject) {
		if (!pending) {
			pending = true
			resolve()
		} else {
			if (next) {
				error = new Error("Another version came in")
				error.newerVersion = true
				next.reject(error)
			}
			console.log("Putting new version up next")
			console.log("heapUsed", process.memoryUsage().heapUsed)
			next = {
				resolve: resolve
				, reject: reject
			}
		}
	})
}

PrepQueue.prototype.run = function () {
	if (next) {
		pending = true
		next.resolve()
		next = false
	}
}

PrepQueue.prototype.done = function () {
	pending = false
	this.run()
}

PrepQueue.prototype.canceled = function (reason) {
	if (!reason.addRejected) {
		this.done()
	}
}
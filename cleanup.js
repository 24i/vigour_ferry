var path = require('path')
	, Promise = require('promise')
	, log = require('npmlog')
	, fs = require('vigour-fs')
	, readdir = Promise.denodeify(fs.readdir)
	, remove = Promise.denodeify(fs.remove)

module.exports = exports = cleanup

function cleanup (config) {
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
	).then(function () {
		log.info("Done")
	})
}
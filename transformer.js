var path = require('path')

	, Promise = require('promise')
	, log = require('npmlog')
	, UglifyJS = require('uglify-js')
	, fs = require('vigour-fs')
	, vUtil = require('vigour-js/util')
	, vConfig = require('vigour-js/util/config')
	, vConfigUA = require('vigour-js/util/config/ua')
	, config = require('./config')
	, state = require('./state')
	, helpers = require('./helpers')

	, read = Promise.denodeify(fs.readFile)
	, write = Promise.denodeify(fs.writeFile)
	, transformer = {}

module.exports = exports = transformer

transformer.rebase = function (data, params, pkg) {
	var self = this
	return new Promise(function (resolve, reject) {
		var base = decodeURIComponent(params.fsRoot)
			.replace('/' + config.shaPlaceholder + '/'
				, '/' + pkg.sha + '/')
		resolve(data.replace(transformer.rebase.rebaseRE
			, function (match
				, p1
				, p2
				, p3
				, p4
				, p5
				, offset
				, string) {
					var newStr
					if (p2) {
						newStr = p1
							+ self.rebase.urlToken(base)
							+ p2
							+ p5
					} else if (p3) {
						newStr = p1
							+ '"'
							+ self.rebase.stringToken(base, '"')
							+ p3
							+ '"'
							+ p5
					} else if (p4) {
						newStr = p1
							+ "'"
							+ self.rebase.stringToken(base, "'")
							+ p4
							+ "'"
							+ p5
					} else {
						newStr = match
					}
					return newStr
				}))
	})
}
transformer.rebase.params = ['fsRoot']
transformer.rebase.rebaseRE =
	/(url\()(?:\s*(?!https?:\/\/|data:)((?:[^"'()\\]|\\(?:[^\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\s?))*)\s*|\s*"(?!https?:\/\/|data:)((?:[^"\\\n]|\\(?:[^\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\s?)|\\\n)*)"\s*|\s*'(?!https?:\/\/|data:)((?:[^'\\\n]|\\(?:[^\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\s?)|\\\n)*)'\s*)(\))/gi
transformer.rebase.stringToken = function (str, quote) {
	return this.escapeChars(str, [quote, '\n'])
}
transformer.rebase.urlToken = function (str) {
	return this.escapeChars(str
		, ["'", '"', "\\(", "\\)", "\\s", "[\\x00-\\x1F]"])
}
transformer.rebase.escapeChars = function (str, chars) {
	var l = chars.length
		, i
	for (i = 0; i < l; i += 1) {
		str = this.escapeChar(str, chars[i])
	}
	return str
}
transformer.rebase.escapeChar = function (str, char) {
	var	la = (char === "\\\\")
			? "(?!\\\\)"
			: ""
		, escapeCharRE = new RegExp("(?:^(" + char + ")" + la
			+ "|(\\\\(?:[^\\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\\s?))("+ char
			+ ")|([^\\\\])("+ char + "))"
		, "gi")
	return str.replace(escapeCharRE, function (match
		, p1
		, p2
		, p3
		, p4
		, p5
		, offset
		, string) {
			var newStr
			if (p1) {
				newStr = "\\" + p1
			} else if (p2) {
				newStr = p2 + "\\" + p3
			} else if (p4) {
				newStr = p4 + "\\" + p5
			} else {
				newStr = match
			}
			return newStr
	})
}

transformer.uglify = function (data, params, pkg) {
	return new Promise(function (resolve, reject) {
		var ugly = UglifyJS.minify(data, {
			fromString: true
		})
		resolve(ugly.code)
	})
}

transformer.inform = function (data, params, pkg) {
	return new Promise(function (resolve, reject) {
		var prefix
			, uaSpecific = vUtil.clone(pkg)

		vConfig.parse(uaSpecific.vigour
			, uaSpecific
			, vConfigUA
			, params)
		prefix = "window.package=" + JSON.stringify(uaSpecific) + ";"
		resolve(prefix + data)
	})
}
transformer.inform.params = ['ua']

transformer.transform = function (data, transforms, params, pkg) {
	self = this
	return new Promise(function (resolve, reject) {
		var l = transforms.length
			, i = 0
		t(data)
		function t (data) {
			self[transforms[i]](data, params, pkg)
				.catch(state.log("Can't transform"))
				.then(function (newData) {
					i += 1
					if (i < l) {
						t(newData)
					} else {
						resolve(newData)
					}
				}, reject)
				.catch(state.log("Can't continue transform chain or return"))
		}
	})
}
transformer.history = {}
transformer.history.path = path.join(config.assetRoot
	, 'transformHistory.json')
transformer.history.resolvePending = function (value) {
	this.settle(null, value)
}
transformer.history.rejectPending = function (reason) {
	this.settle(reason)
}
transformer.history.settle = function (err, data) {
	var cb
	while (cb = this.pending.shift()) {
		cb(err, data)
	}
}
transformer.history.get = helpers.getter(function () {
	return read(transformer.history.path, 'utf8')
		.then(function (data) {
			var value = JSON.parse(data)
			return value
		}
		, function (reason) {
			var value
			if (reason.code === 'ENOENT') {
				value = {}
				return value
			} else {
				throw reason
			}
		})
		.catch(state.log("Can't get parsed transform history"))
})
transformer.history.save = function (file, id, toSave) {
	var self = this
	self.get()
		.then(function (data) {
			if (!data[file]) {
				data[file] = {}
			}
			if (!data[file][id]) {
				data[file][id] = toSave
				return write(transformer.history.path
						, JSON.stringify(data)
						, 'utf8')
					.catch(state.log("Can't write transform history"))
			}
		})
		.catch(state.log("Can't save transform history"))
}
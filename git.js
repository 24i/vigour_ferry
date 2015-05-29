var https = require('https')
	, fs = require('vigour-fs/lib/server')
	, path = require('path')
	, helpers = require('./helpers')
	, Promise = require('promise')
	, writeFile = Promise.denodeify(fs.writeFile)

module.exports = exports = {}

exports.clone = function (src, dest) {
	return helpers.sh('git clone '
		+ src
		+ ' '
		+ path.basename(dest)
	, { cwd: path.dirname(dest) })
}

exports.checkout = function (branch, repo) {
	return helpers.sh('git checkout '
			+ branch
		, { cwd: repo })
}

exports.pull = function (repo, branch) {
	return helpers.sh('git pull origin '
			+ branch
		, { cwd: repo })
}

exports.fetch = function (repo) {
	return helpers.sh('git fetch'
	, { cwd: repo })
}

exports.cloneRelease = function (config) {
	return exports.clone(config.git.url
			+ ":" + config.git.username
			+ "/" + config.git.releaseRepo.name
			+ ".git"
		, config.git.releaseRepo.absPath)
}

exports.commitRelease = function (config) {
	return helpers.sh('git add .'
			, { cwd: config.git.releaseRepo.absPath })
		.then(function () {
			return helpers.sh("git commit -m 'new version'"
			, { cwd: config.git.releaseRepo.absPath })
		})
		.then(function () {
			return exports.pushu(config.git.releaseRepo.absPath)
		})
}

exports.newBranch = function (branch, repo) {
	return helpers.sh('git checkout -b ' + branch
			, { cwd: repo })
		.then(function () {
			return writeFile(path.join(repo, "README.md")
			, "Just something to push for branch creation to be possible"
			, 'utf8')
		})
		.then(function () {
			return helpers.sh('git add .'
				, { cwd: repo })
		})
		.then(function () {
			return helpers.sh("git commit -m 'initial commit'"
					, { cwd: repo })
		})
		.then(function () {
			return exports.pushu(repo)
		})
}

exports.pushu = function (repo) {
	return helpers.sh('git push -u'
	, { cwd: repo })
}

exports.checkoutRelease = function (config) {
	return exports.fetch(config.git.releaseRepo.absPath)
		.then(function () {
			return exports.checkout(config.git.branch
					, config.git.releaseRepo.absPath)
				.catch(function () {
					return exports.newBranch(config.git.branch
						, config.git.releaseRepo.absPath)
				})
		})
}

exports.pullRelease = function (config) {
	return exports.pull(config.git.releaseRepo.absPath
			, config.git.branch)
		.catch(function (reason) {
			return exports.pushu(config.git.releaseRepo.absPath)
		})
}

exports.isReleaseOnGitHub = function (config) {
	return new Promise(function (resolve, reject) {
		var options = 
			{ method: "GET"
			, hostname: config.git.api.hostname
			, path: "/repos/"
					+ config.git.username
					+ "/" + config.git.releaseRepo.name
			, headers: config.git.api.headers
			}
		console.log("Getting release repo from GitHub", options)
		var req = https.request(options
			, function (res) {
				var err
				res.setEncoding('utf8')
				console.log(res.statusCode)
				if (res.statusCode === 200) {
					resolve(true)
				} else if (res.statusCode === 404) {
					resolve(false)
				} else if (res.statusCode === 403) {
					err = new Error("Unauthorized")
					err.message = "Check git credentials"
					reject(err)
				} else {
					reject(res)
				}
				res.on('error', function (e) {
					console.error('get repo res', e)
					reject(e)
				})
			})
		req.on('error', function (e) {
			console.error("get repo req", e)
			reject(e)
		})
		req.end()
	})
}

exports.createRelease = function (config) {
	return new Promise(function (resolve, reject) {
		var options =
			{ method: "POST"
			, hostname: config.git.api.hostname
			, path: "/user/repos"
			, headers: config.git.api.headers
			}
		, postData = JSON.stringify(
			{ name: config.git.releaseRepo.name
			, description: "`"
				+ config.git.repo
				+ "#" + config.git.branch
				+ "`"
				+ " release assets"
			, private: false
			, has_issues: false
			, has_wiki: false
			, has_downloads: false
			})
		options.headers['Content-Length'] = postData.length
		console.log("Creating release repo", options, "\nbody: ", postData)
		var req = https.request(options
			, function (res) {
				console.log(res.statusCode)
				if (res.statusCode === 201) {
					resolve()
				} else {
					reject(res)
				}
			})
		req.on('error', function (e) {
			console.error('create repo req', e)
			reject(e)
		})
		req.write(postData)
		req.end()
	})
}
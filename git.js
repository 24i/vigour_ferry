var https = require('https')
	, fs = require('vigour-fs/lib/server')
	, path = require('path')
	, helpers = require('./helpers')
	, Promise = require('promise')
	, writeFile = Promise.denodeify(fs.writeFile)
	, log = require('npmlog')

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
			+ "/" + config.releaseRepo.name
			+ ".git"
		, config.releaseRepo.absPath)
}

exports.commitRelease = function (config) {
	return helpers.sh('git add .'
			, { cwd: config.releaseRepo.absPath })
		.then(function () {
			return helpers.sh('git commit -m "new version"'
			, { cwd: config.releaseRepo.absPath })
		}).catch(function (argument) {
			console.log(arguments)
		})
		.then(function () {
			return exports.pushu(config.releaseRepo.absPath)
		})
		.then(function () {
			log.info("New version should go live on all packer servers serving branch " + config.git.branch)
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
	return helpers.sh("ssh-agent bash -c 'ssh-add ~/.ssh/id_rsa_machines; git push -u --repo=git@github-machines:vigourmachines/vigour-example-packer-release.git'"
	, { cwd: repo })
}

exports.checkoutRelease = function (config) {
	return exports.fetch(config.releaseRepo.absPath)
		.then(function () {
			return exports.checkout(config.git.branch
					, config.releaseRepo.absPath)
				.catch(function () {
					return exports.newBranch(config.git.branch
						, config.releaseRepo.absPath)
				})
		})
}

exports.pullRelease = function (config) {
	return exports.pull(config.releaseRepo.absPath
			, config.git.branch)
		.catch(function (reason) {
			return exports.pushu(config.releaseRepo.absPath)
		})
}

exports.isReleaseOnGitHub = function (config) {
	return new Promise(function (resolve, reject) {
		var options = 
			{ method: "GET"
			, hostname: config.git.api.hostname
			, path: "/repos/"
					+ config.git.username
					+ "/" + config.releaseRepo.name
			, headers: config.git.api.headers
			}
		var req = https.request(options
			, function (res) {
				var err
				res.setEncoding('utf8')
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

exports.createPublicKey = function (config) {
	return new Promise(function (resolve, reject) {
		var options =
			{ method: "POST"
			, hostname: config.git.api.hostname
			, path: "/repos/vigourmachines/"+config.releaseRepo.name+"/keys"
			, headers: config.git.api.headers
			}
		, postData = JSON.stringify(
			{ title : "vigour-machines",	
				key: "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDMkbRz6ZaaIXvkQnE/iTlvspTsHLsT7JRqXMMXEbfiDOwndncLTYfcUJl9UVLLmIexX/rQCaVXMPUFAY+i6MITQK5t6eTwFys48gS1DIGltUie0wDkxr+C+k4VdxFLcRmcDTBF0yn0mUkwULR6tvI0Nt6iH3CYmq+03f5C0VzPnY1PKoIzMzvbh3mJQAbYvHYQLx1+xHe2J0xGDv5G5hpW5YC8XH0syl3NW5FQnzwnQxEtjGyiDsPoBlemEnEZ9GUfIYZC4vMfyHk/rYWAvEVmSjzSLVmulBnyAKRSy8ffo8Uhri3e3JFfuf1mUhBXKv7dWT7JtZfyaMkRbX92R7uu/prwVr+LDmOcZTNMqpSYnL5J4Wnb2NZSkeXqnTURoFXVKK1u3cY6CjQwslEQzZz1+fxKpf0Gel+weCsjrCBoTUVFIyPP7OYIAdhbAZbaHvseY8f8ruEawvDj/B1j0FqAHbmJeNmVF+Pm6LoXlmOlFsTxVhwHIYgTLOuSJoQ6xFjJZX1UAjBO1qmJBr4ZI44DIaUD1j86+lq5YyeXI7V/70k8EsiMHSUt5ECdbJ7VwSmtjxOSC2vyEIDMUWxTLyd3c66RGnQwCP854pB5CfsR3Xo9oYDRQppvtO+F8/io6VsHaF0K/RDr6H9DZXGgkdjmCpiq2SlcFbU4PzxrnP8gTw== dev@vigour.io",
			 read_only: false
			})
		options.headers['Content-Length'] = postData.length
		log.warn("Creating repo", options, "\nPOST data:", postData)
		var req = https.request(options
			, function (res) {
				var err
				console.log(res.statusCode)
				if (res.statusCode === 201) {
					resolve()
				} else if (res.statusCode === 401) {
					log.error("Unauthorized")
					err = new Error("Invalid config")
					err.TODO = "Check git username and password"
					reject(err)
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

exports.createRelease = function (config) {
	console.log(config.git.api.headers,"--------------")
	return new Promise(function (resolve, reject) {
		var options =
			{ method: "POST"
			, hostname: config.git.api.hostname
			, path: "/user/repos"
			, headers: config.git.api.headers
			}
		, postData = JSON.stringify(
			{ name: config.releaseRepo.name
			, description: "`"
				+ config.git.repo
				+ "`"
				+ " release assets"
			, private: false
			, has_issues: false
			, has_wiki: false
			, has_downloads: false
			})
		options.headers['Content-Length'] = postData.length
		log.warn("Creating repo", options, "\nPOST data:", postData)
		var req = https.request(options
			, function (res) {
				var err
				console.log(res.statusCode)
				if (res.statusCode === 201) {
					resolve()
				} else if (res.statusCode === 401) {
					log.error("Unauthorized")
					err = new Error("Invalid config")
					err.TODO = "Check git username and password"
					reject(err)
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
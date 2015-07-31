var path = require('path')
	, Promise = require('promise')
	, fs = require('vigour-fs')
	, readFile = Promise.denodeify(fs.readFile)
	, flatten = require('vigour-js/util/flatten')
	, git = require('./git')
	, helpers = require('./helpers')
	, cp = Promise.denodeify(fs.cp)
module.exports = exports = release

function release (config) {
	
	return getReleaseRepo(config)
		.then(function () {
			return createSSHConfigFile()
		})
		.then(function () {
			return git.checkoutRelease(config)
		})
		.then(function () {
			return git.pullRelease(config)
		})
		.then(function () {
			return syncAssets(config)
		})
		.then(function () {
			return git.commitRelease(config)
		})
		.catch(function (reason) {
			log.error("oops", reason)
		})
}

function getReleaseRepo (config) {
	return (new Promise(function (resolve, reject) {
		var err
		if (!config.git.branch) {
			resolve(getGitBranch(config))
		} else {
			resolve()
		}
	}))
		.then(function () {
			return new Promise(function (resolve, reject) {
				fs.exists(config.releaseRepo.absPath, function (exists) {
					var returns
					if (exists) {
						returns = true
					} else {
						returns = git.isReleaseOnGitHub(config)
							.then(function (is) {
								if (is) {
									return git.cloneRelease(config)
								} else {
									return git.createRelease(config)
										.then(function () {
											return git.cloneRelease(config)	
										})
								}
							})
					}
					resolve(returns)
				})
			})
		})
}

function getGitBranch (config) {
	return readFile(path.join(process.cwd(), '.git', 'HEAD'), 'utf8')
		.then(function (data) {
			config.git.branch = data.slice(data.lastIndexOf("/") + 1)
		})
}

function createSSHConfigFile (config) {
	fs.readFile(path.join(process.env.HOME, "/.ssh/config" ) ,'utf8', function (err, data) {
		if( err ){
			console.log("creating ssh config file")
			helpers.sh("echo '#Vigour Machines\nHost github-machines \n  HostName github.com \n  User git \n  IdentityFile ~/.ssh/id_rsa_machines' >> ~/.ssh/config")
		}
		else{
			if (data.indexOf("#Vigour Machines") === -1){
				helpers.sh("echo '\n\n#Vigour Machines\nHost github-machines \n  HostName github.com \n  User git \n  IdentityFile ~/.ssh/id_rsa_machines' >> ~/.ssh/config")
			}
		}
	})
}

function syncAssets (config) {
	return new Promise(function (resolve, reject) {
		helpers.sh('rm -rf *'
			, { cwd: config.releaseRepo.absPath }
			, function (error, stdout, stderr) {
				if (error) {
					reject(error)
				} else {
					resolve(fs.expandStars(config.assets, process.cwd())
						.then(flatten)
						.then(function (newAssets) {
							var key
								, arr = []
							newAssets['package.json'] = true
							for (key in newAssets) {
								arr.push(cp(path.join(process.cwd(), key)
									, path.join(config.releaseRepo.absPath, key)).catch(function () {
										console.log(arguments)
									}))
							}
							return Promise.all(arr)
						})
					)
				}
			})
	})
}
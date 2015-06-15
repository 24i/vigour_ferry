var path = require('path')
	, log = require('npmlog')
	, helpers = require('./helpers')


module.exports = exports = deploy

function deploy (config) {
	log.info("Server config", config.server)
	return sendFiles(config)
		.then(install)
		.then(function () {
			log.info("DONE")
			return config
		})
		.catch(function (reason) {
			log.error("UH OH", reason)
		})
}

function sendFiles (config) {
	return helpers.sh("scp -i " + config.server.identity
			+ " " + config.server.ssh.id
			+ " " + config.server.ssh.key
			+ " " + config.server.ssl.cert
			+ " " + config.server.ssl.key
			+ " " + path.join(__dirname, "install.sh")
			+ " " + path.join(process.cwd(), ".package.json")
			+ " " + config.server.user
			+ "@" + config.server.ip
			+ ":" + config.server.remoteHome)
		.then(function (stdout) {
			console.log(stdout)
		})
}

function install (config) {
	return helpers.sh("ssh -i " + config.server.identity
			+ " " + config.server.user
			+ "@" + config.server.ip
			+ " " + "\"" + "screen -d -m ./install.sh" + " '" + config.server.ssl.password + "'\"")
		.then(function (stdout) {
			console.log(stdout)
		})
}
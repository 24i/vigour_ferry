var path = require('path')
var log = require('npmlog')
var helpers = require('./helpers')

module.exports = exports = deploy

function deploy (config) {
  log.info('Server config', config.server.plain())
  return sendFiles(config)
    .then(install)
    .then(function () {
      log.info('DONE')
      return config
    })
    .catch(function (reason) {
      log.error('UH OH', reason)
    })
}

function sendFiles (config) {
  return helpers.sh('scp -i ' + config.server.identity.val +
      ' ' + config.server.ssh.id.val +
      ' ' + config.server.ssh.key.val +
      ' ' + config.server.ssl.cert.val +
      ' ' + config.server.ssl.key.val +
      ' ' + path.join(__dirname, 'install.sh') +
      ' ' + path.join(process.cwd(), '.package.json') +
      ' ' + config.server.user.val +
      '@' + config.server.ip.val +
      ':' + config.server.remoteHome.val)
    .then(function (stdout) {
      console.log(stdout)
    })
}

function install (config) {
  return helpers.sh('ssh -i ' + config.server.identity.val +
      ' ' + config.server.user.val +
      '@' + config.server.ip.val +
      ' ' + '"' + 'screen -d -m ./install.sh' + ' \'' + config.server.ssl.password.val + '\'"')
    .then(function (stdout) {
      console.log(stdout)
    })
}

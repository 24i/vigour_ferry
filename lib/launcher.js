var path = require('path')
var btoa = require('btoa')
var release = require('./release')
var cleanup = require('./cleanup')
var deploy = require('./deploy')
var serve = require('./serve')

module.exports = exports = function (opts) {
  var action
  var config = opts.vigour.packer

  if (config.cleanup) {
    action = cleanup
  } else if (config.release) {
    action = release
    releaseRepoName(config)
    config.releaseRepo.absPath = path.join(
      path.dirname(process.cwd())
      , config.releaseRepo.name)
    config.git.api.headers.Authorization = 'Basic ' +
      btoa(config.git.username +
      ':' +
      config.git.password)
    config.git.url = 'git@github-machines'
  } else if (config.deploy) {
    action = deploy
  } else {
    action = serve
    if (!config.src) {
      releaseRepoName(config)
      config.git.api.headers.Authorization = 'Basic ' +
        btoa(config.git.username +
          ':' +
          config.git.password)
    }
    try {
      config.slack.pathPart = '/services/' +
        config.slack.id
    } catch (e) {
      // log.warn("Slack config invalid", e, e.stack)
    }
  }

  return action(config)
}

function releaseRepoName (config) {
  config.releaseRepo.name = config.git.repo +
    config.releaseRepo.suffix
}
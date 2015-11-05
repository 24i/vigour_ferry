var path = require('path')
var btoa = require('btoa')

module.exports = exports = Ferry

var Config = require('vigour-js/lib/config')

function Ferry (config) {
  if (!(config instanceof Config)) {
    config = new Config(config)
  }
  this.config = config
}

Ferry.prototype.start = function () {
  this.config.assetRoot = {
    val: path.join(__dirname, '..', 'files')
  }
  if (this.config.cleanup.val) {
    return this.cleanup()
  } else if (this.config.release.val) {
    this.releaseRepoName()
    this.config.releaseRepo.absPath.val = path.join(path.dirname(process.cwd()),
      this.config.releaseRepo.name.val)
    this.authorization()
    this.config.git.url.val = 'git@github-machines'
    return this.release()
  } else if (this.config.deploy.val) {
    return this.deploy()
  } else {
    if (!this.config.src.val) {
      this.releaseRepoName()
      this.authorization()
    }
    this.config.slack.pathPart = {
      val: '/services/' +
        this.config.slack.id.val
    }
    return this.serve()
  }
}

Ferry.prototype.releaseRepoName = function () {
  this.config.releaseRepo.name.val = this.config.git.repo.val +
    this.config.releaseRepo.suffix.val
}

Ferry.prototype.authorization = function () {
  this.config.git.api.headers.Authorization = 'Basic ' +
    btoa(this.config.git.username.val +
      ':' +
      this.config.git.password.val)
}

Ferry.prototype.release = require('./release')
Ferry.prototype.cleanup = require('./cleanup')
Ferry.prototype.deploy = require('./deploy')
Ferry.prototype.serve = require('./serve')

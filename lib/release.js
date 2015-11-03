var path = require('path')
var Promise = require('promise')
var fs = require('vigour-fs')
var readFile = Promise.denodeify(fs.readFile)
var writeFile = Promise.denodeify(fs.writeFile)
var prependFile = Promise.denodeify(fs.prependFile)
var chmod = Promise.denodeify(fs.chmod)
var stat = Promise.denodeify(fs.stat)
var flatten = require('vigour-js/lib/util/flatten')
var git = require('./git')
var helpers = require('./helpers')
var cp = Promise.denodeify(fs.cp)
var log = require('npmlog')

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
      log.error('oops', reason)
      throw reason
    })
}

function getReleaseRepo (config) {
  return (new Promise(function (resolve, reject) {
    if (!config.git.branch) {
      resolve(getGitBranch(config))
    } else {
      resolve()
    }
  })).then(function () {
    return chmod(path.join(process.env.HOME, '.ssh', 'id_rsa_machines'), '0400')
  })
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
                  // .then(function () {
                  //   return git.createPublicKey(config)
                  // })
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
      config.git.branch = (data.slice(data.lastIndexOf('/') + 1)).trim()
    })
}

function createSSHConfigFile (config) {
  var filePath = path.join(process.env.HOME, '.ssh', 'config')
  var text = '#Vigour Machines\nHost github-machines \n  HostName github.com \n  User git \n  IdentityFile ~/.ssh/id_rsa_machines\n\n'
  return readFile(filePath, 'utf8')
    .then(function (data) {
      if (data.indexOf(text) === -1) {
        return prependFile(filePath, text)
      }
    }
    , function (err) {
      if (err.code === 'ENOENT') {
        console.log('creating ssh config file')
        return writeFile(filePath, text)
      } else {
        throw err
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
          log.info('Copying assets')
          resolve(fs.expandStars(config.assets, process.cwd())
            .then(function (val) {
              return flatten(val, '/')
            })
            .then(function (newAssets) {
              var key
              var arr = []
              var filePath
              newAssets['package.json'] = true
              for (key in newAssets) {
                filePath = path.join(process.cwd(), key)
                arr.push(copyNonEmpty(filePath, path.join(config.releaseRepo.absPath, key)))
              }
              return Promise.all(arr)
            })
          )
        }
      })
  })
}

function copyNonEmpty (src, dst) {
  return stat(src)
    .then(function (stats) {
      if (stats.size === 0) {
        var error = new Error('Empty file')
        error.info = {
          path: src
        }
        throw error
      }
    })
    .then(function () {
      return cp(src, dst, { mkdirp: true })
    })
}

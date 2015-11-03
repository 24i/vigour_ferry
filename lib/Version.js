var https = require('https')

var path = require('path')

var log = require('npmlog')
var Promise = require('promise')
var Blake = require('blake2s')
var fs = require('vigour-fs')
var _merge = require('lodash/object/merge')
var hash = require('vigour-js/lib/util/hash')
var State = require('./State')
var util = require('./util')
var helpers = require('./helpers')
var Transformer = require('./Transformer')
var ShaHistory = require('./ShaHistory')

var shaHistory

var read = Promise.denodeify(fs.readFile)
var readJSON = Promise.denodeify(fs.readJSON)
var write = Promise.denodeify(fs.writeFile)
var mkdirp = Promise.denodeify(fs.mkdirp)
var readdir = Promise.denodeify(fs.readdir)
var remove = Promise.denodeify(fs.remove)
var exists = function (path) {
  return new Promise(function (resolve, reject) {
    fs.exists(path, resolve)
  })
}
var transformer
var state

module.exports = exports = Version

function Version (sha, config) {
  var self = this
  transformer = new Transformer(config)
  shaHistory = new ShaHistory(config)
  self.config = config
  self.sha = sha
  state = new State(config)
  self.root = path.join(self.config.assetRoot, self.config.shaDir, self.sha)
  self.packagePath = path.join(self.root
    , 'package.json')
  self.manifestPath = path.join(self.root
    , self.config.buildDir
    , 'manifest.json')
  self.appCacheManifestPath = path.join(self.root
    , self.config.buildDir
    , 'manifest.appcache')
  self.getManifest = helpers.getter(function () {
    return self.getPkg()
      .then(function (pkg) {
        return self.makeManifest(pkg)
      })
      .catch(state.log("Can't make manifest"))
      .then(function (manifest) {
        return mkdirp(self.manifestPath.slice(0
          , self.manifestPath.lastIndexOf('/')))
          .then(function () {
            return manifest
          })
      })
      .then(function (manifest) {
        return write(self.manifestPath, manifest, 'utf8')
      })
      .catch(state.log("Can't write manifest"))
      .then(function () {
        return self.manifestPath
      })
  })

  self.getAppCacheManifest = helpers.getter(function () {
    return self.getPkg()
      .then(function (pkg) {
        return self.makeAppCacheManifest(pkg)
      })
      .catch(state.log("Can't make app cache manifest"))
      .then(function (acm) {
        return mkdirp(self.appCacheManifestPath.slice(0
          , self.appCacheManifestPath.lastIndexOf('/')))
          .then(function () {
            return acm
          })
      })
      .then(function (acm) {
        return write(self.appCacheManifestPath, acm, 'utf8')
      })
      .catch(state.log("Can't write app cache manifest"))
      .then(function () {
        return self.appCacheManifestPath
      })
  })

  self.getPkg = helpers.getter(function () {
    return readJSON(self.packagePath)
      .then(function (parsed) {
        parsed.sha = self.sha
        parsed.repository.branch = self.config.git.branch
        if (self.config.git.branch === 'dev') {
          parsed.version = helpers.hNow() +
            ' ' +
            '(' + self.sha + ')'
        }
        var section = parsed.vigour
        if (section) {
          try {
            var branchOptions = section.branches[parsed.repository.branch]
            parsed.vigour = _merge(parsed.vigour, branchOptions)
          } catch (ex) {
            console.log(ex)
          }
        }
        self.version = parsed.version
        return parsed
      })
  })

  self.get = helpers.getter(function () {
    return exists(self.root)
      .then(function (exists) {
        var dl
        if (exists) {
          log.info('We already have', self.sha)
          return self.archive()
            .catch("Can't archive")
        } else {
          dl = self.download()
          dl.catch(state.log("Can't download"))
            .then(self.cleanup.bind(self))
            .catch(state.log("Can't clean up"))
            .then(self.archive.bind(self))
            .catch(state.log("Can't archive"))
          return dl
        }
      })
  })
}

Version.prototype.prep = function () {
  var self = this
  return self.get()
    .catch(state.log("Can't get version"))
    .then(function () {
      return self.getAppCacheManifest()
    })
    .catch(state.log("Can't create app cache manifest"))
    .then(function () {
      return self.getManifest()
    })
    .catch(state.log('Version.getManifest() fails'))
}

Version.prototype.getAsset = function (file, params, shaRequest) {
  var self = this
  return self.getPkg()
    .catch(state.log("Can't get pkg"))
    .then(function (pkg) {
      var allTransforms = pkg.vigour.packer.transforms || {}
      var transforms
      if (file.indexOf('/') === 0) {
        file = file.slice(1)
      }
      if (file === '') {
        file = pkg.vigour.packer.web
      }
      transforms = (file in allTransforms)
        ? allTransforms[file]
        : false

      if (transforms) {
        return self.getTransformed(file
          , transforms
          , params
          , shaRequest)
      } else {
        return path.join(self.root, file)
      }
    })
    .catch(state.log("Can't get transformed"))
}

Version.prototype.getTransformed = function (file, transforms, params, shaRequest) {
  var self = this
  var l = transforms.length
  var i
  var id = ''
  var toSave = {}
  var required
  var nb
  var j
  var originalPath
  var transformedPath
  for (i = 0; i < l; i += 1) {
    required = transformer[transforms[i]].params
    nb = required.length
    for (j = 0; j < nb; j += 1) {
      id += params[required[j]]
      toSave[required[j]] = params[required[j]]
    }
  }
  id = hash(id)
  originalPath = path.join(self.root, file)
  transformedPath = originalPath +
    '_' +
    id +
    path.extname(file)
  return exists(transformedPath)
    .catch(state.log("Can't call exists"))
    .then(function (exists) {
      var p
      if (exists) {
        transformer.history.save(file, id, toSave)
        return transformedPath
      } else {
        p = read(originalPath, 'utf8')
          .then(function (data) {
            return self.getPkg()
              .then(function (pkg) {
                return transformer.transform(data
                  , transforms
                  , params
                  , pkg
                  , self)
              })
          })
          .then(function (newData) {
            if (newData.length === 0) {
              throw new Error('transformed file data has a size of 0')
            }
            return write(transformedPath, newData, 'utf8')
          })
          .then(function () {
            transformer.history.save(file, id, toSave)
            return transformedPath
          })
        // if (shaRequest) {
        //  return false
        // } else {
        return p
        // }
      }
    })
    .catch(state.log("Can't get transformed "))
}

Version.prototype.replayTransforms = function () {
  var self = this
  transformer.history.get()
    .catch(state.log("Can't get transform history"))
    .then(function (history) {
      self.getPkg()
        .catch(state.log("Can't get pkg"))
        .then(function (pkg) {
          var file
          var id
          var arr = []
          for (file in history) {
            if (pkg.vigour.packer.transforms[file]) {
              for (id in history[file]) {
                arr.push({
                  file: file,
                  params: history[file][id]
                })
              }
            }
          }
          arr.reduce(function (previous, current, index, array) {
            return previous.then(function () {
              return self.getAsset(current.file
                , current.params)
                  .catch(state.log("Can't replay transform"))
            })
          }
          , Promise.resolve())
            .catch(state.log("Can't replay transforms"))
        })
    })
}

Version.prototype.makeAppCacheManifest = function (pkg) {
  var self = this
  return new Promise(function (resolve, reject) {
    var acm
    var assets
    try {
      acm = 'CACHE MANIFEST\n'
      acm += '#' + pkg.version + '\n'
      acm += pkg.vigour.packer.web + '\n'
      self.expandStars(pkg.vigour.packer.assets
        , self.root
        , function (err, extended) {
          if (err) {
            err.message += ': Error expanding stars'
            err.path = pkg.vigour.packer.assets
            reject(err)
            return
          }
          // Next
          assets = util.listify(extended)
          util.asyncForIn(assets
            , addAsset
            , function (err) {
              if (err) {
                reject(err)
                return
              }
              acm += 'NETWORK:\n'
              acm += '*\n'
              resolve(acm)
            })
        })
    } catch (e) {
      console.error('Error', e)
      console.warn('Do you have `vigour.packer.web` and `vigour.packer.assets` in you package.json?')
    }
    function addAsset (assets, asset, cb) {
      acm += asset + '\n'
      setTimeout(function () {
        cb(null)
      }, 0)
    }
  })
}

Version.prototype.makeManifest = function (pkg) {
  var self = this
  return new Promise(function (resolve, reject) {
    var manifest = {
      commitHash: pkg.sha,
      assets: {

      }
    }
    var assets
    manifest.main = pkg.vigour.packer.main
    manifest.version = pkg.version
    self.expandStars(pkg.vigour.wrapper.assets
      , self.root
      , function (err, extended) {
        if (err) {
          err.message += ': Error expanding stars'
          err.path = pkg.vigour.wrapper.assets
          reject(err)
          return
        }
        // Next
        assets = util.listify(extended)
        util.asyncForIn(assets
          , addAsset
          , function (err) {
            var manifestStr
            if (err) {
              reject(err)
              return
            }
            try {
              manifestStr = JSON.stringify(manifest)
            } catch (e) {
              e.message += ': Error stringifying manifest'
              reject(e)
              return
            }
            // Next
            resolve(manifestStr)
          })
      })

    function addAsset (assets, asset, cb) {
      fs.readFile(path.join(self.root, asset), function (err, data) {
        if (err) {
          cb(err)
        } else {
          var blake = new Blake(32)
          blake.update(data)
          insertAsset(manifest.assets, asset, blake.digest('hex'))
          cb(null)
        }
      })
    }

    function insertAsset (obj, assetPath, hashed) {
      var ref = obj
      var parts = assetPath.split('/')
      var name = parts.pop()
      var part = parts.shift()
      while (part) {
        if (!ref[part]) {
          ref[part] = {}
        }
        ref = ref[part]
        part = parts.shift()
      }
      ref[name] = hashed
    }
  })
}

Version.prototype.archive = function () {
  var self = this
  var mustErase = false
  return shaHistory.get()
    .catch(state.log("Can't archive sha"))
    .then(function (history) {
      if (history.indexOf(self.sha) === -1) {
        history.push(self.sha)
      }
      while (history.length >= self.config.maxHistory) {
        mustErase = true
        history.shift()
      }
      if (mustErase) {
        self.removeShas(history)
      }
      return history
    })
    .then(function (newHistory) {
      shaHistory.save(newHistory)
    })
}

Version.prototype.removeShas = function (history) {
  var self = this
  return readdir(path.join(self.config.assetRoot
      , self.config.shaDir))
    .catch(state.log("Can't read shas directory"))
    .then(function (files) {
      var toErase = files.filter(function (item) {
        return item !== '.gitignore' &&
          history.indexOf(item) === -1
      })
      return Promise.all(
        toErase.map(function (item) {
          return remove(path.join(self.config.assetRoot
              , self.config.shaDir
              , item))
            .catch(state.log("Can't remove obsolete sha"))
        })
      )
    })
}

Version.prototype.download = function () {
  var self = this
  log.info('Downloading version', self.sha)
  return new Promise(function (resolve, reject) {
    log.info('Checking GitHub for existance of', self.sha)
    var options
    if (self.sha === '_local') {
      resolve(self.getLocal())
    } else {
      options = {
        hostname: self.config.git.api.hostname,
        path: '/' + path.join('repos',
          self.config.git.owner,
          self.config.releaseRepo.name,
          'git',
          'commits',
          self.sha),
        headers: self.config.git.api.headers,
        method: 'HEAD'
      }
      var req = https.request(options
        , function (res) {
          var error
          res.on('error', reject)
          if (res.statusCode !== 200) {
            error = new Error(
              "GitHub doesn't return 200 for this sha")
            error.sha = self.sha
            error.statusCode = res.statusCode
            error.invalidRequest = true
            error.options = options
            return reject(error)
          }
          resolve(self.clone())
        })
      req.on('error', reject)
      req.end()
    }
  })
}

Version.prototype.getLocal = function () {
  var self = this
  log.info('heapUsed: ', process.memoryUsage().heapUsed)
  log.info(helpers.hNow() + ' Copying ', self.config.src)
  return helpers.sh('cp -fR ' +
        (path.isAbsolute(self.config.src)
          ? self.config.src
          : path.join(process.cwd(), self.config.src)) +
        ' ' +
        self.sha
      , { cwd: path.join(self.config.assetRoot, self.config.shaDir) })
    .then(function () {
      log.info(helpers.hNow(), 'Done cloning')
      log.info('heapUsed: ', process.memoryUsage().heapUsed)
      return true
    })
}

Version.prototype.clone = function () {
  var self = this
  log.info('heapUsed: ', process.memoryUsage().heapUsed)
  log.info(helpers.hNow() + ' Cloning ', self.config.releaseRepo.name)
  return helpers.sh('git clone --depth=1 -b ' +
        self.config.git.branch +
        ' ' +
        self.config.git.url +
        ':' +
        self.config.git.owner +
        '/' +
        self.config.releaseRepo.name +
        '.git' +
        ' ' +
        self.sha
      , { cwd: path.join(self.config.assetRoot, self.config.shaDir) })
    .then(function () {
      log.info(helpers.hNow(), 'Done cloning')
      log.info('heapUsed: ', process.memoryUsage().heapUsed)
      return true
    })
}

Version.prototype.cleanup = function () {
  var self = this
  return remove(path.join(self.root, '.git'))
}

Version.prototype.expandStars = function (src, rootPath, cb) {
  var acc = []
  var nbPending = 0
  var errors = []
  function traverse (obj) {
    var key
    for (key in obj) {
      acc.push(key)
      if (typeof obj[key] === 'object') {
        traverse(obj[key])
      } else if (obj[key] === '*') {
        nbPending += 1
        expand(obj, key, path.join(rootPath, acc.join('/')), expandDone)
      }
      acc.pop()
    }

    function expandDone (err) {
      nbPending -= 1
      done(err)
    }
  }

  traverse(src)
  done()

  function expand (obj, key, rootPath, callback) {
    fs.walk(rootPath, {
      exclude: /^\./
    }
    , function (err, tree) {
      if (err) {
        callback(err)
      }
      obj[key] = tree
      callback(null)
    })
  }

  function done (err) {
    if (err) {
      errors.push(err)
    }
    if (nbPending === 0) {
      if (errors.length === 0) {
        cb(null, src)
      } else {
        cb(errors)
      }
    }
  }
}

var path = require('path')
  , Promise = require('promise')
  , fs = require('graceful-fs')
  , log = require('npmlog')
  , config = require('./config')
  , helpers = require('./helpers')
  , error = require('./error')
  , read = Promise.denodeify(fs.readFile)
  , write = Promise.denodeify(fs.writeFile)

module.exports = exports = {}
exports.log = function (msg, warnDev, ignore) {
  return function (reason) {
    error.print(msg, reason)
    if (warnDev && !reason.warned) {
      exports.warnDev(msg + "; reason: " + reason)
      reason.warned = true
    }
    if (ignore) {
      return true
    } else {
      throw reason
    }
  }
}
exports.path = path.join(config.assetRoot
  , 'state.json')
exports.resolvePending = function (value) {
  this.settle(null, value)
}
exports.rejectPending = function (reason) {
  this.settle(reason)
}
exports.settle = function (err, data) {
  var cb
  while (cb = this.pending.shift()) {
    cb(err, data)
  }
}
exports.get = helpers.getter(function () {
  return read(exports.path, 'utf8')
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
    .catch(exports.log("Can't get state"))
})
exports.save = function (key, value) {
  var self = this
  return self.get()
    .catch("Can't state.get")
    .then(function (data) {
      data[key] = value
      return write(exports.path
            , JSON.stringify(data)
            , 'utf8')
          .catch(exports.log("Can't write state"))
    })
    .catch(exports.log("Can't save state"))
}
exports.isAlreadyWarned = function () {
  return exports.get()
    .catch(exports.log("Can't state.get"))
    .then(function (data) {
      return data.lastWarning
        && (!data.lastGoLive
          || data.lastWarning > data.lastGoLive)
    })
}
exports.warnDev = function (msg, quiet) {
  return exports.isAlreadyWarned()
    .catch(exports.log("Can't check if already warned"))
    .then(function (alreadyWarned) {
      if (!alreadyWarned) {
        return error.warnDev(msg)
          .catch(exports.log("Can't error.warnDev"))
          .then(function () {
            t = Date.now()
            if (!quiet) {
              return exports.get()
                .catch(exports.log("Can't state.get"))
                .then(function (data) {
                  data.lastWarning = t
                  return exports.save(data)
                })
            }
          })
      }
      else {
        log.info("Already warned once since the last successful goLive")
      }
    })
}
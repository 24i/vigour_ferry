var path = require('path')
var Promise = require('promise')
var fs = require('graceful-fs')
var log = require('npmlog')
var helpers = require('./helpers')
var ErrorManager = require('./ErrorM')
var read = Promise.denodeify(fs.readFile)
var write = Promise.denodeify(fs.writeFile)
var _instance

module.exports = exports = State

function State (config) {
  if (_instance) {
    return _instance
  } else {
    this.path = path.join(config.assetRoot.val, config.stateFileName.val)
    this.error = new ErrorManager(config)
    _instance = this
    return this
  }
}

State.prototype.log = function (msg, warnDev, ignore) {
  var self = this
  return function (reason) {
    self.error.print(msg, reason)
    if (warnDev && !reason.warned) {
      self.warnDev(msg + '; reason: ' + reason)
      reason.warned = true
    }
    if (ignore) {
      return true
    } else {
      throw reason
    }
  }
}
State.prototype.resolvePending = function (value) {
  this.settle(null, value)
}
State.prototype.rejectPending = function (reason) {
  this.settle(reason)
}
State.prototype.settle = function (err, data) {
  var cb = this.pending.shift()
  while (cb) {
    cb(err, data)
    cb = this.pending.shift()
  }
}
State.prototype.get = helpers.getter(function () {
  var self = this
  return read(self.path, 'utf8')
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
    .catch(self.log("Can't get state"))
})
State.prototype.save = function (key, value) {
  var self = this
  return self.get()
    .catch("Can't state.get")
    .then(function (data) {
      data[key] = value
      return write(self.path
            , JSON.stringify(data)
            , 'utf8')
          .catch(self.log("Can't write state"))
    })
    .catch(self.log("Can't save state"))
}
State.prototype.isAlreadyWarned = function () {
  var self = this
  return self.get()
    .catch(self.log("Can't state.get"))
    .then(function (data) {
      return data.lastWarning &&
        (!data.lastGoLive ||
          data.lastWarning > data.lastGoLive)
    })
}
State.prototype.warnDev = function (msg, quiet) {
  var self = this
  return self.isAlreadyWarned()
    .catch(self.log("Can't check if already warned"))
    .then(function (alreadyWarned) {
      if (!alreadyWarned) {
        return self.error.warnDev(msg)
          .catch(self.log("Can't error.warnDev"))
          .then(function () {
            var t = Date.now()
            if (!quiet) {
              return self.get()
                .catch(self.log("Can't state.get"))
                .then(function (data) {
                  data.lastWarning = t
                  return self.save(data)
                })
            }
          })
      } else {
        log.info('Already warned once since the last successful goLive', msg)
      }
    })
}

var path = require('path')
var Promise = require('promise')
var fs = require('vigour-fs')
var State = require('./State')
var helpers = require('./helpers')

var read = Promise.denodeify(fs.readFile)
var write = Promise.denodeify(fs.writeFile)
var state

module.exports = exports = ShaHistory

function ShaHistory (config) {
  state = new State(config)
  this.path = path.join(config.assetRoot.val
    , config.shaHistoryName.val)
}

ShaHistory.prototype.resolvePending = function (value) {
  this.settle(null, value)
}
ShaHistory.prototype.rejectPending = function (reason) {
  this.settle(reason)
}
ShaHistory.prototype.settle = function (err, data) {
  var cb = this.pending.shift()
  while (cb) {
    cb(err, data)
    cb = this.pending.shift()
  }
}
ShaHistory.prototype.get = helpers.getter(function () {
  return read(this.path, 'utf8')
    .then(function (data) {
      var value = JSON.parse(data)
      return value
    }
    , function (reason) {
      var value
      if (reason.code === 'ENOENT') {
        value = []
        return value
      } else {
        throw reason
      }
    })
    .catch(state.log("Can't get parsed sha history"))
})
ShaHistory.prototype.save = function (newHistory) {
  return write(this.path
      , JSON.stringify(newHistory)
      , 'utf8')
    .catch(state.log("Can't write sha history"))
}

ShaHistory.prototype.removeLatest = function () {
  var self = this
  return self.get()
    .then(function (history) {
      var latest = history.pop()
      self.save(history)
      return latest
    })
}

var path = require('path')
var Promise = require('promise')
var log = require('npmlog')
var fs = require('vigour-fs')
var readdir = Promise.denodeify(fs.readdir)
var remove = Promise.denodeify(fs.remove)

module.exports = exports = cleanup

function cleanup () {
  var self = this
  return Promise.all([
    path.join(self.config.assetRoot.val, 'shas/'),
    path.join(self.config.assetRoot.val, 'state.json'),
    path.join(self.config.assetRoot.val, 'history.json')
  ].map(function (item) {
    if (item[item.length - 1] === '/') {
      return readdir(item)
        .then(function (files) {
          return Promise.all(files.map(function (i) {
            if (i !== '.gitignore') {
              return remove(path.join(item, i))
            } else {
              return Promise.resolve()
            }
          }))
        })
    } else {
      return remove(item)
    }
  }))
  .then(function () {
    log.info('Done')
  })
}

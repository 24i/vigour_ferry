var path = require('path')

var Promise = require('promise')
var UglifyJS = require('uglify-js')
var fs = require('vigour-fs')
var cloneDeep = require('lodash/lang/cloneDeep')
var vConfig = require('vigour-js/util/config')
var vConfigUA = require('vigour-js/util/config/ua')
var State = require('./State')
var state
var helpers = require('./helpers')

var read = Promise.denodeify(fs.readFile)
var write = Promise.denodeify(fs.writeFile)

module.exports = exports = Transformer

function Transformer (opts) {
  state = new State(opts)
  this.config = opts
  this.history.path = path.join(this.config.assetRoot
    , 'transformHistory.json')
}

Transformer.prototype.rebase = function (data, params, pkg) {
  var self = this
  return new Promise(function (resolve, reject) {
    var base = decodeURIComponent(params.fsRoot)
      .replace('/' + self.config.shaPlaceholder + '/'
        , '/' + pkg.sha + '/')
    resolve(data.replace(Transformer.prototype.rebase.rebaseRE
      , function (match
        , p1
        , p2
        , p3
        , p4
        , p5
        , offset
        , string) {
          var newStr
          if (p2) {
            newStr = p1 +
              self.rebase.urlToken(base) +
              p2 +
              p5
          } else if (p3) {
            newStr = p1 +
              '"' +
              self.rebase.stringToken(base, '"') +
              p3 +
              '"' +
              p5
          } else if (p4) {
            newStr = p1 +
              "'" +
              self.rebase.stringToken(base, "'") +
              p4 +
              "'" +
              p5
          } else {
            newStr = match
          }
          return newStr
        }))
  })
}
Transformer.prototype.rebase.params = ['fsRoot']
Transformer.prototype.rebase.rebaseRE =
  /(url\()(?:\s*(?!https?:\/\/|data:)((?:[^"'()\\]|\\(?:[^\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\s?))*)\s*|\s*"(?!https?:\/\/|data:)((?:[^"\\\n]|\\(?:[^\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\s?)|\\\n)*)"\s*|\s*'(?!https?:\/\/|data:)((?:[^'\\\n]|\\(?:[^\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\s?)|\\\n)*)'\s*)(\))/gi
Transformer.prototype.rebase.stringToken = function (str, quote) {
  return this.escapeChars(str, [quote, '\n'])
}
Transformer.prototype.rebase.urlToken = function (str) {
  return this.escapeChars(str
    , ["'", '"', '\\(', '\\)', '\\s', '[\\x00-\\x1F]'])
}
Transformer.prototype.rebase.escapeChars = function (str, chars) {
  var l = chars.length
  var i
  for (i = 0; i < l; i += 1) {
    str = this.escapeChar(str, chars[i])
  }
  return str
}
Transformer.prototype.rebase.escapeChar = function (str, char) {
  var la = (char === '\\\\')
      ? '(?!\\\\)'
      : ''
  var escapeCharRE = new RegExp('(?:^(' + char + ')' + la +
      '|(\\\\(?:[^\\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\\s?))(' + char +
      ')|([^\\\\])(' + char + '))'
    , 'gi')
  return str.replace(escapeCharRE, function (match
    , p1
    , p2
    , p3
    , p4
    , p5
    , offset
    , string) {
      var newStr
      if (p1) {
        newStr = '\\' + p1
      } else if (p2) {
        newStr = p2 + '\\' + p3
      } else if (p4) {
        newStr = p4 + '\\' + p5
      } else {
        newStr = match
      }
      return newStr
    })
}

Transformer.prototype.uglify = function (data, params, pkg) {
  return new Promise(function (resolve, reject) {
    var ugly = UglifyJS.minify(data, {
      fromString: true
    })
    resolve(ugly.code)
  })
}

Transformer.prototype.inform = function (data, params, pkg) {
  return new Promise(function (resolve, reject) {
    var prefix
    var uaSpecific = cloneDeep(pkg)

    vConfig.parse(uaSpecific.vigour
      , uaSpecific
      , vConfigUA
      , params)
    prefix = 'window.package=' + JSON.stringify(uaSpecific) + ';'
    resolve(prefix + data)
  })
}
Transformer.prototype.inform.params = ['ua']

Transformer.prototype.transform = function (data, transforms, params, pkg) {
  var self = this
  return new Promise(function (resolve, reject) {
    var l = transforms.length
    var i = 0
    t(data)
    function t (data) {
      self[transforms[i]](data, params, pkg)
        .catch(state.log("Can't transform"))
        .then(function (newData) {
          i += 1
          if (i < l) {
            t(newData)
          } else {
            resolve(newData)
          }
        }, reject)
        .catch(state.log("Can't continue transform chain or return"))
    }
  })
}
Transformer.prototype.history = {}
Transformer.prototype.history.path = null
Transformer.prototype.history.resolvePending = function (value) {
  this.settle(null, value)
}
Transformer.prototype.history.rejectPending = function (reason) {
  this.settle(reason)
}
Transformer.prototype.history.settle = function (err, data) {
  var cb = this.pending.shift()
  while (cb) {
    cb(err, data)
    cb = this.pending.shift()
  }
}
Transformer.prototype.history.get = helpers.getter(function () {
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
    .catch(state.log("Can't get parsed transform history"))
})
Transformer.prototype.history.save = function (file, id, toSave) {
  var self = this
  self.get()
    .then(function (data) {
      if (!data[file]) {
        data[file] = {}
      }
      if (!data[file][id]) {
        data[file][id] = toSave
        return write(self.path
            , JSON.stringify(data)
            , 'utf8')
          .catch(state.log("Can't write transform history"))
      }
    })
    .catch(state.log("Can't save transform history"))
}

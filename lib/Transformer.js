'use strict'

var path = require('path')

var Promise = require('promise')
var UglifyJS = require('uglify-js')
var _template = require('lodash.template')
var _trim = require('lodash.trim')
var fs = require('vigour-fs-promised')
var State = require('./State')
var state
var helpers = require('./helpers')

module.exports = exports = Transformer

function Transformer (opts) {
  state = new State(opts)
  this.config = opts
  this.history.path = path.join(this.config.assetRoot.val
    , 'transformHistory.json')
}

Transformer.prototype.rebase = function (data, params, pkg, version) {
  var self = this
  return new Promise(function (resolve, reject) {
    var base = decodeURIComponent(params.fsRoot)
      .replace('/' + self.config.shaPlaceholder.val + '/'
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

Transformer.prototype.uglify = function (data, params, pkg, version) {
  return new Promise(function (resolve, reject) {
    var ugly = UglifyJS.minify(data, {
      fromString: true
    })
    resolve(ugly.code)
  })
}

function getMetaFile (_url, filename, region) {
  if (!filename || !region) {
    return Promise.resolve(false)
  }
  var template = _template(filename)
  var url = `${_url}/jsons/` + template({ region: region })
  console.log('downloading meta file from', url)
  return fs.readFileAsync(url, 'utf8')
    .catch((reason) => {
      if (region === 'en') {
        return false
      }
      var fallbackUrl = `${_url}/data/` + template('en')
      console.log('downloading fallback meta file from', url)
      return fs.readFileAsync(fallbackUrl, 'utf8')
    })
}

Transformer.prototype.langs = function (data, params, pkg, version) {
  var re = /(?:\?|&)lang=([a-zA-Z]{2})/
  var match = params.path.match(re)
  var pageLang = match
    ? match[1]
    : 'en'
  var base = params.path.replace(re, '')
  var insert = '\n'
  var langPart = base.indexOf('?') === -1
    ? '?lang='
    : '&lang='
  for (var key in params.langs) {
    let lang = params.langs[key]
    let hreflang = lang === pageLang
      ? 'x'
      : lang
    insert += `<link rel="alternate" hreflang="${hreflang}" href="http://${params.host}${base}${langPart}${lang}" />\n`
  }

  insert += `<link rel="canonical" href="http://${params.host}${base}" />\n`
  insert += '</head>'
  return Promise.resolve(data.replace('</head>', insert))
}
Transformer.prototype.langs.params = ['path', 'langs', 'host', 'querystring']

Transformer.prototype.meta = function (data, params, pkg, version) {
  // console.log('Getting meta file', this.config.jsonldurl.val, params.meta, params.region)
  return getMetaFile(this.config.jsonldurl.val, params.meta, params.region)
    .then(function (str) {
      if (str) {
        // console.log('Got meta file', params.meta, str)
        var insert = '<script type="application/ld+json">' + str + '</script>'
        try {
          var json = JSON.parse(str)
          if (json.description) {
            insert += '<meta name="description" content="' + _trim(json.description) + '">'
          }
          if (json.name) {
            var newTitle = _trim(json.name)
            if (json.partOfTVSeries) {
              newTitle = _trim(json.partOfTVSeries) + ' - ' + newTitle
            }
            data = data.replace(new RegExp('<title>(.|\\n)*<\/title>', 'i'), '<title>' + newTitle + '</title>')
          }
        } catch (e) {
          e.info = 'fileName: ' + params.meta + ', region: ' + params.region
          console.error('Cannot `JSON.parse` json file', e)
        }
        return data.replace('</head>', insert)
      } else {
        console.warn("Couldn't find meta file", params.meta, '(region: ' + params.region + ')')
        return data
      }
    }, function (reason) {
      console.error('Cannot read meta file ' + params.meta + ' (region: ' + params.region + ')', reason)
      return data
    })
}
Transformer.prototype.meta.params = ['meta', 'region']

Transformer.prototype.inform = function (data, params, pkg, version) {
  return new Promise(function (resolve, reject) {
    var prefix = 'window.package=' + JSON.stringify(pkg) + ';'
    resolve(prefix + data)
  })
}
Transformer.prototype.inform.params = []

Transformer.prototype.transform = function (data, transforms, params, pkg, version) {
  var self = this
  return new Promise(function (resolve, reject) {
    var l = transforms.length
    var i = 0
    t(data)
    function t (data) {
      self[transforms[i]](data, params, pkg, version)
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
  return fs.readFileAsync(self.path, 'utf8')
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
        return fs.writeFileAsync(self.path
            , JSON.stringify(data)
            , 'utf8')
          .catch(state.log("Can't write transform history"))
      }
    })
    .catch(state.log("Can't save transform history"))
}

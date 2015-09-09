module.exports = exports = {}

exports.asyncEach = function (arr, action, cb) {
  var l = arr.length
  var nbLeft = l
  var i
  var errors = []
  if (arr.length === 0) {
    cb(null)
  } else {
    for (i = 0; i < l; i += 1) {
      action(arr[i], function (err) {
        if (err) {
          errors.push(err)
          nbLeft -= 1
          done()
        } else {
          nbLeft -= 1
          done()
        }
      })
    }
  }
  function done () {
    if (cb && nbLeft === 0) {
      if (errors.length > 0) {
        cb(errors)
      } else {
        cb(null)
      }
    }
  }
}

exports.asyncForIn = function (obj, action, cb) {
  var nbLeft = 0
  var errors = []
  var key
  for (key in obj) {
    nbLeft += 1
    action(obj, key, function (err) {
      nbLeft -= 1
      if (err) {
        errors.push(err)
      }
      if (nbLeft === 0) {
        if (errors.length > 0) {
          cb(errors)
        } else {
          cb(null)
        }
      }
    })
  }
}

exports.stringifyQuery = function (obj) {
  var str = ''
  var key
  for (key in obj) {
    str += '&' + key + '=' + encodeURIComponent(obj[key])
  }
  return str.slice(1)
}

exports.rebase = function (str, base) {
  // var url_token = /(url\()(?:\s*([^"'()\\]|\\([^\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\s?))*\s*|"([^"\\\n]|\\([^\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\s?)|\\\n)*"|'([^'\\\n]|\\([^\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\s?)|\\\n)*')(\))/gi
  //   , url_token_no_http = /(url\()(?!https?:\/\/)(?:\s*([^"'()\\]|\\([^\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\s?))*\s*|"(?!https?:\/\/)([^"\\\n]|\\([^\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\s?)|\\\n)*"|'(?!https?:\/\/)([^'\\\n]|\\([^\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\s?)|\\\n)*')(\))/gi
  //   , url_token_no_http_no_data = /(url\()(?!https?:\/\/|data:)(?:\s*([^"'()\\]|\\([^\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\s?))*\s*|"(?!https?:\/\/|data:)([^"\\\n]|\\([^\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\s?)|\\\n)*"|'(?!https?:\/\/|data:)([^'\\\n]|\\([^\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\s?)|\\\n)*')(\))/gi
  //  , url_token_custom = /(url\()(?:\s*(?!https?:\/\/|data:)((?:[^"'()\\]|\\([^\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\s?))*)\s*|\s*"(?!https?:\/\/|data:)((?:[^"\\\n]|\\([^\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\s?)|\\\n)*)"\s*|'\s*(?!https?:\/\/|data:)((?:[^'\\\n]|\\([^\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\s?)|\\\n)*)\s*'\s*)(\))/gi
  // var re = /(url\()(?:\s*(?!https?:\/\/|data:)((?:[^"'()\\]|\\(?:[^\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\s?))*)\s*|\s*"(?!https?:\/\/|data:)((?:[^"\\\n]|\\(?:[^\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\s?)|\\\n)*)"\s*|'\s*(?!https?:\/\/|data:)((?:[^'\\\n]|\\(?:[^\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\s?)|\\\n)*)\s*'\s*)(\))/gi
  var re = /(url\()(?:\s*(?!https?:\/\/|data:)((?:[^"'()\\]|\\(?:[^\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\s?))*)\s*|\s*"(?!https?:\/\/|data:)((?:[^"\\\n]|\\(?:[^\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\s?)|\\\n)*)"\s*|\s*'(?!https?:\/\/|data:)((?:[^'\\\n]|\\(?:[^\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\s?)|\\\n)*)'\s*)(\))/gi
  /// yo
  return str.replace(re, function (match, p1, p2, p3, p4, p5, offset, string) {
    var newStr
    if (p2) {
      newStr = p1 + exports.urlToken(base) + p2 + p5
    } else if (p3) {
      newStr = p1 + '"' + exports.stringToken(base, '"') + p3 + '"' + p5
    } else if (p4) {
      newStr = p1 + "'" + exports.stringToken(base, "'") + p4 + "'" + p5
    } else {
      newStr = match
    }
    return newStr
  })
}

exports.stringToken = function (str, quote) {
  return exports.escapeChars(str, [quote, '\n'])
}

exports.urlToken = function (str) {
  return exports.escapeChars(str, ["'", '"', '\\(', '\\)', '\\s', '[\\x00-\\x1F]'])
}

exports.escapeChars = function (str, chars) {
  var l = chars.length
  var i
  for (i = 0; i < l; i += 1) {
    str = exports.escapeChar(str, chars[i])
  }
  return str
}

exports.escapeChar = function (str, char) {
  // var re = /(?:(\\(?:[^\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\s?))(")|([^\\])("))/gi

  var la = (char === '\\\\') ?
      '(?!\\\\)' :
      ''
  var re = new RegExp('(?:^(' + char + ')' + la + '|(\\\\(?:[^\\n0-9a-fA-F]|[0-9a-fA-F]{1,6}\\s?))(' + char + ')|([^\\\\])(' + char + '))', 'gi')

  return str.replace(re, function (match, p1, p2, p3, p4, p5, offset, string) {
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

exports.listify = function (obj) {
  var result = {}
  var acc = []

  function traverse (obj) {
    var key
    for (key in obj) {
      acc.push(key)
      if (typeof obj[key] === 'object') {
        traverse(obj[key])
      } else {
        result[acc.join('/')] = obj[key]
      }
      acc.pop()
    }
  }

  traverse(obj)
  return result
}

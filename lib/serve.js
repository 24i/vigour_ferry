'use strict'

var https = require('https')
var http = require('http')
var path = require('path')
var url = require('url')

var express = require('express')
var compress = require('compression')
var bodyParser = require('body-parser')
var Promise = require('promise')
var concat = require('concat-stream')
var log = require('npmlog')
var diskspace = require('diskspace')

var hookListener = require('./hookListener')
var Version = require('./Version')
var PrepQueue = require('./PrepQueue')
var helpers = require('./helpers')
var State = require('./State')
var ErrorManager = require('./ErrorM')
var error
var state
var prepQueue = new PrepQueue()
var live
var server
var web

var latestNewSha
var config

module.exports = exports = serve

function serve () {
  config = this.config
  log.info('CONFIG', JSON.stringify(config.plain(), null, 2))

  web = express()

  error = new ErrorManager(config)
  state = new State(config)
  web.use(compress())
  web.use(logRequest)
  web.use(getUA)
  web.get('/',
    getSha,
    fbMeta,
    addHeaders,
    serveIndex,
    helpers.serveCode(500))
  web.post('/status',
    bodyParser.urlencoded({
      extended: true
    }),
    serveStatus,
    helpers.serveCode(500))
  web.get('/manifest.json',
    serveManifest,
    addHeaders,
    serveFile,
    warnDevMid("Can't serve manifest.json"),
    helpers.serveCode(500))
  web.get('/favicon.ico',
    getSha,
    prepFavicon,
    serveFile,
    // warnDevMid("Can't serve favicon.ico"),
    helpers.serveCode(500))
  if (config.robots.val) {
    web.get('/robots.txt',
      prepRobots,
      serveFile,
      // warnDevMid("Can't serve robots.txt"),
      helpers.serveCode(500))
  }
  if (config.geo.val) {
    web.get('/geo',
      prepGeo,
      serveFile,
      warnDevMid("Can't serve geo"),
      helpers.serveCode(500))
  }
  web.get('/sitemap.xml',
    serveSitemap,
    warnDevMid("Can't serve sitemap.xml"),
    helpers.serveCode(500))
  web.get('/native/:sha/*',
    prepShaRequest,
    getSha,
    fbMeta,
    getAsset,
    addHeaders,
    serveFile,
    helpers.serveCode(404))
  web.get('*',
    getSha,
    fbMeta,
    getAsset,
    addHeaders,
    serveFile,
    notfound,
    helpers.serveCode(500))

  web.options('/', helpers.serveCode(200))

  web.use(helpers.serveCode(400))

  return init()
    .catch(state.log("Can't init", true))
    .then(function (gitListener) {
      return { server: server,
        git: gitListener }
    })
}

function warnDevMid (msg) {
  return function (req, res, next) {
    state.warnDev(msg)
    next()
  }
}

function serveStatus (req, res, next) {
  var err
  log.info('Heard request for status')

  if (!config.slack.token.val) {
    err = new Error('Slack misconfigured')
    err.TODO = 'Check slack token'
    state.log('Won\'t send status', undefined, true)(err)
    res.status(401).end()
  } else if (req.body.token === config.slack.token.val) {
    if (req.body.text === 'status' || ~req.body.text.indexOf(config.git.branch.val)) {
      diskspace.check('/', function (err, total, free, status) {
        var du
        var text
        var reply
        if (err) {
          state.log("Can't get disk space", true)(err)
          next()
        } else {
          if (status !== 'READY') {
            state.log("Can't get disk space", true)(new Error('status not ready'))
            log.warn('status', status)
            next()
          } else {
            du = Math.round(100 * free / total) + '%'
            text = 'repo: ' + config.git.repo.val +
              '\nbranch: ' + config.git.branch.val +
              '\nversion: ' + live.version +
              '\nSHA: ' + live.sha +
              '\nport: ' + config.port.val +
              '\ngit port: ' + config.git.port.val +
              '\nfreeSpace: ' + du
            try {
              reply = JSON.stringify({
                text: text,
                username: error.machineIP
              }, null, 2)
              log.info('Responding', reply)
              res.end(reply)
            } catch (e) {
              state.log("Can't stringify or send status", true)(e)
              next()
            }
          }
        }
      })
    } else {
      log.info('Ignoring status request targeted at different branch')
      res.status(200).end()
    }
  } else {
    state.log("Won't send status", undefined, true)(new Error('Wrong token'))
    res.status(401).end()
  }
}

function init () {
  hookListener.init(config, offerSha)
  return getLatestSha()
    .catch(state.log("Can't get latest SHA", true))
    .catch(wrongBranch)
    .then(offerSha)
    .catch(state.log("Can't offer SHA"))
    .then(acceptRequests)
    .catch(state.log("Can't accept requests", true))
    .then(hookListener.acceptHookshots)
    .catch(state.log("Can't accept hookshots", true))
}

function wrongBranch (reason) {
  if (reason.message === 'Not Found') {
    throw new Error('Branch not found')
  } else {
    throw reason
  }
}

function getLatestSha () {
  return new Promise(function (resolve, reject) {
    var options
    var req
    if (config.src.val) {
      resolve('_local')
    } else {
      try {
        options = {
          hostname: config.git.api.hostname.val,
          path: path.join('/repos',
            config.git.owner.val,
            config.releaseRepo.name.val,
            'commits',
            config.git.branch.val),
          headers: config.git.api.headers.plain()
        }
        log.info('Getting latest', options)
      } catch (e) {
        log.error('Git misconfigured, check owner, repo and branch')
        e.TODO = 'Check git owner repo and branch'
        return reject(e)
      }
      req = https.request(options
        , function (res) {
          var concatenate
          var err
          res.on('error', function (err) {
            err.options = options
            reject(err)
          })
          if (res.statusCode === 401) {
            log.error('Git unauthorized, check username and password')
            err = new Error('Invalid config')
            reject(err)
          } else if (res.statusCode === 404) {
            log.error('Repo or branch not found')
            err = new Error('Invalid config')
            err.TODO = 'Check git username and password'
            reject(err)
          } else {
            concatenate = concat(function (data) {
              var parsed
              try {
                parsed = JSON.parse(data)
              } catch (e) {
                reject(e)
              }
              if (parsed.sha) {
                resolve(parsed.sha)
              } else {
                reject(parsed)
              }
            })
            res.pipe(concatenate)
          }
        })
      log.info(helpers.hNow() + ' Asking Github for latest commit on branch', config.git.branch.val)
      req.on('error', function (err) {
        err.options = options
        reject(err)
      })
      req.end()
    }
  })
}

function checkSpace () {
  return new Promise(function (resolve, reject) {
    diskspace.check('/', function (err, total, free, status) {
      var msg
      if (err) {
        reject(err)
      } else {
        if (status !== 'READY') {
          log.warn('Can\'t get disk space')
          log.warn('status', status)
        } else {
          msg = 'Free space left: ' + free / total +
              ' / 1 AKA ( ' + Math.round(100 * free / total) + '% )'
          if (free / total < config.minFreeSpace.val) {
            log.warn(msg)
            state.warnDev(msg, true)
          } else {
            log.info(msg)
          }
        }
        resolve()
      }
    })
  })
}

function offerSha (sha) {
  var v
  var ready
  v = new Version(sha, config)
  latestNewSha = sha

  ready = prepQueue.add()
    .catch(function (reason) {
      reason.addRejected = true
      throw reason
    })
    .catch(state.log('Prep canceled'))
    .then(function () {
      return v.prep()
    })
    .catch(state.log("Can't prepare version (" + sha + ')'))
    .then(function (value) {
      prepQueue.done()
      return value
    }
    , function (reason) {
      prepQueue.canceled(reason)
      throw reason
    })
    .catch(state.log("Can't run queued prep"))
    .then(goLive)
    .catch(state.log("Can't go Live"))
    .then(checkSpace)
    .catch(state.log("Can't check disk space"))
    .catch(function (reason) {
      var msg = 'GoLive failed! '
      if (!reason.newerVersion &&
        !reason.addRejected &&
        !reason.invalidRequest) {
        try {
          msg += ' reason: ' + JSON.stringify(reason)
        } catch (e) {
          msg += ' (unable to stringify reason)'
        }
        reason.warned = true
        state.warnDev(msg)
      }
      throw reason
    })

  function goLive () {
    return new Promise(function (resolve, reject) {
      var error
      var t
      if (latestNewSha !== sha) {
        error = new Error('Go Live canceled: a newer version has been pushed')
        error.newerVersion = true
        return reject(error)
      }
      live = v
      t = Date.now()
      log.info(helpers.hNow() + ' New version live:', live.sha)
      resolve(state.get()
        .then(function (data) {
          data.lastGoLive = t
          return state.save(data)
            .then(function () {
              return live
            })
        }))
      v.replayTransforms()
    })
  }

  return ready
}

// function notifyCloud (version) {
//   var nbRetries = 0
//     , t = setTimeout(function () {
//       try {
//         attempt(false)
//       }
//       catch (e) {
//         console.error(e)
//       }
//     }, config.cloudNotificationDelay)

//   log.info("Notifying cloud in "
//     + config.cloudNotificationDelay
//     + " ms")

//   function attempt (isRetry) {
//     if (latestNewSha !== version.sha) {
//       throw new Error("Cloud notification canceled: "
//         + "a newer version has been pushed")
//     }
//     log.info(helpers.hNow() + " Notifying cloud")
//     if (isRetry) {
//       nbRetries += 1
//     } else {
//       nbRetries = 0
//     }
//     version.getPkg()
//       .catch(state.log("Can't get pkg"))
//       .then(function (pkg) {
//         return new Promise(function (resolve, reject) {
//           var cloud = new vCloud(pkg.vigour.cloud)
//             , time
//             , retryTime
//             , welcomed = false
//           cloud.on('welcome', function () {
//             welcomed = true
//             log.info("Welcomed by cloud")
//             cloud.data.get('app').val = {
//               version: pkg.version
//             }
//             time = setTimeout(function () {
//               cloud.socket.disconnect()
//               log.info(helpers.hNow() + " Cloud notified of version `"
//                 + pkg.version
//                 + "`")
//               resolve()
//             }, config.cloudDisconnectDelay)
//           })
//           retryTime = setTimeout(function () {
//             if (!welcomed) {
//               if (nbRetries < config.notifyCloudRetries) {
//                 log.info("Retrying to notify cloud")
//                 attempt(true)
//               } else {
//                 reject("Max retries reached")
//               }
//             }
//           }, config.notifyCloudRetryDelay)
//         })
//       })
//       .catch(state.log("Can't notify cloud"))
//   }
// }

function acceptRequests () {
  if (!server) {
    server = web.listen(config.port.val)
    log.info('Listening for requests on port ', config.port.val)
  } else {
    throw new Error('`server` already exists')
  }
}

// function startRepl () {
//   r = repl.start({
//     useGlobal: true
//   })
//   r.context.context = {
//     config: config,
//     env: process.env,
//     getuid: process.getuid,
//     live: live,
//     server: server,
//     web: web
//   }
// }

// MIDDLEWARE

function logRequest (req, res, next) {
  log.info(helpers.hNow(), req.method, req.originalUrl)
  next()
}

function prepFavicon (req, res, next) {
  req.sendPath = path.join(req.sha.root
    , 'favicon.ico')
  res.set('Access-Control-Allow-Origin', '*')

  setHeaders(res, {
    cache: true,
    cdnCache: false
  })
  next()
}

function prepRobots (req, res, next) {
  req.sendPath = path.join(__dirname, '..', 'robots.txt')
  res.set('Access-Control-Allow-Origin', '*')

  setHeaders(res, {
    cache: false,
    cdnCache: false
  })
  next()
}

function prepGeo (req, res, next) {
  req.sendPath = path.join(__dirname, '..', 'geo.json')
  res.set('Access-Control-Allow-Origin', '*')

  setHeaders(res, {
    cache: false,
    cdnCache: true
  })
  next()
}

function prepShaRequest (req, res, next) {
  var requestedPath = req.url.slice(1)
  requestedPath = requestedPath.slice(requestedPath.indexOf('/') + 1)
  requestedPath = requestedPath.slice(requestedPath.indexOf('/') + 1)
  log.info('specific SHA requested', req.params.sha)
  req.filePath = requestedPath
  req.setHeaderOptions = {
    cache: true,
    cdnCache: true
  }
  req.shaRequest = true
  next()
}

function getSha (req, res, next) {
  if (req.params.sha) {
    req.sha = new Version(req.params.sha, config)
    next()
  } else if (live) {
    req.sha = live
    next()
  } else {
    // TODO
    log.error('In getSha, neither `req.params.sha` nor `live` are truthy')
    next()
  }
}

function getUA (req, res, next) {
  req.ua = req.get('user-agent')
  req.ua = (typeof req.ua === 'string' || req.ua instanceof String)
    ? req.ua.replace(/\(\d+\)$/, '')
    : ''
  // log.info("ua", req.ua)
  next()
}

function fbMeta (req, res, next) {
  if (req.ua.indexOf('facebook') !== -1) {
    log.info('Facebook scraper request')
    req.sha.getPkg()
      .catch(state.log("Can't get pkg to get Facebook defaults"))
      .then(function (pkg) {
        var item
        var meta = {
          'og:title': pkg.vigour.ferry.fbDefaults.title,
          'og:description': pkg.vigour.ferry.fbDefaults.description,
          'og:image': pkg.vigour.ferry.fbDefaults.image
        }
        var prop
        var str = ''
        for (item in req.query) {
          if (item.indexOf('og:') === 0) {
            if (item === 'og:image') {
              meta[item] = pkg.vigour.img +
                path.join('/image',
                  req.query[item],
                  '1200',
                  '630')
            } else {
              meta[item] = req.query[item]
            }
          }
        }
        for (prop in meta) {
          str += '<meta property="' +
            prop +
            '" content="' +
            meta[prop] +
            '" />'
        }
        setHeaders(res)
        log.info('Sending ', str)
        res.end(str)
      })
      .catch(state.log('Can\'t create meta string for facebook scraper'))
      .catch(function (reason) {
        log.warn('500', 'Facebook meta tags')
        res.status(500).end()
      })
  } else {
    next()
  }
}

function getAsset (req, res, next) {
  req.originalFilePath = url.parse((req.filePath || req.url))
    .pathname
  req.sha.getAsset(req.originalFilePath,
    {
      fsRoot: (req.query.fsRoot) ? req.query.fsRoot : '',
      ua: req.ua,
      path: req.originalUrl
    },
    req.shaRequest)
    .catch(state.log("Can't get asset"))
    .then(function (path) {
      if (path) {
        req.sendPath = path
        next()
      } else {
        res.status(503)
          .set('retry-after', config.retryAfter.val)
          .end()
      }
    }
    , function (reason) {
      // TODO Respond as a function of reason
      log.error('Asset not found')
      notfound(req, res, next)
    })
}

function addHeaders (req, res, next) {
  res.set('Access-Control-Allow-Origin', '*')
  setHeaders(res, req.setHeaderOptions)
  next()
}

function notfound (req, res, next) {
  var i
  if (!req.pathCandidate) {
    req.pathCandidate = req.originalFilePath
  }

  i = req.pathCandidate.indexOf('/')
  req.pathCandidate = (i === -1)
    ? ''
    : req.pathCandidate
      .slice(i + 1)
  if (path.extname(req.pathCandidate) === '') {
    serveIndex(req, res, next)
  } else {
    res.sendFile(path.join(req.sha.root, req.pathCandidate)
      , function (err) {
        if (err) {
          if (err.code === 'ECONNABORT' && res.statusCode === 304) {
            // log.info('304', req.pathCandidate)
          } else if (err.code === 'ENOENT') {
            notfound(req, res, next)
          } else {
            err.path = req.pathCandidate
            log.error(helpers.hNow(), err)
          }
        } else {
          // log.info(res.statusCode, req.pathCandidate)
        }
      })
  }
}

function stringStart (str, separator) {
  var idx = str.indexOf(separator)
  if (idx === -1) {
    return str
  } else {
    return str.slice(0, idx)
  }
}

var availableRegions = [
  'dk', // Denmark
  'de', // Germany
  'nl', // Netherlands
  'ch', // Switzerland
  'pl', // Poland
  'be', // Belgium
  'no'  // Norway
]

function serveIndex (req, res, next) {
  var url = stringStart(req.originalUrl, '?')
    .replace(/^#\//, '')
  var arr = url.split('/')
  var newArr = []
  var l = arr.length
  for (var i = 0; i < l; i += 1) {
    if (arr[i] !== '') {
      newArr.push(stringStart(arr[i], '-'))
    }
  }
  var region = req.query.lang
  if (!region) {
    region = 'en'
  } else {
    let parsed = region.split('-')[0].toLowerCase()
    if (availableRegions.indexOf(parsed) === -1) {
      region = 'en'
    } else {
      region = parsed
    }
  }
  var section = newArr.shift()
  var fileName
  switch (section) {
    case 'shows':
      fileName = newArr.join('.')
      if (fileName) {
        fileName = `shows.<%= region %>.${fileName}.json`
      } else {
        fileName = 'shows.<%= region %>.json'
      }
      break
    case 'channels':
      fileName = 'channels.<%= region %>.json'
      break
    case 'discover':
    case '':
    case undefined:
    default:
      fileName = 'discover.<%= region %>.json'
      break
  }
  return req.sha.getPkg()
    .then(function (pkg) {
      req.sha.getAsset(pkg.vigour.ferry.web,
        {
          meta: fileName,
          region: region,
          path: req.originalUrl,
          host: req.headers.host,
          querystring: JSON.stringify(req.query)
        },
        req.shaRequest)
        .then(function (transformedPath) {
          res.sendFile(transformedPath
            , function (err) {
              if (err) {
                if (err.code === 'ECONNABORT' &&
                  res.statusCode === 304) {
                    // log.info('304', indexPath)
                } else {
                  err.path = transformedPath
                  log.error(helpers.hNow(), err)
                  next()
                }
              } else {
                // log.info(res.statusCode, transformedPath)
              }
            })
        })
    })
    .catch(function () {
      res.status(400).send('Invalid SHA')
    })
}

function serveManifest (req, res, next) {
  req.sendPath = live.manifestPath
  next()
}

function serveSitemap (req, res, next) {
  var jsonldurl = url.parse(config.jsonldurl.val)
  var options = {
    hostname: jsonldurl.hostname,
    port: jsonldurl.port,
    path: '/sitemap.xml'
  }
  var request = http.request(options, function (response) {
    response.on('error', function (err) {
      console.error("Can't serve sitemap.xml (response error)", err)
      next()
    })
    if (response.statusCode !== 200) {
      console.error("Can't serve sitemap.xml (response is not 200)", response.statusCode)
      next()
    } else {
      for (let key in response.headers) {
        res.set(key, response.headers[key])
      }
      res.status(200)
      response.pipe(res)
    }
  })
  request.on('error', function (err) {
    console.error("Can't serve sitemap.xml (request error)", err)
    next()
  })
  request.end()
}

function serveFile (req, res, next) {
  res.sendFile(req.sendPath
    , function (err) {
      if (err) {
        if (err.code === 'ECONNABORT' && res.statusCode === 304) {
          // log.info('304', req.sendPath)
        } else if (err.code === 'ENOENT') {
          next()
        } else {
          err.path = req.sendPath
          log.error(helpers.hNow(), err)
        }
      } else {
        // log.info(res.statusCode, req.sendPath)
      }
    })
}

// HELPERS

function setHeaders (res, opts) {
  var maxage = 31556900  // ~ 1 year in seconds
  res.set('Cache-Control', (opts && opts.cache)
    ? 'public, no-transform, max-age=' + maxage
    : 'public, max-age=0')
  if (config.akamai.val) {
    res.set('Edge-Control', (opts && opts.cdnCache)
      ? '!no-cache, max-age=' + maxage
      : 'public, max-age=0')
  }

  // res.set("Cache-Control", "public, max-age=0")
  // res.set("Edge-Control", "public, max-age=0")
}

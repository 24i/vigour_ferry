var fs = require('graceful-fs')
  , log = require('npmlog')
  , http = require('follow-redirects').http
  , https = require('follow-redirects').https
  , nodemailer = require('nodemailer')
  , Promise = require('promise')
  , exists = function (path) {
    return new Promise(function (resolve, reject) {
      fs.exists(path, resolve)
    })
  }
  , machineIP
  , ipRequested = false

module.exports = exports = Error

function Error (opts) {
  var self = this
  self.opts = opts
  self.mailOptions = {}
  if ((opts.mail || opts.slack) && !machineIP && !ipRequested) {
    ipRequested = true
    http.get('http://www.curlmyip.com', function (res) {
        var ip = ''
        res.setEncoding('utf8')
        res.on('data', function (chunk) {
          ip += chunk
        })
        res.on('error', function (err) {
          log.error("Error receiving IP", err)
        })
        res.on('end', function () {
          ip = ip.replace(/\s/g, "")
          log.info("IP", ip)
          machineIP = ip

          self.mailOptions.subject = 'Warning from ' + ip
          if (opts.git) {
            self.mailOptions.subject += ' (' + opts.git.branch + ')'
          }
        })
      }).on('error', function (err) {
        log.error("Error requesting IP", err)
      })
  }
  if (opts.mail) {
    self.mailOptions.from = 'MTV PLAY PACKER SERVER <' + opts.mail.fromAddress + '>'
    self.mailOptions.to = opts.mail.to // comma-separated list of receivers
    if (opts.git) {
      self.mailOptions.subject = 'Warning from ' + opts.git.branch
    }
    self.mailOptions.text = 'Something went wrong on the packer server, check the logs!'
    self.transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: opts.mail.username,
        pass: opts.mail.password
      }
    })
  }
}

Error.prototype.print = function (msg, reason) {
  log.error(msg)
  if (!reason.printed) {
    log.error('reason', reason)
    reason.printed = true
  }
}

Error.prototype.warnDev = function (msg) {
  var self = this
  if (msg.toString() === '[object Object]') {
    try {
      msg = JSON.stringify(msg)
    } catch (e) {
      msg = "Unstringifiable"
    }
  }
  return Promise.all([
    new Promise(function (resolve, reject) {
      if (msg) {
        self.mailOptions.text = msg
      }

      if (!self.opts.mail) {
        log.warn("E-MAIL warning not configured")
        resolve()
      } else {
        log.warn("SENDING E-MAIL"
          + "\n\n"
          + JSON.stringify(self.mailOptions, null, 2)
          + "\n\n")
        self.transporter.sendMail(self.mailOptions, function (err, info){
          if (err) {
           log.error(err)
           reject(err)
          } else {
           log.info('email sent: ' + info.response)
           resolve()
          }
        })
      }
    })
    , new Promise(function (resolve, reject) {
      if (!self.opts.slack || !self.opts.slack.pathPart || !self.opts.slack.token) {
        log.warn("SLACK warning not properly configured")
        log.warn('options', self.opts.slack)
        resolve()
      } else {
        var postData = makePayload(machineIP, self.opts.git.branch, msg)
          , options = {
            hostname: 'hooks.slack.com'
            , port: 443
            , path: self.opts.slack.pathPart
            , method: 'POST'
            , headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': postData.length
            }
          }
          , req = https.request(options, function (res) {
            var response = ""
            res.on('error', reject)
            res.on('data', function (chunk) {
              response += chunk.toString()
            })
            res.on('end', function () {
              if (response === 'ok') {
                log.info('slack message sent')
                resolve()
              } else {
                reject(response)
              }
            })
          })
        log.warn("SENDING SLACK MESSAGE"
          + "\n\n"
          + JSON.stringify(options, null, 2)
          + "\n\n"
          + postData
          + "\n\n")
        req.on('error', reject)
        req.write(postData)
        req.end()
      }
    })
  ])
}

function makePayload (i, b, m) {
  return 'payload=' + JSON.stringify(
    { text: i + ' (' + b + ') ' + m
    , channel: "#mtv-play-packers"
    })
}

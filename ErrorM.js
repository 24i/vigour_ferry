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

module.exports = exports = ErrorM

function getIp () {
  http.get("http://www.curlmyip.com", function (res) {
    var ip = ""
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
      self.mailOptions.subject += ' (' + opts.git.branch + ')'
    })
  }).on('error', function (err) {
    if (err.code === "ETIMEDOUT") {
      log.warn("IP request timed out, trying again in 5 seconds")
      setTimeout(getIp, 5000)
    } else {
      log.error("Error requesting IP", err)
    }
  })
}

function ErrorM (opts) {
  var self = this
  self.opts = opts
  self.mailOptions = {}
  if ((opts.mail || opts.slack) && !machineIP && !ipRequested) {
    ipRequested = true
    getIp()
  }
  try {
    self.mailOptions.from = 'Packer Server <' + opts.mail.fromAddress + '>'
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
  } catch (e) {
    self.misconfigured = e
  }
}

ErrorM.prototype.print = function (msg, reason) {
  log.error(msg)
  if (!reason.printed) {
    log.error('reason', reason)
    reason.printed = true
  }
}

ErrorM.prototype.warnDev = function (msg) {
  var self = this
  if (msg.toString() === '[object Object]') {
    try {
      msg = JSON.stringify(msg)
    } catch (e) {
      msg = "Unstringifiable"
    }
  }
  return Promise.all([
    (new Promise(function (resolve, reject) {
      if (self.misconfigured) {
        self.misconfigured.TODO = "check mail fromAddress, to, username and password"
        reject(self.misconfigured)
      } else {
        if (msg) {
          self.mailOptions.text = msg
        }

        // log.warn("\nSending email: "
        //   , JSON.stringify(self.mailOptions, null, 2)
        //   , "\n\n")

        self.transporter.sendMail(self.mailOptions, function (err, info){
          if (err) {
           if (err.responseCode === 454) {
            log.warn("Can't log into mail service")
            err.TODO = "Check mail username and password"
            return reject(err)
           } else {
            log.warn("Can't send mail")
            err.TODO = "Check mail fromAddress and to"
            return reject(err)
           }
          } else {
           log.info('email sent: ' + info.response)
           return resolve()
          }
        })
      }
    }))
      .catch(function (reason) {
        log.error("Can't send mail", reason)
      })
    , (new Promise(function (resolve, reject) {
      try {
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
          , req
      } catch (e) {
        log.warn("Slack misconfigured")
        e.TODO = "Check Slack id and token"
        return reject(e)
      }

      // log.warn("Sending slack message:"
      //   , JSON.stringify(options, null, 2)
      //   , "\n\n"
      //   , postData
      //   , "\n\n")

      req = https.request(options, function (res) {
        var response = ""
        res.on('error', reject)
        res.on('data', function (chunk) {
          response += chunk.toString()
        })
        res.on('end', function () {
          var err
          if (response === 'ok') {
            log.info('slack message sent')
            resolve()
          } else {
            err = new Error("Invalid Login")
            err.TODO = "Check slack id and token"
            reject(err)
          }
        })
      })
      req.on('error', reject)
      req.write(postData)
      req.end()
    })).catch(function (reason) {
      log.error("Can't send Slack message", reason)
    })
  ])
}

function makePayload (i, b, m) {
  return 'payload=' + JSON.stringify(
    { text: i + ' (' + b + ') ' + m
    , channel: "#mtv-play-packers"
    })
}

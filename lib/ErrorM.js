var log = require('npmlog')
var https = require('follow-redirects').https
var nodemailer = require('nodemailer')
var Promise = require('promise')
var helpers = require('./helpers')
var machineIP
var ipRequested = false

module.exports = exports = ErrorM

// function getIp (self, opts) {
//   log.info("Requesting IP")
//   http.get("http://ifconfig.me/ip", function (res) {
//     var ip = ""
//     res.setEncoding('utf8')
//     res.on('data', function (chunk) {
//       ip += chunk
//     })
//     res.on('error', function (err) {
//       log.error("Error receiving IP", err)
//     })
//     res.on('end', function () {
//       ip = ip.replace(/\s/g, "")
//       log.info("IP", ip)
//       machineIP = ip

//       self.mailOptions.subject = 'Warning from ' + ip
//       self.mailOptions.subject += ' (' + opts.git.branch + ')'
//     })
//   }).on('error', function (err) {
//     if (err.code === "ETIMEDOUT") {
//       log.warn("IP request timed out, trying again in 5 seconds")
//       setTimeout(function () {
//         getIp(self, opts)
//       }, 5000)
//     } else {
//       log.error("Error requesting IP", err)
//     }
//   })
// }

function getIp (self, opts) {
  log.info('Getting IP')
  helpers.sh('dig +short myip.opendns.com @resolver1.opendns.com')
    .then(function (ip) {
      ip = ip.replace(/\s/g, '')
      log.info('IP', ip)
      self.machineIP = machineIP = ip

      self.mailOptions.subject = 'Warning from ' + ip
      self.mailOptions.subject += ' (' + opts.git.branch.val + ')'
    })
}

function ErrorM (opts) {
  var self = this
  self.opts = opts
  self.mailOptions = {}
  if (opts.slack.channel.val) {
    self.channel = '#' + opts.slack.channel.val
  }
  if ((opts.mail.fromAddress.val || opts.slack.pathPart.val) && !machineIP && !ipRequested) {
    ipRequested = true
    getIp(self, opts)
  }
  try {
    self.mailOptions.from = 'Ferry <' + opts.mail.fromAddress.val + '>'
    self.mailOptions.to = opts.mail.to.val // comma-separated list of receivers
    if (opts.git.branch.val) {
      self.mailOptions.subject = 'Warning from ' + opts.git.branch.val
    }
    self.mailOptions.text = 'Something went wrong on the ferry, check the logs!'
    self.transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: opts.mail.username.val,
        pass: opts.mail.password.val
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
      msg = 'Unstringifiable'
    }
  }
  if (self.opts.warn.val) {
    return Promise.all([
      (new Promise(function (resolve, reject) {
        if (self.misconfigured) {
          self.misconfigured.TODO = 'check mail fromAddress, to, username and password'
          reject(self.misconfigured)
        } else {
          if (msg) {
            self.mailOptions.text = msg
          }

          // log.warn("\nSending email: "
          //   , JSON.stringify(self.mailOptions, null, 2)
          //   , "\n\n")

          self.transporter.sendMail(self.mailOptions, function (err, info) {
            if (err) {
              if (err.responseCode === 454) {
                log.warn('Can\'t log into mail service')
                err.TODO = 'Check mail username and password'
                return reject(err)
              } else {
                log.warn('Can\'t send mail')
                err.TODO = 'Check mail fromAddress and to'
                return reject(err)
              }
            } else {
              log.info('email sent to ' + self.mailOptions.to + ':\n' + info.response)
              return resolve()
            }
          })
        }
      }))
        .catch(function (reason) {
          log.error("Can't send mail", reason)
        }),
      (new Promise(function (resolve, reject) {
        try {
          var postData = makePayload(machineIP, msg, self)
          var options = {
            hostname: 'hooks.slack.com',
            port: 443,
            path: self.opts.slack.pathPart.val,
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': postData.length
            }
          }
          var req
        } catch (e) {
          log.warn('Slack misconfigured')
          e.TODO = 'Check Slack id, token and channel'
          return reject(e)
        }

        // log.warn("Sending slack message:"
        //   , JSON.stringify(options, null, 2)
        //   , "\n\n"
        //   , postData
        //   , "\n\n")

        req = https.request(options, function (res) {
          var response = ''
          res.on('error', reject)
          res.on('data', function (chunk) {
            response += chunk.toString()
          })
          res.on('end', function () {
            var err
            if (response === 'ok') {
              log.info('slack message sent to ' + self.channel)
              resolve()
            } else {
              err = new Error('Invalid Login')
              err.TODO = 'Check slack id and token'
              reject(err)
            }
          })
        })
        req.on('error', reject)
        req.write(postData)
        req.end()
      }))
        .catch(function (reason) {
          log.error('Can\'t send Slack message', reason)
        })
    ])
  } else {
    return Promise.resolve()
  }
}

function makePayload (i, m, self) {
  return 'payload=' + JSON.stringify({
    text: i + ' ' + m,
    channel: self.channel.val
  })
}

var config = require('./config')
  , fs = require('graceful-fs')
  , log = require('npmlog')
  , http = require('http')
  , https = require('https')
  , nodemailer = require('nodemailer')
  , Promise = require('promise')
  , transporter
  , mailOptions = {
    from: 'MTV PLAY PACKER SERVER <' + config.mailFrom + '>',
    to: config.mailTo, // comma-separated list of receivers
    subject: 'Warning from ' + config.git.branch,
    text: 'Something went wrong on the packer server, check the logs!'
  }
  , exists = function (path) {
    return new Promise(function (resolve, reject) {
      fs.exists(path, resolve)
    })
  }

exports.instance_ip

if (config.offlineMode) {
  mailOptions.subject += 'local'
} else {
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
        exports.instance_ip = ip
        mailOptions.subject = 'Warning from ' + ip + ' (' + config.git.branch + ')'
      })
    }).on('error', function (err) {
      log.error("Error requesting IP", err)
    })
}

transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: config.email.username,
    pass: config.email.password
  }
})

module.exports = exports = {}

exports.print = function (msg, reason) {
  log.error(msg)
  if (!reason.printed) {
    log.error('reason', reason)
    reason.printed = true
  }
}

exports.warnDev = function (msg) {
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
        mailOptions.text = msg
      }

      if (config.debug) {
        log.warn("WOULD NORMALLY SEND E-MAIL")
        log.warn('msg', msg)
        resolve()
      } else {
        log.warn("SENDING E-MAIL"
          + "\n\n"
          + JSON.stringify(mailOptions. null, 2)
          + "\n\n")
        transporter.sendMail(mailOptions, function (err, info){
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
      if (config.debug) {
        log.warn("WOULD NORMALLY WARN ON SLACK")
        log.warn('msg', msg)
        resolve()
      } else {
        var postData = 'payload={"text": "' + exports.instance_ip + ' (' + config.git.branch + ') ' + msg + '", "channel": "#mtv-play-packers"}'
          , options = {
            hostname: 'hooks.slack.com'
            , port: 443
            , path: config.slack.path
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
        log.warn("SENDING SLACK MESSAGE")
        req.on('error', reject)
        req.write(postData)
        req.end()
      }
    })
  ])
}

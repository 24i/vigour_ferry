var express = require('express')
var oboe = require('oboe')
var log = require('npmlog')
var helpers = require('./helpers')
var github
var gitListener
var cfg
var offerSha

module.exports = exports = {}

exports.init = function (config, os) {
  offerSha = os
  cfg = config
  github = express()
  github.post('/push', handleHookshot)
  github.use(helpers.serveCode(404))
}

exports.acceptHookshots = function () {
  gitListener = github.listen(cfg.git.port)
  log.info('Listening for hookshots on port', cfg.git.port)
  return gitListener
}

function handleHookshot (req, res, next) {
  var r
  var h
  var branch
  var sha
  log.info(helpers.hNow() + ' Received hookshot')
  oboe(req)
    .node('ref', function (ref) {
      r = ref
      finish.call(this)
      return oboe.drop
    })
    .node('head_commit.id', function (headCommit) {
      h = headCommit
      finish.call(this)
      return oboe.drop
    })
    .node('*', function () {
      return oboe.drop
    })
    .done(function (body) {
      finish.call(this)
    })

  function finish () {
    if (r && h) {
      this.abort()
      try {
        branch = r.slice(r.lastIndexOf('/') + 1)
        if (branch === cfg.git.branch || branch === '_local') {
          sha = (branch === '_local')
            ? '_local'
            : h
          offerSha(sha)
        } else {
          log.info('Ignoring hookshot from branch', branch)
        }
      } catch (e) {
        res.status(400).end()
      }
      res.status(202).end()
    }
  }
}

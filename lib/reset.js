#!/usr/bin/env node
var fs = require('vigour-fs')
var util = require('../util')
var filesPath = __dirname + '/files/'
var shaPath = filesPath + 'shas/'
var history = ['history.json', 'transformHistory.json']
    .map(function (val) {
      return filesPath + val
    })
fs.readdir(shaPath, function (err, versions) {
  var toDelete = versions.filter(function (x) {
      return x.indexOf('.') !== 0
    }).map(function (val) {
      return shaPath + val
    })
  if (err) {
    console.error('Error reading directory', err)
  } else {
    util.asyncEach(toDelete
      , remove
      , function (err) {
        if (err) {
          console.error('Error removing files', err)
        } else {
          console.log('Done removing versions')
        }
      })
  }
})

util.asyncEach(history
  , remove
  , function (err) {
    if (err) {
      console.error('Error removing files', err)
    } else {
      console.log('Done removing history')
    }
  })

function remove (file, cb) {
  console.log('Removing ', file)
  fs.remove(file, function (err) {
    if (err) {
      err.message += ': Error removing entry'
      err.entry = file
      cb(err)
    } else {
      cb(null)
    }
  })
}

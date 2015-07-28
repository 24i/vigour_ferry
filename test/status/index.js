describe("Packer", function () {
  before(function () {
    console.log("BEFORE")
  })
  describe("status", function () {
    it ("should answer with 200", function (done) {
      var x = 200
      setTimeout(function () {
        expect(x).to.equal(200)
        // x.should.equal(200)
        done()
      }, 20)
    })
  })
  after(function () {
    console.log("AFTER")
  })
})
// var http = require('http')
//   , log = require('npmlog')
//   , followUp = process.argv[3]
//   , token = process.argv[2]
//   , postData = "token=" + token
//     + "&" + "team_id=T0001"
//     + "&" + "team_domain=example"
//     + "&" + "channel_id=C2147483705"
//     + "&" + "channel_name=mtv-play-packers"
//     + "&" + "timestamp=" + Date.now()
//     + "&" + "user_id=U2147483697"
//     + "&" + "user_name=Steve"
//     + "&" + "text=status" + ((followUp) ? " " + followUp : "")
//     + "&" + "trigger_word=status"
//   , options = {
//     host: 'localhost'
//     , port: 8000
//     , path: '/status'
//     , method: 'POST'
//     , headers: {
//         'Content-Type': 'application/x-www-form-urlencoded'
//     }
//   }
//   , request

// options['Content-Length'] = Buffer.byteLength(postData)

// log.info('Simulating outgoing webhook')

// request = http.request(options, function (res) {
//   log.info("res.statusCode", res.statusCode)
//   res.setEncoding('utf8')
//   res.on('data', function (chunk) {
//     log.info("response (POST /push) chunk", chunk)
//   })
//   res.on('error', function (err) {
//   log.error('error', "response (POST /push) error", err)
//   })
//   res.on('end', function () {
//   log.info('PASS', 'request responded to')
//   })
// })
// request.on('error', function (err) {
//   log.error('error', "request (POST /push) error", err)
// })

// request.write(postData)
// request.end()
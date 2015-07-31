var chai = require('chai') // TODO Remove this when gaston allows it
var expect = chai.expect	// TODO Remove this when gaston allows it

var http = require('http')
var packer = require('../../../')
var startupTimeout = 10000
var port = 8000
var slackToken = "FtHE0yGNwpDhnj73lTNncW9s"
var options =
		{ vigour:
			{ packer:
				{ git:
					{ owner: "vigourmachines"
					, repo: "directv-fl"
					, username: "vigourmachines"
					, password: "schaap99"
					, branch: "master"					
					}
				, slack:
					{ id: "T02AZ6MJS/B06224A5C/zdhGfLtB44ty0NJgIMptsaRW"
					, token: slackToken
					, channel: "directv-packers" }
				, port: port
				}
			}
		}
	, servers
describe("Server", function () {
	before(function (done) {
		this.timeout(startupTimeout)
		packer(options)
			.then(function (_servers) {
				servers = _servers
				done()
			})
	})

	it("should launch correctly", function (done) {
		expect(servers.server).to.exist
		expect(servers.git).to.exist
		done()
	})

	it("should serve assets", function (done) {
		var req = http.request({
			port: port
		, path: "/package.json"
		}, function (res) {
			var total = ""
			res.setEncoding('utf8')
			res.on('data', function (chunk) {
				total += chunk
			})
			res.on('error', function (err) {
				// TODO Fail if function gets called
				expect(err).not.to.exist
				done()
			})
			res.on('end', function () {
				expect(total).to.be.a.string
				// TODO Verify that the content of the asset matches the latest on GitHub...
				done()
			})
		})
		req.on('error', function (err) {
			// TODO Fail if function gets called
			expect(err).not.to.exist
		})
		req.end()
	})

	it("should respond to `POST /status`", function (done) {
		var token = slackToken
		var postData = "token=" + token
	    + "&team_id=T0001"
	    + "&team_domain=example"
	    + "&channel_id=C2147483705"
	    + "&channel_name=mtv-play-packers"
	    + "&timestamp=" + Date.now()
	    + "&user_id=U2147483697"
	    + "&user_name=Steve"
	    + "&text=status"
	    + "&trigger_word=status"
		var opts =
			{ port: port
			, path: "/status"
			, method: "POST"
			, headers:
				{ "Content-Type": "application/x-www-form-urlencoded"
				, "Content-Length": Buffer.byteLength(postData) }
			}
		var req = http.request(opts, function (res) {
			var total = ""
			expect(res.statusCode).to.equal(200)
			console.log("res.statusCode", res.statusCode)
			res.setEncoding('utf8')
			res.on('data', function (chunk) {
				total += chunk
			})
			res.on('error', function (err) {
				expect(err).not.to.exist
				done()
			})
			res.on('end', function () {
				// TODO Check the actual contents of the string
				var obj = JSON.stringify(total)
				expect(obj.text).to.be.a.string
				console.log("POST /status", total.text)
				done()
			})
		})
		req.on('error', function (err) {
			expect(err).not.to.exist
		})
		req.write(postData)
		req.end()
	})

	after(function (done) {
		var serverClosed = false
			, gitClosed = false
		servers.server.close(function () {
			serverClosed = true
			finish()
		})
		servers.git.close(function () {
			gitClosed = true
			finish()
		})
		function finish () {
			if (serverClosed && gitClosed) {
				done()
			}
		}
	})
})

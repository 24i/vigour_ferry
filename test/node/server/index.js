var http = require('http')
var log = require('npmlog')
var Promise = require('promise')
var fs = require('vigour-fs')
var readJSON = Promise.denodeify(fs.readJSON)
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
				, akamai: true
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

	describe("Response headers", function () {
		var base = "http://localhost:" + port
		var maxage = 31556900	// ~ 1 year in seconds
		function request (url) {
			return new Promise(function (resolve, reject) {
				var req = http.request(url, function (res) {
					res.on('error', reject)
					// console.log("headers", res.headers)
					resolve(res)
				})
				req.on('error', reject)
				req.end()
			})
		}

		
		describe("/", function () {
			var url = base + "/"
			var reqPromise
			before(function(){
				reqPromise = request(url)
			})
			
			it("should include `access-control-allow-origin=*"
			, function (done) {
				reqPromise.then(function (res) {
					expect(res.headers['access-control-allow-origin'])
						.to.equal("*")
				})
				.done(done)
			})

			it("should include `cache-control=public, max-age=0"
			, function (done) {
				reqPromise.then(function (res) {
					expect(res.headers['cache-control'])
						.to.equal("public, max-age=0")
				})
				.done(done)
			})

			it("should include `edge-control=public, max-age=0"
			, function (done) {
				reqPromise.then(function (res) {
					expect(res.headers['edge-control'])
						.to.equal("public, max-age=0")
				})
				.done(done)
			})
		})

		describe("/manifest.json", function () {
			var url = base + "/manifest.json"
			var reqPromise
			before(function(){
				reqPromise = request(url)
			})

			it("should include `access-control-allow-origin=*"
			, function (done) {
				reqPromise.then(function (res) {
					expect(res.headers['access-control-allow-origin'])
						.to.equal("*")
				})
				.done(done)
			})
			it("should include `cache-control=public, max-age=0"
			, function (done) {
				reqPromise.then(function (res) {
					expect(res.headers['cache-control'])
						.to.equal('public, max-age=0')
				})
				.done(done)
			})
			it("should include `edge-control=public, max-age=0"
			, function (done) {
				reqPromise.then(function (res) {
					expect(res.headers['edge-control'])
						.to.equal('public, max-age=0')
				})
				.done(done)
			})
		})

		describe("/favicon.ico", function () {
			var url = base + "/favicon.ico"
			var reqPromise
			before(function(){
				reqPromise = request(url)
			})

			it("should include `access-control-allow-origin=*"
			, function (done) {
				reqPromise.then(function (res) {
					expect(res.headers['access-control-allow-origin'])
						.to.equal("*")
				})
				.done(done)
			})
			it("should include `cache-control=public, no-transform, max-age="
				+ maxage
			, function (done) {
				reqPromise.then(function (res) {
					expect(res.headers['cache-control'])
						.to.equal("public, no-transform, max-age=" + maxage)
				})
				.done(done)
			})
			it("should include `edge-control=public, max-age=0"
			, function (done) {
				reqPromise.then(function (res) {
					expect(res.headers['edge-control'])
						.to.equal('public, max-age=0')
				})
					.done(done)
			})
		})

		describe("/geo", function () {
			var url = base + "/geo"
			var reqPromise
			before(function(){
				reqPromise = request(url)
			})

			it("should include `cache-control=public, max-age=0"
			, function (done) {
				reqPromise.then(function (res) {
					expect(res.headers['cache-control'])
						.to.equal('public, max-age=0')
				})
				.done(done)
			})
			it("should include `edge-control=!no-cache, max-age=" + maxage
			, function (done) {
				reqPromise.then(function (res) {
					expect(res.headers['edge-control'])
						.to.equal("!no-cache, max-age=" + maxage)
				})
					.done(done)
			})
		})

		describe("/native/:sha/package.json", function () {
			var reqPromise
			before(function (done) {
				readJSON(base + "/manifest.json")
					.then(function (manifest) {
						var latestSHA = manifest.commitHash
						var url = base + "/native/" + latestSHA + "/package.json"
						reqPromise = request(url)
					})
					.done(done)
			})

			it("should include `access-control-allow-origin=*"
			, function (done) {
				reqPromise.then(function (res) {
					expect(res.headers['access-control-allow-origin'])
						.to.equal("*")
				})
				.done(done)
			})
			it("should include `cache-control=public, no-transform, max-age="
				+ maxage
			, function (done) {
				reqPromise.then(function (res) {
					expect(res.headers['cache-control'])
						.to.equal('public, no-transform, max-age=' + maxage)
				})
				.done(done)
			})
			it("should include `edge-control=!no-cache, max-age="
				+ maxage
			, function (done) {
				reqPromise.then(function (res) {
					expect(res.headers['edge-control'])
						.to.equal('!no-cache, max-age=' + maxage)
				})
				.done(done)
			})
		})

		describe("/inexistent", function () {
			var url = base + "/inexistent"
			var reqPromise
			before(function(){
				reqPromise = request(url)
			})

			it("should include `access-control-allow-origin=*"
			, function (done) {
				reqPromise.then(function (res) {
					expect(res.headers['access-control-allow-origin'])
						.to.equal('*')
				})
				.done(done)
			})
			it("should include `cache-control=public, max-age=0"
			, function (done) {
				reqPromise.then(function (res) {
					expect(res.headers['cache-control'])
						.to.equal('public, max-age=0')
				})
				.done(done)
			})
			it("should include `edge-control=public, max-age=0"
			, function (done) {
				reqPromise.then(function (res) {
					expect(res.headers['edge-control'])
						.to.equal('public, max-age=0')
				})
				.done(done)
			})
		})
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
				var obj = JSON.parse(total)
				expect(obj.text).to.be.a.string
				log.info("POST /status", obj.text)
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

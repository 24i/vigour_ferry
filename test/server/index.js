var chai = require('chai') // TODO Remove this when gaston allows it
var expect = chai.expect	// TODO Remove this when gaston allows it

var http = require('http')
var packer = require('../../')
var startupTimeout = 10000
var port = 8000

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
				}
				, port: port
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
			})
			res.on('end', function () {
				expect(total).to.be.a.string
				done()
			})
		})
		req.on('error', function (err) {
			// TODO Fail if function gets called
			expect(err).not.to.exist
		})
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

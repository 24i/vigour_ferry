var chai = require('chai') // TODO Remove this when gaston allows it
var expect = chai.expect	// TODO Remove this when gaston allows it

var packer = require('../../')

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
			}
		}
	, servers
describe("Server", function () {
	before(function (done) {
		this.timeout()
		packer(options)
			.then(function (_servers) {
				servers = _servers
				// console.log("PACKER STARTED", servers)
				done()
			})
	})

	it("Should launch correctly", function (done) {
		expect(servers.packer).to.exist
		expect(servers.git).to.exist
		done()
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

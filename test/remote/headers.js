var http = require('http')
var Promise = require('promise')
var fs = require('vigour-fs')
var readJSON = Promise.denodeify(fs.readJSON)

describe("Response headers", function () {
	// Staging
	// var base = "http://mtv-staging.vigour.io"
	var base = "http://wwwmtvplay-a.akamaihd-staging.net"

	// Production
	// var base = "http://staging-servers-small-1178314605.eu-west-1.elb.amazonaws.com"
	// var base = "http://www.mtvplay.tv"

	var maxage = 31556900	// ~ 1 year in seconds

	function request (url) {
		return new Promise(function (resolve, reject) {
			var req = http.request(url, function (res) {
				res.on('error', reject)
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

	describe("/package.json", function () {
		var url = base + "/package.json"
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

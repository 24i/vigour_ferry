var btoa = require('btoa')
	, VObj = require('vigour-js/object')
	, defaults

module.exports = exports = function (opts) {
	var d = { retryAfter: 1
		, minFreeSpace: 0.15
		, assetRoot: __dirname + '/files'
		, buildDir: 'packerBuilt'
		, shaDir: 'shas'
		, maxHistory: 3
		, port: 8000
		, shaPlaceholder: "SHA"
		, shaHistoryName: 'history.json'
		, stateFileName: "state.json"
		, git:
			{ branch: 'master'
			, url: 'git@github.com'
			, port: 8443
			, api:
				{ hostname: 'api.github.com'
				, headers:
					{ "Accept": 'application/vnd.github.v3+json'
					, "User-Agent": 'vigour-packer-server'
					, "Authorization": "Basic "
					}
				}
			}
		, slack: {
				pathPart: (opts.slack && opts.slack.id)
					? '/services/' + opts.slack.id
					: "absent"
			}
		}
	defaults = new VObj(d)

	// console.log("defaults", defaults.raw)

	defaults.merge(opts)

	if (defaults.git
		&& defaults.git.username
		&& defaults.git.password)
	{
		defaults.git.api.headers.Authorization.val = "Basic "
				+ btoa(defaults.git.username.val
					+ ":"
					+ defaults.git.password.val)
	}
	return defaults.raw
}
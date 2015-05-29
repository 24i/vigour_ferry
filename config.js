var path = require('path')
	, btoa = require('btoa')
	, VObj = require('vigour-js/object')
	, defaults

module.exports = exports = function (opts) {
	var d =
	{ retryAfter: 1
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
		, releaseRepo:
			{ suffix: "-packer-release"
			, name: ""
			, absPath: ""
			}
		}
	, slack:
		{ pathPart: (opts.slack && opts.slack.id)
			? '/services/' + opts.slack.id
			: "absent"
		}
	, cwd: process.cwd()
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

	if (defaults.release && defaults.git.repo && defaults.git.releaseRepo.name.val === "") {
		defaults.git.releaseRepo.name.val = defaults.git.repo.val + defaults.git.releaseRepo.suffix.val
	}

	defaults.git.releaseRepo.absPath.val = path.join(path.dirname(defaults.cwd.val), defaults.git.releaseRepo.name.val)

	return defaults.raw
}
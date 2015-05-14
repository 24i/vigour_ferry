var usage = "nohup npm start --"
		+ " <git-owner>"
		+ " <git-repo>"
		+ " <git-branch>"
		+ " <git-username>"
		+ " <git-password>"
		+ " <email-username>"
		+ " <email-password>"
		+ " <slack-path-part>"
		+ " <slack-token>"
		+ " <email-to>"
		+ " <email-from>"
		+ " &"
		+ "\n\n\n"
	, btoa = require('btoa')
	, gitU = process.argv[5]
	, gitP = process.argv[6]
	, log = require("npmlog")


module.exports = exports = {
	git: {
		url: 'git@github.com'
		, owner: process.argv[2]
		, repo: process.argv[3]
		, branch: process.argv[4]
		, username: gitU
		, password: gitP
		, listener: {
			port: 8443
		}
		, api: {
			hostname: 'api.github.com'
			, headers: {
				"Accept": 'application/vnd.github.v3+json'
				, "User-Agent": 'vigour-packer-server'
				, "Authorization": "Basic "
					+ btoa(gitU
						+ ":"
						+ gitP)
			}
		}
	}
	, email: {
		username: process.argv[7]
		, password: process.argv[8]
	}
	, assetRoot: __dirname + '/files'
	, buildDir: 'packerBuilt'
	, shaDir: 'shas'
	, maxHistory: 3
	, port: 8000
	// , notifyCloudRetries: 5
	// , cloudDisconnectDelay: 10 * 1000
	// , notifyCloudRetryDelay: 5 * 1000
	// , cloudNotificationDelay: 15 * 1000
	, goLiveDelay: 0
	, shaPlaceholder : 'SHA'
	, shaHistoryName: 'history.json'
	, mailFrom: process.argv[12]
	, mailTo: process.argv[11]
	, retryAfter: 1
	, debug: true
	, minFreeSpace: 0.15
	, slack: {
		path: '/services/' + process.argv[9]
		, token: process.argv[10]
	}
}
if (!exports.git.branch) {
	console.warn('missing git.branch')
	throw usage
}

exports.offlineMode = exports.git.branch.indexOf("/") !== -1

if (!exports.slack.token) {
	console.log('missing slack.token')
	throw usage
}
var path = require('path')
	, config = module.exports = exports = {}
exports.items = {
// Config files
"vigour.packer.config":
	{ d: null
	, env: "PACKER_CONFIG"
	, cli: "-c, --config <paths>"
	, getter: "config"
	, desc: "Comma-separated list of paths to config files\
	 config priority: defaults > *files* > env > cli"
	, isConfig: true
	}

// Packer
,	"vigour.packer.buildDir":
	{ d: "packerBuilt"
	, env: "PACKER_BUILD_DIR"
	, cli: "--build-dir <name>"
	, getter: "buildDir"
	, desc: "Name to assign to build directory created within app"
	}
,	"vigour.packer.maxHistory":
	{ d: 5
	, env: "PACKER_MAX_HISTORY"
	, cli: "--history, --max-history <nb>"
	, getter: "history"
	, desc: "Maximum number of versions to serve"
	}
,	"vigour.packer.shaPlaceholder":
	{ d: "SHA"
	, env: "PACKER_SHA_PLACEHOLDER"
	, cli: "--sha-placeholder <string>"
	, getter: "shaPlaceholder"
	, desc: "Placeholder for SHA in css files needing rebasing"
	}
,	"vigour.packer.port":
	{ d: 8000
	, env: "PACKER_PORT"
	, cli: "-p, --port <port>"
	, getter: "port"
	, desc: "Port on which to listen for app clients"
	}
, "vigour.packer.retryAfter":
	{ d: 1
	, env: "PACKER_RETRY_AFTER"
	, cli: "--retry-after <nbSeconds>"
	, getter: "retryAfter"
	, desc: "OBSOLETE"
	}
, "vigour.packer.minFreeSpace":
	{ d: 0.15
	, env: "PACKER_MIN_SPACE"
	, cli: "--min-free-space <proportion>"
	, getter: "minFreeSpace"
	, desc: "Free space threshold for notifying dev"
	}
, "vigour.packer.assetRoot":
	{ d: path.join(__dirname, 'files')
	, env: "PACKER_ASSET_ROOT"
	, cli: "--asset-root <path>"
	, getter: "assetRoot"
	, desc: "Directory holding dynamically created files"
	}
, "vigour.packer.shaDir":
	{ d: 'shas'
	, env: "PACKER_SHA_DIR"
	, cli: "--sha-dir <path>"
	, getter: "shaDir"
	, desc: "Directory holding app clones"
	}
, "vigour.packer.shaHistoryName":
	{ d: "history.json"
	, env: "PACKER_SHA_HISTORY_NAME"
	, cli: "--sha-history-name <name>"
	, getter: "shaHistoryName"
	, desc: "Sha history file name"
	}
, "vigour.packer.stateFileName":
	{ d: "state.json"
	, env: "PACKER_STATE_FILENAME"
	, cli: "--state-filename <name>"
	, getter: "stateFilename"
	, desc: "Name of dynamic file containing state"
	}
, "vigour.packer.robots":
	{ d: true
	, env: "PACKER_ROBOTS"
	, cli: "--no-robots"
	, getter: "robots"
	, desc: "Serves `vigour-packer-server/robots.txt` on `GET /robots.txt` by default. Use --no-robots to serve the `robots.txt` from your app instead"
	}
, "vigour.packer.geo":
	{ d: true
	, env: "PACKER_GEO"
	, cli: "--no-geo"
	, getter: "geo"
	, desc: "Serves `vigour-packer-server/geo.json` on `GET /geo` by default. Use --no-geo to remove this feature"
	}
, "vigour.packer.akamai":
	{ d: false
	, env: "PACKER_AKAMAI"
	, cli: "--akamai"
	, getter: "akamai"
	, desc: "Includes Akamai-specific 'Edge-Control' cache headers"
	}

// Mail
, "vigour.packer.mail.fromAddress":
	{ d: null
	, env: "MAIL_FROM"
	, cli: "--mail-from <email>"
	, getter: "mailFrom"
	, desc: "E-mail address to use in the 'from' field"
	}
,	"vigour.packer.mail.to":
	{ d: null
	, env: "MAIL_TO"
	, cli: "--mail-to <email>"
	, getter: "mailTo"
	, desc: "Comma-separated list of e-mail addresses to contact"
	}
,	"vigour.packer.mail.username":
	{ d: null
	, env: "MAIL_USERNAME"
	, cli: "--mail-username <name>"
	, getter: "mailUsername"
	, desc: "Username of e-mail account to authenticate as"
	}
,	"vigour.packer.mail.password":
	{ d: null
	, env: "MAIL_PASSWORD"
	, cli: "--mail-password <password>"
	, getter: "mailPassword"
	, desc: "Password for account associated to vigour.packer.mail.username"
	}

// Slack
, "vigour.packer.slack.id":
	{ d: null
	, env: "SLACK_ID"
	, cli: "--slack-id <id>"
	, getter: "slackId"
	, desc: "String identifying the slack service to contact"
	}
,	"vigour.packer.slack.token":
	{ d: null
	, env: "SLACK_TOKEN"
	, cli: "--slack-token <token>"
	, getter: "slackToken"
	, desc: "Token to use when authenticating slack requests"
	}
, "vigour.packer.slack.channel":
	{ d: "packers"
	, env: "SLACK_CHANNEL"
	, cli: "--slack-channel <channel>"
	, getter: "slackChannel"
	, desc: "Slack channel to send warnings to, without the leading #"
	}

// Git
, "vigour.packer.git.owner":
	{ d: null
	, env: "GIT_OWNER"
	, cli: "--git-owner <username>"
	, getter: "gitOwner"
	, desc: "Username for the GitHub account that owns the app"
	}
,	"vigour.packer.git.repo":
	{ d: null
	, env: "GIT_REPO"
	, cli: "--git-repo <name>"
	, getter: "gitRepo"
	, desc: "App repository name"
	}
,	"vigour.packer.git.branch":
	{ d: null
	, env: "GIT_BRANCH"
	, cli: "-b, --git-branch <name>"
	, getter: "gitBranch"
	, desc: "Branch of app to serve"
	}
, "vigour.packer.git.username":
	{ d: null
	, env: "GIT_USERNAME"
	, cli: "--git-username <name>"
	, getter: "gitUsername"
	, desc: "Username for the git account to clone with"
	}
,	"vigour.packer.git.password":
	{ d: null
	, env: "GIT_PASSWORD"
	, cli: "--git-password <password>"
	, getter: "gitPassword"
	, desc: "Password for the account associated to vigour.packer.git.username"
	}
,	"vigour.packer.git.port":
	{ d: 8443
	, env: "GIT_PORT"
	, cli: "-g, --git-port <portNumber>"
	, getter: "gitPort"
	, desc: "Port on which to listen for GitHub WebHooks"
	}
,	"vigour.packer.git.url":
	{ d: "git@github-machines"
	, env: "GIT_URL"
	, cli: "--git-hub <user@domain>"
	, getter: "gitHub"
	, desc: "git@github.com"
	}
,	"vigour.packer.git.api.hostname":
	{ d: "api.github.com"
	, env: "GIT_API_HOST"
	, cli: "--git-api-host <apiDomain>"
	, getter: "gitApiHost"
	, desc: "api.github.com"
	}
,	"vigour.packer.git.api.headers.Accept":
	{ d: "application/vnd.github.v3+json"
	, env: "GIT_ACCEPT"
	, cli: "--git-accept <acceptHeader>"
	, getter: "gitAccept"
	, desc: "application/vnd.github.v3+json"
	}
,	"vigour.packer.git.api.headers.User-Agent":
	{ d: "vigour-packer-server"
	, env: "GIT_UA"
	, cli: "--git-ua <userAgent>"
	, getter: "gitUa"
	, desc: "User agent string packer should use when making requests to GitHub"
	}

// Cleanup
, "vigour.packer.cleanup":
	{ d: null
	, env: "PACKER_CLEANUP"
	, cli: "-x, --cleanup"
	, getter: "cleanup"
	, desc: "Removes all downloaded and created assets,\
	 state.json, and history.json\
	 transformHistory.json is conserved"
	}

// Local
,	"vigour.packer.src":
	{ d: null
	, env: "PACKER_SRC"
	, cli: "--src <path>"
	, getter: "src"
	, desc: "Absolute path to app"
	}

// Release 
,	"vigour.packer.release":
	{ d: false
	, env: "PACKER_RELEASE"
	, cli: "-r, --release"
	, getter: "release"
	, desc: "Commits assets declared in app's package.json\
	 to sepcified branch of release repo\
	 (<this_repo>-packer-release), creating it if needed"
	}
, "vigour.packer.releaseRepo.suffix":
	{ d: "-packer-release"
	, env: "PACKER_RELEASE_SUFFIX"
	, cli: "--release-suffix <string>"
	, getter: "releaseSuffix"
	, desc: "Suffix for release repo"
	}
, "vigour.packer.releaseRepo.name":
	{ d: null
	, env: "PACKER_RELEASE_NAME"
	, cli: "--release-name <name>"
	, getter: "releaseName"
	, desc: "Name of release repo"
	}
, "vigour.packer.releaseRepo.absPath":
	{ d: null
	, env: "PACKER_RELEASE_ABS_PATH"
	, cli: "--release-abs-path <path>"
	, getter: "releaseAbsPath"
	, desc: "Path to release repo"
	}

// Install / Launch
, "vigour.packer.delpoy":
	{ d: false
	, env: "PACKER_DEPLOY"
	, cli: "-d, --deploy"
	, getter: "deploy"
	, desc: "Install packer on remote machine"
	}
,	"vigour.packer.server.ip":
	{ d: null
	, env: "PACKER_SERVER_IP"
	, cli: "--ip <ip>"
	, getter: "ip"
	, desc: "Deploys and launches a packer server for this app at provided IP"
	}
,	"vigour.packer.server.identity":
	{ d: null
	, env: "PACKER_SERVER_IDENTITY"
	, cli: "--identity <path>"
	, getter: "identity"
	, desc: "Path to identity file to use when connecting to vigour.package.server.ip"
	}
,	"vigour.packer.server.ssh.id":
	{ d: null
	, env: "PACKER_SERVER_SSH_ID"
	, cli: "--ssh-id <id_rsa>"
	, getter: "sshId"
	, desc: "Path to SSH private key"
	}
,	"vigour.packer.server.ssh.key":
	{ d: null
	, env: "PACKER_SERVER_SSH_KEY"
	, cli: "--ssh-key <id_rsa.pub>"
	, getter: "sshKey"
	, desc: "Path to SSH public key"
	}
,	"vigour.packer.server.ssl.cert":
	{ d: null
	, env: "PACKER_SERVER_SSL_CERT"
	, cli: "--ssl-cert <path>"
	, getter: "sslCert"
	, desc: "Path to SSL certificate"
	}
,	"vigour.packer.server.ssl.key":
	{ d: null
	, env: "PACKER_SERVER_SSL_KEY"
	, cli: "--ssl-key <path>"
	, getter: "sslKey"
	, desc: "Path to private key of SSL certificate"
	}
,	"vigour.packer.server.ssl.password":
	{ d: null
	, env: "PACKER_SERVER_SSL_PASSWORD"
	, cli: "--ssl-password <password>"
	, getter: "sslPassword"
	, desc: "Password for SSL certificate"
	}
,	"vigour.packer.server.user":
	{ d: null
	, env: "PACKER_SERVER_USER"
	, cli: "--server-user <name>"
	, getter: "serverUser"
	, desc: "User to authenticate as on vigour.packer.server.ip"
	}
,	"vigour.packer.server.remoteHome":
	{ d: null
	, env: "PACKER_SERVER_REMOTEHOME"
	, cli: "--remote-home <path>"
	, getter: "remoteHome"
	, desc: "Path to home directory on remote machine where packer server should be installed"
	}
}
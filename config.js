var path = require('path')
var version = require('./package.json').version
var config = module.exports = exports = {}

config.version = version

config.items = {
// Packer
"vigour.packer.buildDir":
	{ def: "packerBuilt"
	, env: "PACKER_BUILD_DIR"
	, cli: "--build-dir <name>"
	, desc: "Name to assign to build directory created within app"
	}
,	"vigour.packer.maxHistory":
	{ def: 5
	, env: "PACKER_MAX_HISTORY"
	, cli: "--history <nb>"
	, desc: "Maximum number of versions to serve"
	}
,	"vigour.packer.shaPlaceholder":
	{ def: "SHA"
	, env: "PACKER_SHA_PLACEHOLDER"
	, cli: "--sha-placeholder <string>"
	, desc: "Placeholder for SHA in css files needing rebasing"
	}
,	"vigour.packer.port":
	{ def: 8000
	, env: "PACKER_PORT"
	, cli: "-p, --port <port>"
	, desc: "Port on which to listen for app clients"
	}
, "vigour.packer.retryAfter":
	{ def: 1
	, env: "PACKER_RETRY_AFTER"
	, cli: "--retry-after <nbSeconds>"
	, desc: "OBSOLETE"
	}
, "vigour.packer.minFreeSpace":
	{ def: 0.15
	, env: "PACKER_MIN_SPACE"
	, cli: "--min-free-space <proportion>"
	, desc: "Free space threshold for notifying dev"
	}
, "vigour.packer.assetRoot":
	{ def: path.join(__dirname, 'files')
	, env: "PACKER_ASSET_ROOT"
	, cli: "--asset-root <path>"
	, desc: "Directory holding dynamically created files"
	}
, "vigour.packer.shaDir":
	{ def: 'shas'
	, env: "PACKER_SHA_DIR"
	, cli: "--sha-dir <path>"
	, desc: "Directory holding app clones"
	}
, "vigour.packer.shaHistoryName":
	{ def: "history.json"
	, env: "PACKER_SHA_HISTORY_NAME"
	, cli: "--sha-history-name <name>"
	, desc: "Sha history file name"
	}
, "vigour.packer.stateFileName":
	{ def: "state.json"
	, env: "PACKER_STATE_FILENAME"
	, cli: "--state-filename <name>"
	, desc: "Name of dynamic file containing state"
	}
, "vigour.packer.robots":
	{ def: true
	, env: "PACKER_ROBOTS"
	, cli: "--no-robots"
	, desc: "Serves `vigour-packer-server/robots.txt` on `GET /robots.txt` by default. Use --no-robots to serve the `robots.txt` from your app instead"
	}
, "vigour.packer.geo":
	{ def: true
	, env: "PACKER_GEO"
	, cli: "--no-geo"
	, desc: "Serves `vigour-packer-server/geo.json` on `GET /geo` by default. Use --no-geo to remove this feature"
	}
, "vigour.packer.akamai":
	{ def: false
	, env: "PACKER_AKAMAI"
	, cli: "--akamai"
	, desc: "Includes Akamai-specific 'Edge-Control' cache headers"
	}
, "vigour.packer.warn":
	{ def: true
	, env: "PACKER_WARN"
	, cli: "--no-warn"
	, desc: "Disables slack and mail warnings (useful for testing)"
	}

// Mail
, "vigour.packer.mail.fromAddress":
	{ def: null
	, env: "MAIL_FROM"
	, cli: "--mail-from <email>"
	, desc: "E-mail address to use in the 'from' field"
	}
,	"vigour.packer.mail.to":
	{ def: null
	, env: "MAIL_TO"
	, cli: "--mail-to <email>"
	, desc: "Comma-separated list of e-mail addresses to contact"
	}
,	"vigour.packer.mail.username":
	{ def: null
	, env: "MAIL_USERNAME"
	, cli: "--mail-username <name>"
	, desc: "Username of e-mail account to authenticate as"
	}
,	"vigour.packer.mail.password":
	{ def: null
	, env: "MAIL_PASSWORD"
	, cli: "--mail-password <password>"
	, desc: "Password for account associated to vigour.packer.mail.username"
	}

// Slack
, "vigour.packer.slack.id":
	{ def: null
	, env: "SLACK_ID"
	, cli: "--slack-id <id>"
	, desc: "String identifying the slack service to contact"
	}
,	"vigour.packer.slack.token":
	{ def: null
	, env: "SLACK_TOKEN"
	, cli: "--slack-token <token>"
	, desc: "Token to use when authenticating slack requests"
	}
, "vigour.packer.slack.channel":
	{ def: "packers"
	, env: "SLACK_CHANNEL"
	, cli: "--slack-channel <channel>"
	, desc: "Slack channel to send warnings to, without the leading #"
	}

// Git
, "vigour.packer.git.owner":
	{ def: null
	, env: "GIT_OWNER"
	, cli: "--git-owner <username>"
	, desc: "Username for the GitHub account that owns the app"
	}
,	"vigour.packer.git.repo":
	{ def: null
	, env: "GIT_REPO"
	, cli: "--git-repo <name>"
	, desc: "App repository name"
	}
,	"vigour.packer.git.branch":
	{ def: null
	, env: "GIT_BRANCH"
	, cli: "-b, --git-branch <name>"
	, desc: "Branch of app to serve"
	}
, "vigour.packer.git.username":
	{ def: null
	, env: "GIT_USERNAME"
	, cli: "--git-username <name>"
	, desc: "Username for the git account to clone with"
	}
,	"vigour.packer.git.password":
	{ def: null
	, env: "GIT_PASSWORD"
	, cli: "--git-password <password>"
	, desc: "Password for the account associated to vigour.packer.git.username"
	}
,	"vigour.packer.git.port":
	{ def: 8443
	, env: "GIT_PORT"
	, cli: "-g, --git-port <portNumber>"
	, desc: "Port on which to listen for GitHub WebHooks"
	}
,	"vigour.packer.git.url":
	{ def: "git@github.com"
	, env: "GIT_URL"
	, cli: "--git-hub <user@domain>"
	, desc: "git@github.com"
	}
,	"vigour.packer.git.api.hostname":
	{ def: "api.github.com"
	, env: "GIT_API_HOST"
	, cli: "--git-api-host <apiDomain>"
	, desc: "api.github.com"
	}
,	"vigour.packer.git.api.headers.Accept":
	{ def: "application/vnd.github.v3+json"
	, env: "GIT_ACCEPT"
	, cli: "--git-accept <acceptHeader>"
	, desc: "application/vnd.github.v3+json"
	}
,	"vigour.packer.git.api.headers.User-Agent":
	{ def: "vigour-packer-server"
	, env: "GIT_UA"
	, cli: "--git-ua <userAgent>"
	, desc: "User agent string packer should use when making requests to GitHub"
	}

// Cleanup
, "vigour.packer.cleanup":
	{ def: null
	, env: "PACKER_CLEANUP"
	, cli: "-x, --cleanup"
	, desc: "Removes all downloaded and created assets,\
	 state.json, and history.json\
	 transformHistory.json is conserved"
	}

// Local
,	"vigour.packer.src":
	{ def: null
	, env: "PACKER_SRC"
	, cli: "--src <path>"
	, desc: "Absolute path to app"
	}

// Release
,	"vigour.packer.release":
	{ def: false
	, env: "PACKER_RELEASE"
	, cli: "-r, --release"
	, desc: "Commits assets declared in app's package.json\
	 to sepcified branch of release repo\
	 (<this_repo>-packer-release), creating it if needed"
	}
, "vigour.packer.releaseRepo.suffix":
	{ def: "-packer-release"
	, env: "PACKER_RELEASE_SUFFIX"
	, cli: "--release-suffix <string>"
	, desc: "Suffix for release repo"
	}
, "vigour.packer.releaseRepo.name":
	{ def: null
	, env: "PACKER_RELEASE_NAME"
	, cli: "--release-name <name>"
	, desc: "Name of release repo"
	}
, "vigour.packer.releaseRepo.absPath":
	{ def: null
	, env: "PACKER_RELEASE_ABS_PATH"
	, cli: "--release-abs-path <path>"
	, desc: "Path to release repo"
	}

// Install / Launch
, "vigour.packer.delpoy":
	{ def: false
	, env: "PACKER_DEPLOY"
	, cli: "-d, --deploy"
	, desc: "Install packer on remote machine"
	}
,	"vigour.packer.server.ip":
	{ def: null
	, env: "PACKER_SERVER_IP"
	, cli: "--ip <ip>"
	, desc: "Deploys and launches a packer server for this app at provided IP"
	}
,	"vigour.packer.server.identity":
	{ def: null
	, env: "PACKER_SERVER_IDENTITY"
	, cli: "--identity <path>"
	, desc: "Path to identity file to use when connecting to vigour.package.server.ip"
	}
,	"vigour.packer.server.ssh.id":
	{ def: null
	, env: "PACKER_SERVER_SSH_ID"
	, cli: "--ssh-id <id_rsa>"
	, desc: "Path to SSH private key"
	}
,	"vigour.packer.server.ssh.key":
	{ def: null
	, env: "PACKER_SERVER_SSH_KEY"
	, cli: "--ssh-key <id_rsa.pub>"
	, desc: "Path to SSH public key"
	}
,	"vigour.packer.server.ssl.cert":
	{ def: null
	, env: "PACKER_SERVER_SSL_CERT"
	, cli: "--ssl-cert <path>"
	, desc: "Path to SSL certificate"
	}
,	"vigour.packer.server.ssl.key":
	{ def: null
	, env: "PACKER_SERVER_SSL_KEY"
	, cli: "--ssl-key <path>"
	, desc: "Path to private key of SSL certificate"
	}
,	"vigour.packer.server.ssl.password":
	{ def: null
	, env: "PACKER_SERVER_SSL_PASSWORD"
	, cli: "--ssl-password <password>"
	, desc: "Password for SSL certificate"
	}
,	"vigour.packer.server.user":
	{ def: null
	, env: "PACKER_SERVER_USER"
	, cli: "--server-user <name>"
	, desc: "User to authenticate as on vigour.packer.server.ip"
	}
,	"vigour.packer.server.remoteHome":
	{ def: null
	, env: "PACKER_SERVER_REMOTEHOME"
	, cli: "--remote-home <path>"
	, desc: "Path to home directory on remote machine where packer server should be installed"
	}
}

config.files =
	{ def: null
	, env: "PACKER_CONFIG"
	}

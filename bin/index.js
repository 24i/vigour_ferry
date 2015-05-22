#!/usr/bin/env node

var path = require('path')
	, program = require('commander')
	, Promise = require('promise')
	, VObj = require('vigour-js/object')
	, fs = require('vigour-fs')
	, readFile = Promise.denodeify(fs.readFile)
	, packer = require('../')
	, cwd = process.cwd()
	, pkg = require(path.join(cwd, 'package.json'))
	, secretPkg = require(path.join(cwd, '.package.json'))
	, env =
		{ vigour:
			{ packer:
				{ git:
					{

					}
				, mail:
					{

					}
				, slack:
					{

					}
				}
			}
		}
	, cliArgs =
		{ vigour:
			{ packer:
				{ git:
					{

					}
				, mail:
					{

					}
				, slack:
					{
						
					}
				}
			}
		}
	, opts = new VObj(pkg)

opts.merge(secretPkg)



// ENV
// Packer
if (process.env.PACKER_SRC) {
	env.vigour.packer.src = process.env.PACKER_SRC
}
if (process.env.PACKER_BUILD_DIR) {
	env.vigour.packer.buildDir = process.env.PACKER_BUILD_DIR
}
if (process.env.PACKER_MAX_HISTORY) {
	env.vigour.packer.maxHistory = process.env.PACKER_MAX_HISTORY
}
if (process.env.PACKER_SHA_PLACEHOLDER) {
	env.vigour.packer.shaPlaceholder = process.env.PACKER_SHA_PLACEHOLDER
}
if (process.env.PACKER_PORT) {
	env.vigour.packer.port = process.env.PACKER_PORT
}
if (process.env.PACKER_VALIDATE) {
	env.vigour.packer.validate = process.env.PACKER_VALIDATE
}
// Git
if (process.env.GIT_OWNER) {
	env.vigour.packer.git.owner = process.env.GIT_OWNER
}
if (process.env.GIT_REPO) {
	env.vigour.packer.git.repo = process.env.GIT_REPO
}
if (process.env.GIT_BRANCH) {
	env.vigour.packer.git.branch = process.env.GIT_BRANCH
}

if (process.env.GIT_USERNAME) {
	env.vigour.packer.git.username = process.env.GIT_USERNAME
}
if (process.env.GIT_PASSWORD) {
	env.vigour.packer.git.password = process.env.GIT_PASSWORD
}
if (process.env.GIT_PORT) {
	env.vigour.packer.git.port = process.env.GIT_PORT
}
if (process.env.GIT_URL) {
	env.vigour.packer.git.url = process.env.GIT_URL
}
if (process.env.GIT_API_HOST) {
	env.vigour.packer.git.apiHost = process.env.GIT_API_HOST
}
if (process.env.GIT_ACCEPT) {
	env.vigour.packer.git.accept = process.env.GIT_ACCEPT
}
if (process.env.GIT_UA) {
	env.vigour.packer.git.ua = process.env.GIT_UA
}
// Mail
if (process.env.MAIL_FROM) {
	env.vigour.packer.mail.fromAddress = process.env.MAIL_FROM
}
if (process.env.MAIL_TO) {
	env.vigour.packer.mail.to = process.env.MAIL_TO
}
if (process.env.MAIL_USERNAME) {
	env.vigour.packer.mail.username = process.env.MAIL_USERNAME
}
if (process.env.MAIL_PASSWORD) {
	env.vigour.packer.mail.password = process.env.MAIL_PASSWORD
}
// Slack
if (process.env.SLACK_ID) {
	env.vigour.packer.slack.id = process.env.SLACK_ID
}
if (process.env.SLACK_TOKEN) {
	env.vigour.packer.slack.token = process.env.SLACK_TOKEN
}
opts.merge(env)



// CLI
program
	.version(pkg.version)
	.usage("[options]")
	.option("-p, --port <port>", "port packer should listen on")
	.option("-h, --history <maxHistory>", "maximum number of versions of the app to keep in history")
	.option("--validate", "validates package and exits")
	.option("--build-dir <buildDir>", "name packer should assign to build directory")
	.option("--sha-placeholder <shaPlaceholder>", "sha placeholder for `rebase`d .css files")

	.option("--src <path>", "Absolute path of the app packer should server")

	.option("--git-owner <name>", "username for the git account that owns the repository packer should serve")
	.option("--git-repo <name>", "repository packer should server")
	.option("--git-branch <name>", "branch packer should serve")
	.option("--git-username <name>", "username for the git account packer should use to clone the app repo")
	.option("--git-password <password>", "password for the account referred to in the --git-username option")
	.option("--git-port <portNumber>", "port packer should listen for GitHub webhooks on")
	.option("--git-hub <user@domain>", "git@github.com")
	.option("--git-api-host <apiDomain>", "api.github.com")
	.option("--git-accept <acceptHeader>", "application/vnd.github.v3+json")
	.option("--git-ua <userAgent>", "User agent string packer should use when making requests to GitHub")

	.option("--mail-to <address>"
		, "comma-separated list of e-mail addresses to which packer should send alerts")
	.option("--mail-from <address>"
		, "e-mail address in the 'from' field when packer emits alerts")
	.option("--mail-username <name>"
		, "username of e-mail account packer should use to send alerts")
	.option("--mail-password"
		, "password for account associated to --mail-username")

	.option("--slack-id"
		, "string identifying the slack service packer should reach when emiting alerts")
	.option("--slack-token"
		, "token packer should use when authentifying with slack")
	.parse(process.argv)

// Packer
if (program.buildDir) {
	cliArgs.vigour.packer.buildDir = program.buildDir
}
if (program.history) {
	cliArgs.vigour.packer.maxHistory = program.history
}
if (program.shaPlaceholder) {
	cliArgs.vigour.packer.shaPlaceholder = program.shaPlaceholder
}
if (program.port) {
	cliArgs.vigour.packer.port = program.port
}
if (program.validate) {
	cliArgs.vigour.packer.validate = program.validate
}
if (program.src) {
	cliArgs.vigour.packer.src = program.src
}
// Git
if (program.gitOwner) {
	cliArgs.vigour.packer.git.owner = program.gitOwner
}
if (program.gitRepo) {
	cliArgs.vigour.packer.git.repo = program.gitRepo
}
if (program.gitBranch) {
	cliArgs.vigour.packer.git.branch = program.gitBranch
}
if (program.gitUsername) {
	cliArgs.vigour.packer.git.username = program.gitUsername
}
if (program.gitPassword) {
	cliArgs.vigour.packer.git.password = program.gitPassword
}
if (program.gitPort) {
	cliArgs.vigour.packer.git.port = program.gitPort
}
if (program.gitUrl) {
	cliArgs.vigour.packer.git.url = program.gitUrl
}
if (program.gitApiHost) {
	cliArgs.vigour.packer.git.apiHost = program.gitApiHost
}
if (program.gitAccept) {
	cliArgs.vigour.packer.git.accept = program.gitAccept
}
if (program.gitUa) {
	cliArgs.vigour.packer.git.ua = program.gitUa
}
// Mail
if (program.mailFrom) {
	cliArgs.vigour.packer.mail.fromAddress = program.mailFrom
}
if (program.mailTo) {
	cliArgs.vigour.packer.mail.to = program.mailTo
}
if (program.mailUsername) {
	cliArgs.vigour.packer.mail.username = program.mailUsername
}
if (program.mailPassword) {
	cliArgs.vigour.packer.mail.password = program.mailPassword
}
// Slack
if (program.slackId) {
	cliArgs.vigour.packer.slack.id = program.slackId
}
if (program.slackToken) {
	cliArgs.vigour.packer.slack.token = program.slackToken
}



opts.merge(cliArgs)

if (opts.vigour.packer.git && opts.vigour.packer.git.branch) {
	try {
		packer(opts)
	} catch (e) {
		console.error("Error starting packer", e)
	}
} else {
	getGitHead(process.cwd())
		.then(function (gitHead) {
			var extra = { vigour: { packer: { git: { branch: gitHead } } } }
			console.warn("Guessing branch:", gitHead)
			opts.merge(extra)
			try {
				packer(opts)
			} catch (e) {
				console.error("error starting packer", e)
			}
		})
		.catch(function (reason) {
			console.error("Can't guess git branch", reason)
		})
}


function getGitHead (dir) {
  var optimize = false
  	, gitHead
  return new Promise(function (resolve, reject) {
    var p
    if (gitHead && optimize) {
      resolve(gitHead)
    } else {
      p = path.join(dir, '.git')
      fs.exists(p, function (exists) {
        if (exists) {
          resolve(readFile(path.join(p, 'HEAD'), 'utf8')
            .then(function (data) {
              var head = parseHEAD(data)
              gitHead = head
              return head
            }))
        } else {
          resolve(getGitHead(path.resolve(dir, '..')))
        }
      })
    }
  })
}

function parseHEAD (str) {
  var i = str.lastIndexOf('/')
  return str.slice(i + 1, str.length - 1)
}
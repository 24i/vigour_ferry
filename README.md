vigour-packer-server
===

## Installation

`npm install`

## Usage

`npm start -- <options>`

or

```
var packer = require('vigour-packer-server')
packer(options)
```

For a list of available options, see config.js

## Typical examples

### Releasing a new version of an app
When declared as a dependency to another project, `npm install`ing said project will make an executable called `packer` available from the command line. Use it to release a version of that project:
`packer -r -c package.json,.package.json`

### Launching a packer server
`npm start -- -c ../.package.json,.package.json -b dev &`

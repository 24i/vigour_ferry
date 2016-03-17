*<p style="border-style: solid; border-width: 0 0 0 5px; border-color: #F9DD52; padding-left: 5px;">This repo is deprecated and will be deleted soon. Use [packer-server](https://github.com/vigour-io/packer-server) instead</p>*

ferry
===

## Installation

`npm install`

## Usage

`npm start -- <options>`

or

```
var Ferry = require('ferry')
var ferry = new Ferry(options)
ferry.start()
```

For a list of available options, see config.js

## Typical examples

### Releasing a new version of an app
When declared as a dependency to another project, `npm install`ing said project will make an executable called `ferry` available from the command line. Use it to release a version of that project:
`ferry --release --mergeFiles '[\"/absolute/path/to/package.json\",\"/absolute/path/to/.package.json\"]'`

### Launching a ferry
`npm start -- --mergeFiles '[\"../.package.json\",\".package.json\"]' --git '{"branch":"dev"}' &`

var path = require('path')
var Config = require('vigour-js/lib/config')
var Transformer = require('../../../lib/Transformer')
var transformer
describe('transforms', function () {
  before(function () {
    transformer = new Transformer(new Config({
      assetRoot: path.join(__dirname, '..', '..', '..', 'files'),
      stateFileName: 'state.json',
      shaPlaceholder: 'SHA'
    }))
  })
  it('rebase'
  , function () {
    var sampleCSS = "body { url('/assets/img/icon.png') }"
    return transformer.transform(sampleCSS,
      ['rebase'],
      { fsRoot: 'baller/SHA/son' },
      { sha: 'sha' }
    ).then(function (rebased) {
      expect(rebased).to.equal("body { url('baller/sha/son/assets/img/icon.png') }")
    })
  })
})

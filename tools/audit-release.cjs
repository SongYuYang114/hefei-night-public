'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const asar = require('@electron/asar');
const root = path.resolve(__dirname, '..'), version = require('../package.json').version;
const archive = path.join(root, '..', 'build-v' + version, 'win-unpacked', 'resources', 'app.asar');
const files = asar.listPackage(archive).map(n=>n.replace(/^[/\\]/,'').replace(/\\/g,'/'));
for (const file of ['main.cjs','preload.cjs','release.config.json','launcher/index.html','launcher/preload.cjs','launcher/updater.cjs','dist/game.js','dist/vendor/THREE-LICENSE.md','dist/assets/audio/SOURCES.md']) {
  assert(files.includes(file), 'Missing runtime file: ' + file);
  assert(fs.readFileSync(path.join(root,file)).equals(asar.extractFile(archive,path.normalize(file))), 'Packed file differs: ' + file);
}
assert(!files.some(n=> /(^|\/)(\.local|hefei-runtime\.json|runtime\.json|update-private\.pem)(\/|$)/.test(n)), 'Private configuration must not be packaged.');
assert.equal(JSON.parse(asar.extractFile(archive,'package.json')).version,version);
console.log(JSON.stringify({passed:true,version,packedFiles:files.length,privateConfigurationExcluded:true}));

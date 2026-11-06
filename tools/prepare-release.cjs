'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { canonical, verifyManifest, compareVersions } = require('../launcher/manifest.cjs');
const { hashFile } = require('../launcher/updater.cjs');
const root = path.resolve(__dirname, '..'), config = require('../release.config.json');
async function prepare({version = require('../package.json').version, artifact, output, keyFile, key, notes} = {}) {
  if (compareVersions(version, '1.0.0') < 0) throw Error('Distribution versions start at 1.0.0.');
  artifact ||= path.join(root, '..', 'build-v' + version, `HefeiNight-${version}-win-x64.exe`);
  output ||= path.join(root, 'artifacts', 'release', version);
  if (!key) key = await fs.readFile(keyFile || process.env.HEFEI_SIGNING_KEY || path.join(root, '.local', 'update-private.pem'));
  const name = `HefeiNight-${version}-win-x64.exe`;
  const payload = {schema:1, version, channel:'stable', platform:'win32', arch:'x64', protocol:require('../signaling.cjs').GAME_PROTOCOL, publishedAt:new Date().toISOString(),
    notes:notes ?? await fs.readFile(path.join(root, 'docs', 'releases', version + '.md'), 'utf8'),
    artifact:{name, size:(await fs.stat(artifact)).size, sha256:await hashFile(artifact)}};
  const envelope = {payload, signature:crypto.sign(null, Buffer.from(canonical(payload)), key).toString('base64')};
  verifyManifest(envelope, config.publicKey);
  await fs.mkdir(output, {recursive:true});
  await fs.copyFile(artifact, path.join(output, name));
  await fs.writeFile(path.join(output, 'latest.json'), JSON.stringify(envelope, null, 2) + '\n');
  await fs.writeFile(path.join(output, 'SHA256SUMS'), payload.artifact.sha256 + '  ' + name + '\n');
  return {version, output, sha256:payload.artifact.sha256};
}
module.exports = {prepare};
if (require.main === module) prepare().then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error.message);process.exitCode=1;});

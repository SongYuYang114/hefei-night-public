'use strict';
// Run once before the first release. Never replace a key used by installed clients.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..'), privateFile = path.join(root, '.local', 'update-private.pem');
if (fs.existsSync(privateFile) || fs.existsSync(path.join(root, 'release.config.json'))) throw Error('Release key/config already exists; refusing to overwrite.');
fs.mkdirSync(path.dirname(privateFile), { recursive: true });
const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
fs.writeFileSync(privateFile, privateKey.export({type:'pkcs8',format:'pem'}), { mode:0o600, flag:'wx' });
fs.writeFileSync(path.join(root, 'release.config.json'), JSON.stringify({repository:'galaxy-of-homos/hefei-night', publicKey:publicKey.export({type:'spki',format:'pem'})}, null, 2) + '\n', {flag:'wx'});
console.log('Created local signing key and public release.config.json. Back up the private key outside Git.');

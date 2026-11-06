'use strict';
const crypto = require('node:crypto');
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
function compareVersions(a, b) {
  if (!VERSION.test(a) || !VERSION.test(b)) throw Error('版本号必须采用 MAJOR.MINOR.PATCH。');
  const av = a.split('.').map(Number), bv = b.split('.').map(Number);
  if (![...av, ...bv].every(Number.isSafeInteger)) throw Error('版本号超出范围。');
  for (let i = 0; i < 3; i++) if (av[i] !== bv[i]) return av[i] > bv[i] ? 1 : -1;
  return 0;
}
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
function verifyManifest(envelope, publicKey) {
  const { payload, signature } = envelope || {};
  if (!payload || typeof signature !== 'string' || signature.length > 256 || !publicKey ||
      !crypto.verify(null, Buffer.from(canonical(payload)), publicKey, Buffer.from(signature, 'base64'))) {
    throw Error('更新清单签名无效，请重试或联系维护者。');
  }
  compareVersions(payload.version, '0.0.0');
  const a = payload.artifact;
  if (payload.schema !== 1 || payload.platform !== 'win32' || payload.arch !== 'x64' || payload.channel !== 'stable' ||
      !Number.isSafeInteger(payload.protocol) || payload.protocol < 1 || !a || a.name !== `HefeiNight-${payload.version}-win-x64.exe` ||
      !Number.isSafeInteger(a.size) || a.size <= 0 || a.size > 2 * 1024 ** 3 || !/^[a-f0-9]{64}$/.test(a.sha256) ||
      typeof payload.notes !== 'string' || payload.notes.length > 16000 || !Number.isFinite(Date.parse(payload.publishedAt))) {
    throw Error('更新清单格式不正确。');
  }
  return payload;
}
module.exports = { compareVersions, canonical, verifyManifest };

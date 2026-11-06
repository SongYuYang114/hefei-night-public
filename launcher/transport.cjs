'use strict';
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');

function safeURL(value) {
  const url = new URL(value);
  const loopback = ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname);
  if (url.username || url.password || url.hash || (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:'))) {
    throw Error('更新地址必须使用 HTTPS。');
  }
  return url;
}
async function request(url, { timeout = 8000, idleTimeout = timeout, ca, signal, maxBytes = 1024 * 1024, destination, onProgress = () => {} } = {}) {
  let current = safeURL(url);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(abort, timeout);
  try {
    for (let hop = 0; hop <= 5; hop++) {
      const response = await new Promise((resolve, reject) => {
        const req = (current.protocol === 'https:' ? https : http).get(current, {
          signal: controller.signal, ca,
          headers: { 'User-Agent': 'HefeiNight-Launcher', Accept: 'application/vnd.github+json', 'Accept-Encoding': 'identity' }
        }, resolve);
        req.setTimeout(idleTimeout, () => req.destroy(Error('下载连接超时。')));
        req.on('error', reject);
      });
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        const next = response.headers.location;
        response.resume();
        if (!next || hop === 5) throw Error('更新下载重定向异常。');
        current = safeURL(new URL(next, current));
        continue;
      }
      if (response.statusCode !== 200) { response.resume(); throw Error(`更新服务返回 HTTP ${response.statusCode}。`); }
      const length = Number(response.headers['content-length']);
      if (Number.isFinite(length) && length > maxBytes) { response.destroy(); throw Error('更新文件超过大小限制。'); }
      let received = 0;
      const counter = new Transform({ transform(chunk, _encoding, done) {
        received += chunk.length;
        if (received > maxBytes) return done(Error('更新文件超过大小限制。'));
        onProgress(received, Number.isFinite(length) ? length : 0);
        done(null, chunk);
      } });
      if (destination) {
        await pipeline(response, counter, fs.createWriteStream(destination, { flags: 'wx' }), { signal: controller.signal });
        return { received };
      }
      const chunks = [];
      await pipeline(response, counter, async function (source) { for await (const chunk of source) chunks.push(chunk); }, { signal: controller.signal });
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }
  } catch (error) {
    if (controller.signal.aborted) throw Error(signal?.aborted ? '更新已取消。' : '连接更新服务超时。');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
module.exports = { request, safeURL };

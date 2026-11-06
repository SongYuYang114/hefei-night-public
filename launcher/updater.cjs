'use strict';
const fs = require('node:fs/promises');
const { createReadStream } = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { request, safeURL } = require('./transport.cjs');
const { verifyManifest, compareVersions } = require('./manifest.cjs');

async function hashFile(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function writeJSON(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = file + '.' + crypto.randomUUID() + '.tmp';
  await fs.writeFile(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
  await fs.rename(temp, file);
}
class Updater {
  constructor({ version, directory, repository, publicKey, runtime = {}, transport = request, onState = () => {} }) {
    this.version = version; this.directory = directory; this.repository = repository; this.publicKey = publicKey;
    this.runtime = runtime; this.transport = transport; this.onState = onState;
    this.state = { phase: 'idle', currentVersion: version, availableVersion: null, source: '', message: '准备检查更新', received: 0, total: 0, notes: '' };
  }
  set(patch) { this.state = { ...this.state, ...patch }; this.onState(this.state); return this.state; }
  cancel() { this.controller?.abort(); }
  get busy() { return ['checking', 'downloading', 'verifying', 'restarting'].includes(this.state.phase); }
  async github(version) {
    const api = `https://api.github.com/repos/${this.repository}/releases/${version ? 'tags/v' + version : 'latest'}`;
    const release = await this.transport(api, { signal: this.controller.signal });
    if (release.draft || release.prerelease || !/^v\d+\.\d+\.\d+$/.test(release.tag_name)) throw Error('没有可用的正式版本。');
    const base = `https://github.com/${this.repository}/releases/download/${release.tag_name}/`;
    const envelope = await this.transport(base + 'latest.json', { signal: this.controller.signal });
    const payload = verifyManifest(envelope, this.publicKey);
    if (release.tag_name !== 'v' + payload.version || (version && version !== payload.version)) throw Error('Release 与更新清单版本不一致。');
    return { envelope, payload, base, source: 'GitHub Release' };
  }
  async fallback(version) {
    if (!this.runtime.fallbackBaseUrl) throw Error('未配置备用下载源。');
    const base = safeURL(this.runtime.fallbackBaseUrl.endsWith('/') ? this.runtime.fallbackBaseUrl : this.runtime.fallbackBaseUrl + '/').href;
    const envelope = await this.transport(base + (version ? version + '/latest.json' : 'latest.json'), { ca: this.runtime.fallbackCa, signal: this.controller.signal });
    const payload = verifyManifest(envelope, this.publicKey);
    if (version && payload.version !== version) throw Error('备用源未同步目标版本，请稍后重试。');
    return { envelope, payload, base: base + payload.version + '/', source: '备用下载源', ca: this.runtime.fallbackCa };
  }
  async check() {
    if (this.busy || this.state.phase === 'ready') return this.state;
    this.controller = new AbortController(); this.candidate = null;
    this.set({ phase: 'checking', message: '正在检查 GitHub Release…', source: '', availableVersion: null, received: 0, total: 0 });
    try {
      try { this.candidate = await this.github(); }
      catch (error) {
        if (this.controller.signal.aborted) throw error;
        this.set({ message: '主下载源暂不可用，正在检查备用源…', source: '备用下载源' });
        this.candidate = await this.fallback();
      }
      const { payload, source } = this.candidate;
      return this.set({ phase: compareVersions(payload.version, this.version) > 0 ? 'available' : 'current', availableVersion: payload.version,
        source, message: compareVersions(payload.version, this.version) > 0 ? `发现新版本 ${payload.version}` : '当前已是最新版本', notes: payload.notes, total: payload.artifact.size });
    } catch {
      return this.set({ phase: 'offline', message: this.controller.signal.aborted ? '已取消检查，可启动当前版本。' : '暂时无法检查更新，可启动当前版本或稍后重试。' });
    }
  }
  versionDirectory(version) { compareVersions(version, '0.0.0'); return path.join(this.directory, 'versions', version); }
  async verified(envelope) {
    const payload = verifyManifest(envelope, this.publicKey);
    const file = path.join(this.versionDirectory(payload.version), payload.artifact.name);
    if ((await fs.stat(file)).size !== payload.artifact.size || await hashFile(file) !== payload.artifact.sha256) throw Error('更新包校验失败，当前版本保持可用。');
    return { payload, file, envelope };
  }
  async active() {
    try {
      const envelope = JSON.parse(await fs.readFile(path.join(this.directory, 'active.json'), 'utf8'));
      if (compareVersions(envelope.payload.version, this.version) <= 0) return null;
      return await this.verified(envelope);
    } catch { return null; }
  }
  async confirm() {
    try {
      const envelope = JSON.parse(await fs.readFile(path.join(this.versionDirectory(this.version), 'manifest.json'), 'utf8'));
      await this.verified(envelope);
      await writeJSON(path.join(this.directory, 'active.json'), envelope);
    } catch { /* A bundled version has no downloaded manifest. */ }
  }
  async download() {
    if (this.state.phase !== 'available' || !this.candidate) return this.state;
    this.controller = new AbortController();
    const version = this.candidate.payload.version;
    const dir = this.versionDirectory(version), temp = path.join(dir, crypto.randomUUID() + '.part');
    const attempt = async candidate => {
      this.set({ phase: 'downloading', source: candidate.source, received: 0, total: candidate.payload.artifact.size, message: '正在下载更新…' });
      await this.transport(candidate.base + candidate.payload.artifact.name, {
        destination: temp, timeout: 15 * 60 * 1000, idleTimeout: 12000, maxBytes: candidate.payload.artifact.size,
        signal: this.controller.signal, ca: candidate.ca,
        onProgress: received => this.set({ received })
      });
      this.set({ phase: 'verifying', message: '正在校验更新文件…' });
      const a = candidate.payload.artifact;
      if ((await fs.stat(temp)).size !== a.size || await hashFile(temp) !== a.sha256) throw Error('下载文件校验失败。');
      return candidate;
    };
    try {
      await fs.mkdir(dir, { recursive: true });
      let candidate;
      try { candidate = await attempt(this.candidate); }
      catch (error) {
        await fs.rm(temp, { force: true });
        if (this.controller.signal.aborted || this.candidate.source !== 'GitHub Release') throw error;
        this.set({ message: '主下载源下载失败，正在切换备用源…' });
        const mirror = await this.fallback(version);
        if (mirror.payload.artifact.sha256 !== this.candidate.payload.artifact.sha256 || mirror.payload.artifact.size !== this.candidate.payload.artifact.size) throw Error('两个下载源文件不一致，请联系维护者。');
        candidate = await attempt(mirror);
      }
      await fs.rename(temp, path.join(dir, candidate.payload.artifact.name));
      await writeJSON(path.join(dir, 'manifest.json'), candidate.envelope);
      this.staged = await this.verified(candidate.envelope);
      return this.set({ phase: 'ready', message: '更新已就绪，重启登录器即可使用。', source: candidate.source });
    } catch {
      await fs.rm(temp, { force: true });
      return this.set({ phase: 'available', received: 0, message: this.controller.signal.aborted ? '下载已取消，当前版本保持可用。' : '更新失败，当前版本保持可用。请稍后重试。' });
    }
  }
}
module.exports = { Updater, hashFile, writeJSON };

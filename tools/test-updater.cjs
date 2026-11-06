'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { Updater, writeJSON } = require('../launcher/updater.cjs');
const { canonical, verifyManifest, compareVersions } = require('../launcher/manifest.cjs');
const { request, safeURL } = require('../launcher/transport.cjs');
const { loadRuntime } = require('../launcher/config.cjs');
const keys = crypto.generateKeyPairSync('ed25519');
const publicKey = keys.publicKey.export({type:'spki',format:'pem'});
const bytes = Buffer.from('MZ synthetic executable for updater verification');
function envelope(version='1.0.1', patch={}) {
  const payload = {schema:1,version,platform:'win32',arch:'x64',channel:'stable',protocol:32,publishedAt:'2026-11-06T00:00:00Z',notes:'Release notes',artifact:{name:`HefeiNight-${version}-win-x64.exe`,size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')},...patch};
  return {payload,signature:crypto.sign(null,Buffer.from(canonical(payload)),keys.privateKey).toString('base64')};
}
async function fixture(t, {githubFail=false, assetFail=false, mirrorVersion='1.0.1', corrupt=false, mirrorCorrupt=false}={}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'hefei-updater-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const requests=[];
  const transport=async(url,options={})=>{
    requests.push(url);
    if(options.signal?.aborted)throw Error('cancelled');
    if(url.includes('api.github.com')) {if(githubFail)throw Error('timed out');return {tag_name:'v1.0.1',draft:false,prerelease:false};}
    if(url.endsWith('latest.json'))return url.startsWith('https://mirror.example/')?envelope(mirrorVersion):envelope();
    if(options.destination){
      if(assetFail&&url.includes('github.com'))throw Error('asset timed out');
      const bad=(corrupt&&url.includes('github.com'))||(mirrorCorrupt&&url.startsWith('https://mirror.example/'));
      await fs.writeFile(options.destination,bad?Buffer.from('bad'):bytes,{flag:'wx'});
      options.onProgress?.(bytes.length);return;
    }
    throw Error('Unexpected request');
  };
  const updater=new Updater({version:'1.0.0',directory:dir,repository:'test/game',publicKey,transport,runtime:{fallbackBaseUrl:'https://mirror.example/'}});
  return {updater,requests,dir};
}
test('semantic version ordering and unsafe version rejection',()=>{
  assert.equal(compareVersions('1.10.0','1.9.9'),1);assert.equal(compareVersions('1.0.0','1.0.0'),0);
  for(const bad of ['../x','01.0.0','1.0.0-beta','1.0','99999999999999999.0.0'])assert.throws(()=>compareVersions(bad,'1.0.0'));
});
test('signed metadata rejects tampering, wrong key, path traversal and unknown platform',()=>{
  const valid=envelope();assert.equal(verifyManifest(valid,publicKey).version,'1.0.1');
  valid.payload.notes='tampered';assert.throws(()=>verifyManifest(valid,publicKey));
  assert.throws(()=>verifyManifest(envelope(),crypto.generateKeyPairSync('ed25519').publicKey));
  assert.throws(()=>verifyManifest(envelope('1.0.1',{artifact:{name:'../bad.exe',size:1,sha256:'a'.repeat(64)}}),publicKey));
  assert.throws(()=>verifyManifest(envelope('1.0.1',{platform:'linux'}),publicKey));
});
test('GitHub is primary; checking does not call the mirror on success',async t=>{
  const {updater,requests}=await fixture(t);await updater.check();assert.equal(updater.state.phase,'available');
  assert.equal(updater.state.source,'GitHub Release');assert(!requests.some(u=>u.includes('mirror.example')));
});
test('GitHub check timeout switches to mirror and completes a verified download',async t=>{
  const {updater,requests}=await fixture(t,{githubFail:true});await updater.check();assert.equal(updater.state.source,'备用下载源');
  await updater.download();assert.equal(updater.state.phase,'ready');assert(requests.some(u=>u.includes('/1.0.1/HefeiNight-')));
  assert.equal(await updater.active(),null,'Downloaded versions are not active before successful launch');
});
test('asset timeout switches to exact version mirror even after GitHub metadata succeeded',async t=>{
  const {updater,requests}=await fixture(t,{assetFail:true});await updater.check();await updater.download();
  assert.equal(updater.state.phase,'ready');assert.equal(updater.state.source,'备用下载源');
  assert(requests.some(u=>u==='https://mirror.example/1.0.1/latest.json'));
});
test('stale mirror refuses a different version and preserves installed version',async t=>{
  const {updater}=await fixture(t,{assetFail:true,mirrorVersion:'1.0.0'});await updater.check();await updater.download();
  assert.equal(updater.state.phase,'available');assert.equal(await updater.active(),null);
});
test('corrupt download never activates; partial files removed',async t=>{
  const {updater,dir}=await fixture(t,{corrupt:true,mirrorCorrupt:true});await updater.check();await updater.download();
  assert.equal(updater.state.phase,'available');assert.equal(await updater.active(),null);
  assert(!(await fs.readdir(path.join(dir,'versions','1.0.1'))).some(f=>f.endsWith('.part')));
});
test('signed fallback with different digest is rejected',async t=>{
  const {updater}=await fixture(t,{assetFail:true});const transport=updater.transport;
  updater.transport=async(url,options)=>url==='https://mirror.example/1.0.1/latest.json'?envelope('1.0.1',{artifact:{...envelope().payload.artifact,sha256:'a'.repeat(64)}}):transport(url,options);
  await updater.check();await updater.download();assert.equal(updater.state.phase,'available');assert.equal(await updater.active(),null);
});
test('both sources unavailable keeps offline play possible and check can retry',async t=>{
  const {updater}=await fixture(t);const original=updater.transport;
  updater.transport=async()=>{throw Error('offline');};await updater.check();assert.equal(updater.state.phase,'offline');assert.equal(updater.version,'1.0.0');
  updater.transport=original;await updater.check();assert.equal(updater.state.phase,'available');
});
test('fallback never offers automatic downgrade',async t=>{
  const {updater}=await fixture(t,{githubFail:true,mirrorVersion:'0.9.9'});await updater.check();assert.equal(updater.state.phase,'current');
  await updater.download();assert.equal(updater.state.phase,'current');
});
test('active pointer is authenticated and the file is checked again at launch',async t=>{
  const {updater,dir}=await fixture(t);await updater.check();await updater.download();
  await writeJSON(path.join(dir,'active.json'),updater.staged.envelope);assert.equal((await updater.active()).payload.version,'1.0.1');
  await fs.writeFile(updater.staged.file,'replaced');assert.equal(await updater.active(),null);
});
test('cancellation does not trigger mirror traffic and concurrent checks are ignored',async t=>{
  const {updater,requests}=await fixture(t);
  updater.transport=async(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true}));
  const checking=updater.check();await updater.check();updater.cancel();await checking;
  assert.equal(updater.state.phase,'offline');assert.equal(requests.length,0);
});
test('HTTP is restricted to loopback; credentials and insecure redirects are rejected',()=>{
  assert.equal(safeURL('http://127.0.0.1:1234/x').protocol,'http:');
  for(const bad of ['http://example.com','https://user:pass@example.com/','file:///x'])assert.throws(()=>safeURL(bad));
});
test('private sidecar survives updating the executable and environment config takes priority',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'hefei-config-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const userData=path.join(dir,'user'),portableDirectory=path.join(dir,'portable'),appPath=path.join(dir,'app');
  await fs.mkdir(portableDirectory);const sidecar=path.join(portableDirectory,'hefei-runtime.json');
  await fs.writeFile(sidecar,JSON.stringify({fallbackBaseUrl:'https://mirror.example/'}));
  const options={userData,portableDirectory,appPath};
  const prior=process.env.HEFEI_RUNTIME_CONFIG;delete process.env.HEFEI_RUNTIME_CONFIG;
  try {
    assert.equal((await loadRuntime(options)).fallbackBaseUrl,'https://mirror.example/');
    await fs.rm(sidecar);assert.equal((await loadRuntime(options)).fallbackBaseUrl,'https://mirror.example/');
    const override=path.join(dir,'config.json');await fs.writeFile(override,JSON.stringify({fallbackBaseUrl:'https://override.example/'}));
    process.env.HEFEI_RUNTIME_CONFIG=override;assert.equal((await loadRuntime(options)).fallbackBaseUrl,'https://override.example/');
  } finally {if(prior===undefined)delete process.env.HEFEI_RUNTIME_CONFIG;else process.env.HEFEI_RUNTIME_CONFIG=prior;}
});
test('real streaming download handles redirects, bounds, timeout and cancellation',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'hefei-transport-'));
  const server=http.createServer((req,res)=>{
    if(req.url==='/redirect'){res.writeHead(302,{Location:'/asset'});res.end();}
    else if(req.url==='/insecure'){res.writeHead(302,{Location:'http://example.com/file'});res.end();}
    else if(req.url==='/hang'){/* Aborted by the client. */}
    else if(req.url==='/json'){res.end(JSON.stringify({ok:true}));}
    else {res.setHeader('Content-Length',bytes.length);res.end(bytes);}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`,dest=path.join(dir,'asset.exe');
  await request(base+'/redirect',{destination:dest,maxBytes:bytes.length});assert.deepEqual(await fs.readFile(dest),bytes);
  assert.deepEqual(await request(base+'/json'),{ok:true});
  await assert.rejects(request(base+'/asset',{maxBytes:2}));
  await assert.rejects(request(base+'/insecure'));
  await assert.rejects(request(base+'/hang',{timeout:50}));
  const controller=new AbortController();const task=request(base+'/hang',{signal:controller.signal});controller.abort();await assert.rejects(task);
});

const { app, BrowserWindow, Menu, protocol, session, ipcMain, dialog, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { Updater, writeJSON } = require('./launcher/updater.cjs');
const { loadRuntime } = require('./launcher/config.cjs');
const releaseConfig = require('./release.config.json');
let runtime = {}, updater, launcherWindow, gameStarting = false;
const {connectSignaling}=require('./signaling.cjs');
const signalClients=new Map();
ipcMain.handle('signal-connect',async(event,options={})=>{
 const sender=event.sender,previous=signalClients.get(sender);previous?.client?.close();const entry={client:null};signalClients.set(sender,entry);
 try{if(sender.getURL().split('/')[2]!=='game')throw Error('无效的联机请求。');const client=await connectSignaling({...runtime.signaling,create:options.create===true,code:String(options.code||'')},message=>{if(!sender.isDestroyed()&&signalClients.get(sender)===entry)sender.send('signal-event',message);});if(signalClients.get(sender)!==entry||sender.isDestroyed()){client.close();return {ok:false,message:'已取消联机。'};}entry.client=client;sender.once('destroyed',()=>{client.close();if(signalClients.get(sender)===entry)signalClients.delete(sender);});return {ok:true,id:client.id,code:client.code,hostId:client.hostId};}catch(e){if(signalClients.get(sender)===entry)signalClients.delete(sender);return {ok:false,message:e.message};}
});
ipcMain.handle('signal-close',async event=>{const entry=signalClients.get(event.sender);signalClients.delete(event.sender);entry?.client?.close();});
ipcMain.on('signal-send',(event,message)=>signalClients.get(event.sender)?.client?.send(message));
ipcMain.handle('net-leave',async()=>{});
ipcMain.handle('net-connect',async()=>({ok:false,message:'当前为纯 P2P 版，请交换邀请和回应信息；游戏服务器已停用。'}));
ipcMain.on('net-send',()=>{});

protocol.registerSchemesAsPrivileged([
  { scheme: 'hefei', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);
const testFolderArg = process.argv.find(arg => arg.startsWith('--smoke-output='));
const testFolder = testFolderArg ? path.resolve(testFolderArg.slice('--smoke-output='.length)) : null;
const nativePointerTest=process.argv.includes('--native-pointer-test');
const portraitArg=process.argv.find(arg=>arg.startsWith('--export-portraits='));
const portraitFolder=portraitArg?path.resolve(portraitArg.slice('--export-portraits='.length)):null;
const serverMode=process.argv.includes('--room-server');
const launcherSmokeMode=process.argv.some(arg=>arg.startsWith('--launcher-smoke='));
if (launcherSmokeMode) app.disableHardwareAcceleration();
if (testFolder) app.commandLine.appendSwitch('disable-background-timer-throttling');
let mainWindow;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function smokeTest(win){const result=await require('./tools/restoration-smoke.cjs').run(win,testFolder,app);app.exit(result.passed?0:1);}

function registerResources() {
const types = {'.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.glb':'model/gltf-binary', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ogg':'audio/ogg', '.oga':'audio/ogg'};
  protocol.handle('hefei', async request => {
    try {
      const url = new URL(request.url);
      const folder = {game:'dist', launcher:'launcher'}[url.hostname];
      if (!folder) return new Response('Forbidden', {status:403});
      const root = path.join(app.getAppPath(), folder);
      const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const target = path.resolve(root, '.' + relative);
      if (!target.startsWith(root + path.sep) || request.method !== 'GET' || (folder==='launcher'&&!['index.html','style.css','renderer.js'].includes(path.relative(root,target)))) return new Response('Forbidden', {status:403});
      const body = await fs.readFile(target);
      return new Response(body, {headers:{'Content-Type': types[path.extname(target)] || 'application/octet-stream'}});
    } catch { return new Response('Not found', {status:404}); }
  });
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({cancel: !/^(hefei:|data:|blob:|devtools:)/.test(details.url)});
  });
  Menu.setApplicationMenu(null);
}
async function openGame() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1000, minHeight: 700,
    title: '合肥惊魂夜', backgroundColor: '#0b141a', show: false,
    webPreferences: {preload:path.join(__dirname,'preload.cjs'),nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false, offscreen: (!!testFolder&&!nativePointerTest)||!!portraitFolder||launcherSmokeMode}
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  mainWindow.webContents.on('will-navigate', (event, url) => { if (!url.startsWith('hefei://game/')) event.preventDefault(); });
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') { event.preventDefault(); mainWindow.setFullScreen(!mainWindow.isFullScreen()); }
  });
  mainWindow.once('ready-to-show', () => { if ((!testFolder&&!portraitFolder&&!launcherSmokeMode)||nativePointerTest){mainWindow.show();mainWindow.focus();} });
  await mainWindow.loadURL('hefei://game/index.html'+(portraitFolder?'?export-portraits=1':testFolder?'?network-test=1':''));
  if(portraitFolder){
    await fs.mkdir(portraitFolder,{recursive:true});
    for(const [index,name] of ['baige','2980','zhulian','songyuying','longleg','obiwan','olo','ai-jiahao'].entries()){
      const data=await mainWindow.webContents.executeJavaScript(`import(document.querySelector('script[type="module"][src]').src).then(game=>game.renderCharacterPortrait(${index}))`);
      await fs.writeFile(path.join(portraitFolder,name+'.png'),Buffer.from(data.split(',')[1],'base64'));
    }
    app.exit(0);return;
  }
  if (testFolder) await smokeTest(mainWindow);
}

function fromLauncher(event) {
  if (!launcherWindow || event.sender !== launcherWindow.webContents || event.senderFrame !== event.sender.mainFrame || event.sender.getURL() !== 'hefei://launcher/index.html') throw Error('无效的登录器请求。');
}
async function handoff(candidate) {
  if (!app.isPackaged) throw Error('源码模式不能切换 EXE，请使用打包版本验证更新安装。');
  await updater.verified(candidate.envelope);
  const token = randomUUID(), marker = path.join(updater.directory, 'ready-' + token + '.json');
  const env = { ...process.env };
  for (const key of ['PORTABLE_EXECUTABLE_DIR','PORTABLE_EXECUTABLE_FILE','PORTABLE_EXECUTABLE_APP_FILENAME','ELECTRON_RUN_AS_NODE']) delete env[key];
  app.releaseSingleInstanceLock();
  try {
    const child = spawn(candidate.file, ['--hefei-activation=' + token], { detached: true, stdio: 'ignore', windowsHide: true, env });
    let failure;
    child.on('error', error => { failure = error; });
    child.unref();
    const until = Date.now() + 60000;
    while (Date.now() < until) {
      if (failure) throw failure;
      try { const ready = JSON.parse(await fs.readFile(marker, 'utf8')); if (ready.version === candidate.payload.version) { await fs.rm(marker, { force: true }); app.quit(); return; } } catch {}
      await sleep(150);
    }
    throw Error('新版本未能正常启动。可继续使用当前版本，或重新打开登录器。');
  } catch (error) { app.requestSingleInstanceLock(); throw error; }
}

ipcMain.handle('launcher-state', event => { fromLauncher(event); return updater.state; });
ipcMain.handle('launcher-check', event => { fromLauncher(event); return updater.check(); });
ipcMain.handle('launcher-download', event => { fromLauncher(event); return updater.download(); });
ipcMain.handle('launcher-cancel', event => { fromLauncher(event); updater.cancel(); });
ipcMain.handle('launcher-apply', async event => {
  fromLauncher(event);
  if (updater.state.phase !== 'ready' || !updater.staged) return;
  updater.set({phase:'restarting', message:'正在启动新版本…'});
  try { await handoff(updater.staged); } catch { updater.set({phase:'ready',message:'新版本未能启动，请重试；当前版本仍可使用。'}); }
});
ipcMain.handle('launcher-play', async event => {
  fromLauncher(event);
  if (gameStarting || ['downloading','verifying','restarting'].includes(updater.state.phase)) return;
  gameStarting = true; updater.cancel();
  try { await openGame(); launcherWindow?.destroy(); } catch { gameStarting = false; updater.set({message:'游戏启动失败，请关闭登录器后重试。'}); }
});
ipcMain.handle('launcher-help', async event => { fromLauncher(event); await shell.openExternal(`https://github.com/${releaseConfig.repository}/blob/main/docs/PLAYER-GUIDE.md`); });

app.whenReady().then(async () => {
  if (serverMode) { app.quit(); return; }
  const launcherSmoke = process.argv.find(arg => arg.startsWith('--launcher-smoke='));
  const testing = !!testFolder || !!portraitFolder || !!launcherSmoke;
  if (testing) app.setPath('userData', path.join(app.getPath('temp'), 'hefei-night-test-' + process.pid));
  if (!app.requestSingleInstanceLock()) { app.quit(); return; }
  app.on('second-instance', () => { const win = mainWindow || launcherWindow; if(win){if(win.isMinimized())win.restore();win.show();win.focus();} });
  runtime = await loadRuntime({ userData:app.getPath('userData'), portableDirectory:process.env.PORTABLE_EXECUTABLE_DIR, appPath:app.getAppPath() });
  updater = new Updater({version:app.getVersion(), directory:path.join(app.getPath('userData'),'updates'), ...releaseConfig, runtime,
    onState: state => { if (launcherWindow && !launcherWindow.isDestroyed()) launcherWindow.webContents.send('launcher-update',state); }});
  if (!testing && app.isPackaged && !process.argv.some(arg => arg.startsWith('--hefei-activation='))) {
    const active = await updater.active();
    if (active) { try { await handoff(active); return; } catch { /* Keep bundled version available. */ } }
  }
  registerResources();
  if (testFolder || portraitFolder || process.argv.includes('--game')) { await openGame(); return; }
  launcherWindow = new BrowserWindow({width:1080,height:740,minWidth:800,minHeight:620,show:false,title:'合肥惊魂夜 · 登录器',backgroundColor:'#122a33',
    webPreferences:{preload:path.join(__dirname,'launcher','preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,offscreen:!!launcherSmoke}});
  launcherWindow.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  launcherWindow.webContents.on('will-navigate',(event,url)=>{if(url!=='hefei://launcher/index.html')event.preventDefault();});
  launcherWindow.once('ready-to-show',()=>{if(!launcherSmoke)launcherWindow.show();});
  await launcherWindow.loadURL('hefei://launcher/index.html');
  if (launcherSmoke) { await require('./tools/test-launcher-ui.cjs').run(launcherWindow, path.resolve(launcherSmoke.split('=').slice(1).join('=')), app); return; }
  await updater.confirm();
  const activation = process.argv.find(arg=>arg.startsWith('--hefei-activation='))?.split('=')[1];
  if (activation && /^[a-f0-9-]{36}$/.test(activation)) await writeJSON(path.join(updater.directory,'ready-'+activation+'.json'),{version:app.getVersion()});
  void updater.check();
}).catch(error=>{dialog.showErrorBox('无法启动合肥惊魂夜',error.message);app.exit(1);});
app.on('window-all-closed', () => app.quit());
app.on('before-quit',()=>{updater?.cancel();for(const entry of signalClients.values())entry.client?.close();signalClients.clear();});


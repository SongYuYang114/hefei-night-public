const { app, BrowserWindow, Menu, protocol, session, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const {connectSignaling}=require('./signaling.cjs');
const signalClients=new Map();
ipcMain.handle('signal-connect',async(event,options={})=>{
 const sender=event.sender,previous=signalClients.get(sender);previous?.client?.close();const entry={client:null};signalClients.set(sender,entry);
 try{const client=await connectSignaling({create:options.create===true,code:String(options.code||'')},message=>{if(!sender.isDestroyed()&&signalClients.get(sender)===entry)sender.send('signal-event',message);});if(signalClients.get(sender)!==entry||sender.isDestroyed()){client.close();return {ok:false,message:'已取消联机。'};}entry.client=client;sender.once('destroyed',()=>{client.close();if(signalClients.get(sender)===entry)signalClients.delete(sender);});return {ok:true,id:client.id,code:client.code,hostId:client.hostId};}catch(e){if(signalClients.get(sender)===entry)signalClients.delete(sender);return {ok:false,message:e.message};}
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
if (testFolder) app.commandLine.appendSwitch('disable-background-timer-throttling');
let mainWindow;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function smokeTest(win){const result=await require('./tools/restoration-smoke.cjs').run(win,testFolder,app);app.exit(result.passed?0:1);}

app.whenReady().then(async () => {
  if(serverMode){app.quit();return;}
  const root = path.join(app.getAppPath(), 'dist');
const types = {'.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.glb':'model/gltf-binary', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ogg':'audio/ogg', '.oga':'audio/ogg'};
  protocol.handle('hefei', async request => {
    try {
      const url = new URL(request.url);
      const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const target = path.resolve(root, '.' + relative);
      if (url.hostname !== 'game' || !target.startsWith(root + path.sep) || request.method !== 'GET') return new Response('Forbidden', {status:403});
      const body = await fs.readFile(target);
      return new Response(body, {headers:{'Content-Type': types[path.extname(target)] || 'application/octet-stream'}});
    } catch { return new Response('Not found', {status:404}); }
  });
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({cancel: !/^(hefei:|data:|blob:|devtools:)/.test(details.url)});
  });
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1000, minHeight: 700,
    title: '合肥惊魂夜', backgroundColor: '#0b141a', show: false,
    webPreferences: {preload:path.join(__dirname,'preload.cjs'),nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false, offscreen: (!!testFolder&&!nativePointerTest)||!!portraitFolder}
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  mainWindow.webContents.on('will-navigate', (event, url) => { if (!url.startsWith('hefei://game/')) event.preventDefault(); });
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') { event.preventDefault(); mainWindow.setFullScreen(!mainWindow.isFullScreen()); }
  });
  mainWindow.once('ready-to-show', () => { if ((!testFolder&&!portraitFolder)||nativePointerTest){mainWindow.show();mainWindow.focus();} });
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
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit',()=>{for(const entry of signalClients.values())entry.client?.close();signalClients.clear();});


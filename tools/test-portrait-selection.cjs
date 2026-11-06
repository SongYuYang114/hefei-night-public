const {app,BrowserWindow,protocol,session}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'../olo-selection'));
require('node:fs').mkdirSync(path.join(out,'profile'),{recursive:true});app.setPath('userData',path.join(out,'profile'));
protocol.registerSchemesAsPrivileged([{scheme:'hefei',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
app.whenReady().then(async()=>{
 let win,result;const errors=[];
 try{
  await fs.mkdir(out,{recursive:true});
  session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:!/^(hefei:|data:|blob:|devtools:)/.test(d.url)}));
  protocol.handle('hefei',async req=>{
   const target=path.resolve(root,'dist','.'+new URL(req.url).pathname),mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json','.glb':'model/gltf-binary'};
   try{return new Response(await fs.readFile(target),{headers:{'Content-Type':mime[path.extname(target)]||'application/octet-stream'}});}catch{return new Response('',{status:404});}
  });
  win=new BrowserWindow({width:1440,height:900,show:false,webPreferences:{preload:path.join(root,'preload.cjs'),offscreen:true,backgroundThrottling:false,contextIsolation:true,sandbox:true,nodeIntegration:false}});
  win.webContents.on('console-message',e=>{if(e.level==='error')errors.push(e.message);});
  await win.loadURL('hefei://game/index.html?network-test=1');
  const deadline=Date.now()+60000;
  while(!await win.webContents.executeJavaScript("!document.querySelector('#start').disabled")){if(Date.now()>deadline)throw Error('Models failed to load');await new Promise(r=>setTimeout(r,60));}
  result={passed:true,version:require('../package.json').version,...await require('./portrait-smoke.cjs').run(win,out),errors};
  if(errors.length)throw Error(errors.join('\n'));
 }catch(e){result={passed:false,error:e.stack,errors};if(win)await fs.writeFile(path.join(out,'failure.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());}
 await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));win?.destroy();app.exit(result.passed?0:1);
});

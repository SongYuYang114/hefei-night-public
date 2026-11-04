const {app,BrowserWindow,protocol}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||'../direct-handshake'),delay=Number(process.argv[3]||45000),windows=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
protocol.registerSchemesAsPrivileged([{scheme:'hefei',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
app.whenReady().then(async()=>{
 let result;const errors=[],timeline=[];
 const js=(w,s)=>w.webContents.executeJavaScript(s,true),inspect=w=>js(w,`({stats:p2p.stats(),connections:[...p2p.peers.values()].map(p=>({state:p.pc.connectionState,ice:p.pc.iceConnectionState,gathering:p.pc.iceGatheringState,local:(p.pc.localDescription?.sdp||'').split('\\r\\n').filter(s=>s.startsWith('a=candidate:')),remote:(p.pc.remoteDescription?.sdp||'').split('\\r\\n').filter(s=>s.startsWith('a=candidate:'))})),events})`);
 try{
  await fs.mkdir(out,{recursive:true});
  protocol.handle('hefei',async req=>{const url=new URL(req.url);if(url.pathname==='/probe.html')return new Response('<script type="module">import {DirectRoom} from "./direct-room.mjs";window.events=[];window.p2p=new DirectRoom({deliver:m=>events.push(m)});window.ready=true;</script>',{headers:{'Content-Type':'text/html'}});return new Response(await fs.readFile(path.join(root,'dist',url.pathname.slice(1))),{headers:{'Content-Type':'text/javascript'}});});
  for(let i=0;i<2;i++){const w=new BrowserWindow({show:false,webPreferences:{offscreen:true,backgroundThrottling:false,nodeIntegration:false,contextIsolation:true,sandbox:true}});windows.push(w);w.webContents.on('console-message',(_e,d)=>{if(d.level==='error')errors.push(d.message);});await w.loadURL('hefei://game/probe.html');while(!await js(w,'window.ready===true'))await sleep(50);}
  const [h,g]=windows;await js(h,"p2p.createHost({slot:4,name:'房主'})");const invite=await js(h,'p2p.createInvitation()');
  const answer=await js(g,`p2p.joinInvitation(${JSON.stringify(invite)},{slot:0,character:0,name:'客人'})`);
  timeline.push({stage:'answer-generated',host:await inspect(h),guest:await inspect(g)});
  await sleep(delay);timeline.push({stage:'before-delayed-import',host:await inspect(h),guest:await inspect(g)});
  await js(h,`p2p.importResponse(${JSON.stringify(answer.answer)})`);
  const end=Date.now()+30000;while(Date.now()<end){if(await js(g,'p2p.stats().direct===1&&p2p.admitted')&&await js(h,'p2p.stats().direct===1'))break;await sleep(200);}
  timeline.push({stage:'after-delayed-import',host:await inspect(h),guest:await inspect(g)});
  assert.equal(await js(g,'p2p.stats().direct'),1);assert.equal(await js(h,'p2p.stats().direct'),1);
  result={passed:true,delayMs:delay,timeline,errors};
 }catch(e){result={passed:false,error:e.stack,delayMs:delay,timeline,errors};}
 await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));for(const w of windows){try{await js(w,'p2p.close()');}catch{}w.destroy();}app.exit(result.passed?0:1);
});

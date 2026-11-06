const {app,BrowserWindow,protocol,ipcMain,session}=require('electron'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {createSignalingServer,connectSignaling}=require('../signaling.cjs');const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||'../olo-p2p'),windows=[],clients=new Map();let setupServer;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
require('node:fs').mkdirSync(path.join(out,'profile'),{recursive:true});app.setPath('userData',path.join(out,'profile'));
protocol.registerSchemesAsPrivileged([{scheme:'hefei',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
ipcMain.handle('signal-connect',async(e,options)=>{try{const c=await connectSignaling({...options},m=>{if(!e.sender.isDestroyed())e.sender.send('signal-event',m);});clients.set(e.sender,c);return {ok:true,id:c.id,hostId:c.hostId,code:c.code};}catch(error){return {ok:false,message:error.message};}});ipcMain.on('signal-send',(e,m)=>clients.get(e.sender)?.send(m));ipcMain.handle('signal-close',e=>{clients.get(e.sender)?.close();clients.delete(e.sender);});
app.whenReady().then(async()=>{let result;const errors=[],until=async(fn,label,sec=20)=>{const end=Date.now()+sec*1000;await fs.writeFile(path.join(out,'phase.txt'),label);while(Date.now()<end){if(await fn())return;await sleep(40);}throw Error('Timeout: '+label);};
 try{await fs.mkdir(out,{recursive:true});session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:!/^(hefei:|data:|blob:|devtools:)/.test(d.url)}));
 protocol.handle('hefei',async req=>{const file=path.resolve(root,'dist','.'+new URL(req.url).pathname),mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.glb':'model/gltf-binary','.ogg':'audio/ogg','.oga':'audio/ogg'};try{return new Response(await fs.readFile(file),{headers:{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}});}catch{return new Response('',{status:404});}});
 const create=async()=>{const w=new BrowserWindow({width:1280,height:900,show:false,webPreferences:{preload:path.join(root,'preload.cjs'),offscreen:true,backgroundThrottling:false,contextIsolation:true,sandbox:true,nodeIntegration:false}});windows.push(w);w.webContents.on('console-message',(event,...legacy)=>{if(event.level==='error'||legacy[0]===3)errors.push(event.message||legacy[1]);});await w.loadURL('hefei://game/index.html?network-test=1');await until(()=>w.webContents.executeJavaScript("!document.querySelector('#start').disabled"),'models',60);await w.webContents.executeJavaScript(`(()=>{let t=null;Object.defineProperty(document,'pointerLockElement',{get:()=>t,configurable:true});HTMLCanvasElement.prototype.requestPointerLock=function(){t=this;queueMicrotask(()=>document.dispatchEvent(new Event('pointerlockchange')));return Promise.resolve();};document.exitPointerLock=()=>{t=null;queueMicrotask(()=>document.dispatchEvent(new Event('pointerlockchange')));};})()`);return w;};
 const host=await create(),guest=await create(),hj=s=>host.webContents.executeJavaScript(s,true),gj=s=>guest.webContents.executeJavaScript(s,true),inspect="(()=>{const e=document.querySelector('#error');if(e&&!e.classList.contains('hidden'))throw Error(document.querySelector('#error-message').textContent);return import(document.querySelector('script[type=module][src]').src).then(m=>m.networkTestState());})()",hs=()=>hj(inspect),gs=()=>gj(inspect),set=o=>hj(`import(document.querySelector('script[type=module][src]').src).then(m=>m.networkTestConfigure(${JSON.stringify(o)}))`),tap=(w,k)=>{w.webContents.sendInputEvent({type:'keyDown',keyCode:k});w.webContents.sendInputEvent({type:'keyUp',keyCode:k});},shot=async(w,name,delay=180)=>{await sleep(delay);await fs.writeFile(path.join(out,name+'.png'),(await w.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());};

 await hj("document.querySelector('#hunter-role').click();document.querySelector('.character-card[data-character=\"7\"]').click()");
 await gj("document.querySelector('.character-card[data-character=\"6\"]').click()");
 await hj("document.querySelector('#net-open').click();document.querySelector('#net-create').click()");
 await until(()=>hj("/^[0-9]{6}$/.test(document.querySelector('#room-code').textContent)"),'public room number');
 const code=await hj("document.querySelector('#room-code').textContent");
 await gj(`document.querySelector('#net-open').click();document.querySelector('#net-code').value='${code}';document.querySelector('#net-join').click()`);
 await until(()=>gj("!document.querySelector('#net-ready').disabled&&!document.querySelector('#net-room').classList.contains('hidden')"),'P2P join',50);
 assert(await hj("!!document.querySelector('.selection-player[data-character=\"6\"]')"));await shot(guest,'Olo-public-room-selection');
 await gj("document.querySelector('#net-ready').click()");await until(()=>hj("!document.querySelector('#net-start').disabled"),'ready');await hj("document.querySelector('#net-start').click()");
 await until(async()=>(await gs()).mode==='playing','start');const slot=(await gs()).slot;assert.equal(slot,3);
 const freeze={freezeAI:true,clearCats:true,clearPigs:true,clearMailisu:true,clearEchoes:true,stopCar:true,kuchi:{phase:'stunned',phaseTime:300},hunter:{x:0,z:12,angle:0,stun:0,attack:0,cooldown:0,swing:0,hitDelay:0},survivors:Object.fromEntries([0,1,2,3].map(i=>[i,{x:i===slot?0:30,z:i===slot?14:26+i,hp:2,state:'active',stun:i===slot?0:300,invincible:0,item:null}]))};
 await set(freeze);await until(async()=>(await gs()).survivors[slot].characterId===6,'remote character identity');
 host.webContents.sendInputEvent({type:'mouseDown',x:640,y:450,button:'left',clickCount:1});host.webContents.sendInputEvent({type:'mouseUp',x:640,y:450,button:'left',clickCount:1});
 await until(async()=>(await hs()).hunter.swing>0,'actual elbow');await sleep(1000);assert.equal((await hs()).survivors[slot].hp,2);assert.equal((await gs()).survivors[slot].hp,2);
 await set({...freeze,hunter:{...freeze.hunter,x:0,z:8},survivors:{...freeze.survivors,0:{x:0,z:18,hp:2,invincible:0,stun:300}}});tap(host,'Q');
 await until(async()=>(await hs()).hunter.driving,'actual car starts');await until(async()=>(await gs()).survivors[0].hp===1,'car still damages ordinary survivor');
 assert.equal((await gs()).survivors[slot].hp,2);await shot(guest,'Olo-immune-to-car');
 await set({...freeze,hunter:{...freeze.hunter,hunterCharacter:1,x:0,z:14},survivors:{...freeze.survivors,[slot]:{x:0,z:18,hp:2,stun:0,invincible:0},0:{x:0,z:22,hp:2,stun:300,invincible:0}},camera:{yaw:Math.PI,pitch:.35,distance:6}});
 tap(host,'Q');await until(async()=>(await hs()).hunter.vrTime>0,'VR form');tap(host,'Q');await until(async()=>(await gs()).survivors[0].hp===1,'laser still damages ordinary survivor');assert.equal((await gs()).survivors[slot].hp,2);await shot(host,'Olo-immune-to-laser');
 await set({hunter:{vrTime:.01,x:32,z:-32,stun:300,attack:300},survivors:{[slot]:{x:0,z:-12}},gens:[0,0,0,0,0,0,0]});
 guest.webContents.sendInputEvent({type:'keyDown',keyCode:'F'});await sleep(900);guest.webContents.sendInputEvent({type:'keyUp',keyCode:'F'});assert((await hs()).gens.every(p=>p===0));
 await set({survivors:{[slot]:{x:0,z:14}}});await until(async()=>Math.abs((await gs()).survivors[slot].z-14)<.01,'movement scene shared');
 const before=(await hs()).survivors[slot];guest.webContents.sendInputEvent({type:'keyDown',keyCode:'S'});
 try{await until(async()=>{const a=(await hs()).survivors[slot];return Math.hypot(a.x-before.x,a.z-before.z)>.4;},'remote Olo moves');}finally{guest.webContents.sendInputEvent({type:'keyUp',keyCode:'S'});}
 tap(guest,'Space');await until(async()=>(await hs()).survivors[slot].jumpTime>0,'remote Olo jumps');await sleep(900);
 await set({survivors:{[slot]:{x:0,z:14}},placeMine:{x:0,z:14,arm:0},mailisu:[{x:0,z:14}],spawnPig:{ownerSlot:2,x:0,z:12,phase:'hunting',throwTime:0,angle:0}});
 await until(async()=>(await hs()).pigs.length===0,'pig explosion');let state=await gs();assert.equal(state.survivors[slot].hp,2);assert.equal(state.survivors[slot].stun,0);assert.equal(state.survivors[slot].kuchiSlow,0);assert.equal(state.survivors[slot].launchTime,0);assert.equal((await hs()).mines.length,1);assert.equal((await hs()).mailisu.length,1);assert.equal(state.mines.length,0);assert.equal(state.mailisu.length,0);
 await set({cats:[{id:5,legendary:true,x:0,z:12,cooldown:100,target:{x:0,z:12}}]});await until(async()=>(await gs()).catVisuals[0]?.clip==='Scratch','remote sees scratch');await sleep(1600);assert.equal((await gs()).survivors[slot].hp,2);
 await shot(guest,'Olo-P2P-passive');
 await set({clearCats:true,captureSlots:[0]});state=await hs();await set({survivors:{[slot]:{x:state.survivors[0].x+1.5,z:state.survivors[0].z}}});
 guest.webContents.sendInputEvent({type:'keyDown',keyCode:'F'});await sleep(850);guest.webContents.sendInputEvent({type:'keyUp',keyCode:'F'});assert.equal((await hs()).survivors[0].state,'captured');assert.equal((await hs()).survivors[0].rescue,0);
 await set({survivors:{[slot]:{x:3,z:-13,item:'exhaust',itemQ:null}},chests:{4:{opened:false,progress:.99,loot:'yzm'}}});
 guest.webContents.sendInputEvent({type:'keyDown',keyCode:'F'});try{await until(async()=>(await gs()).survivors[slot].itemQ==='yzm','guest opens chest into Q');}finally{guest.webContents.sendInputEvent({type:'keyUp',keyCode:'F'});}
 assert.equal((await gs()).survivors[slot].item,'exhaust');assert(Math.abs((await gs()).renderActors[slot].opacity-1)<.001);assert(Math.abs((await hs()).renderActors[slot].opacity-1)<.001);
 await set({survivors:{[slot]:{x:0,z:14},0:{x:0,z:16}}});await until(async()=>(await gs()).survivors[slot].z>13,'rescue position shared');tap(guest,'Q');
 await until(async()=>[await hs(),await gs()].every(s=>s.survivors[0].state==='active'&&s.survivors[slot].itemQ===null&&s.survivors[slot].item==='exhaust'),'remote Q yzm instantly rescues on both peers');await shot(guest,'Olo-Q-yzm-quick-rescue');
 for(const legendary of [false,true]){
  await set({cats:[{id:legendary?5:0,legendary,x:0,z:16,phase:'grooming',phaseTime:10,cooldown:100}],survivors:{[slot]:{x:0,z:14,kickTime:0}}});
  await until(async()=>(await gs()).cats[0]?.legendary===legendary,'new cat shared');tap(guest,'F');
  await until(async()=>(await hs()).cats[0]?.phase==='kicked'&&(await gs()).catVisuals[0]?.y>1.2,'remote F launches cat on both peers');const hostCat=(await hs()).cats[0],guestCat=(await gs()).cats[0];for(const k of ['kickDuration','kickHeight','kickPower','kickSerial'])assert.equal(guestCat[k],hostCat[k]);await shot(guest,legendary?'Olo-remote-kicks-orange-cat':'Olo-remote-kicks-hakimi',0);
  await until(async()=>{const s=await gs();return s.cats[0]?.phase!=='kicked'&&s.catVisuals[0]?.rotationX===0;},'cat landing shared');
 }
 await set({cats:[{id:0,x:-1.8,z:14,cooldown:0,target:{x:-1.8,z:14}},{id:1,x:1.8,z:14,cooldown:0,target:{x:1.8,z:14}}],survivors:{[slot]:{x:0,z:12.5,kickTime:0}}});
 await until(async()=>(await gs()).catFightVisuals[0]?.cloud,'fight cloud',15);tap(guest,'F');await until(async()=>(await gs()).cats.some(c=>c.phase==='kicked')&&(await gs()).catFights.length===0,'kick breaks fight on both peers');assert.equal((await hs()).catFights.length,0);
 await set({clearCats:true,survivors:{[slot]:{x:0,z:14,kickTime:0,item:'exhaust',itemQ:'exhaust',kuchiKicks:0,dogRewards:[]}}});
 for(let n=1;n<=3;n++){
  await set({kuchi:{x:0,z:16,phase:'squatting',phaseTime:3,path:[],moving:false,target:null},survivors:{[slot]:{kickTime:0}}});
  await until(async()=>(await gs()).kuchi.phase==='squatting','dog squats on guest');tap(guest,'F');
  await until(async()=>(await hs()).survivors[slot].kuchiKicks===n&&(await gs()).survivors[slot].kuchiKicks===n,'dog kick count shared '+n);
 }
 assert.equal((await gs()).survivors[slot].item,'exhaust');assert.equal((await gs()).survivors[slot].dogRewards.length,1);
 tap(guest,'E');await until(async()=>{const a=(await gs()).survivors[slot];return a.item&&!['egg','hotpot'].includes(a.item)&&!a.dogRewards.length;},'queued filtered reward shared');
 await set({survivors:{[slot]:{x:0,z:-9}},gens:[0,0,0,1,0,0,0]});
 await gj("import(document.querySelector('script[type=module][src]').src).then(m=>m.networkTestConfigure({camera:{yaw:0,pitch:.22,distance:8}}))");
 await until(async()=>[await hs(),await gs()].every(s=>s.generatorProjections[3].visible&&s.generatorProjections[3].textureReady&&s.generatorProjections.filter(p=>p.visible).length===1),'photo projections on both peers');
 await shot(guest,'Generator-photo-P2P');
 await set({clearCats:true,captureSlots:[0,1,2]});await until(async()=>(await gs()).mode==='result','capture victory synchronized');assert.equal((await gs()).survivors[slot].state,'active');assert(!errors.length,errors.join('\n'));
 result={passed:true,version:require('../package.json').version,protocol:36,publicSixDigitSignaling:true,actualThreeJSAndWebRTC:true,seventhSurvivorDraftShared:true,remoteOloMovesAndJumps:true,elbowCarLaserDamageImmuneOnBothPeers:true,ordinarySurvivorStillTakesDamage:true,trapPigAndCatImmunityShared:true,remoteOloCannotRepair:true,remoteOloCannotRescue:true,remoteOloTwoSlotsAndQYzmRescue:true,oloOpacityBothPeers:true,remoteDogKickCountAndQueuedFilteredReward:true,repairedGeneratorProjectionOnBothPeers:true,remoteKicksBothCatTypes:true,randomForceProfileMatchesBothPeers:true,catFlightLandingAndFightInterruptedOnBothPeers:true,othersCapturedEndsBothPeers:true,errors};
 }catch(e){result={passed:false,error:e.stack,errors};for(let i=0;i<windows.length;i++)try{await fs.writeFile(path.join(out,'failure-'+i+'.json'),JSON.stringify(await windows[i].webContents.executeJavaScript("import(document.querySelector('script[type=module][src]').src).then(m=>m.networkTestState())"),null,2));await fs.writeFile(path.join(out,'failure-'+i+'.png'),(await windows[i].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());}catch{}}
 await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));for(const c of clients.values())c.close();windows.forEach(w=>w.destroy());app.exit(result.passed?0:1);
});

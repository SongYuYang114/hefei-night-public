const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
exports.run=async(win,out)=>{
 const js=s=>win.webContents.executeJavaScript(s,true),sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const state=()=>js("import(document.querySelector('script[type=module][src]').src).then(m=>m.networkTestState())");
 const set=o=>js(`import(document.querySelector('script[type=module][src]').src).then(m=>m.networkTestConfigure(${JSON.stringify(o)}))`);
 const key=(type,keyCode)=>win.webContents.sendInputEvent({type,keyCode});
 const until=async(fn,label,seconds=10)=>{const end=Date.now()+seconds*1000;while(Date.now()<end){if(await fn())return;await sleep(40);}throw Error('Olo: '+label);};
 await js("document.querySelector('#survivor-role').click();document.querySelector('.character-card[data-character=\"6\"]').click();document.querySelector('#start').click()");
 await until(async()=>(await state()).mode==='playing','start');
 let s=await state(),slot=s.slot;assert.equal(slot,3);assert.equal(s.survivors[slot].characterId,6);
 assert(await js("document.querySelector('#skill-name').textContent==='空道具栏 · Q'&&document.querySelector('#skill-button').disabled"));
 const freeze={freezeAI:true,clearCats:true,clearPigs:true,clearEchoes:true,clearMailisu:true,kuchi:{phase:'stunned',phaseTime:300},hunter:{x:32,z:-32,stun:300,attack:300,cooldown:300},survivors:Object.fromEntries([0,1,2,3].map(i=>[i,{x:i===slot?0:30,z:i===slot?14:26+i,hp:2,state:'active',stun:i===slot?0:300,item:null}]))};
 await set({...freeze,camera:{yaw:Math.PI,pitch:.32,distance:6}});
 key('keyDown','W');await sleep(300);key('keyUp','W');await until(async()=>Math.hypot((await state()).survivors[slot].x,(await state()).survivors[slot].z-14)>.4,'movement');
 key('keyDown','Space');key('keyUp','Space');await until(async()=>(await state()).survivors[slot].jumpTime>0,'jump');await sleep(850);
 await set({survivors:{[slot]:{x:0,z:14,stun:3,blind:5,kuchiSlow:5,slow:5,launchTime:1,launchVX:20,launchVZ:20,legRush:3,invisible:5,cooldown:30}}});
 await until(async()=>{const a=(await state()).survivors[slot];return ['stun','blind','kuchiSlow','slow','launchTime','legRush','invisible','cooldown'].every(k=>a[k]===0);},'passive clears all status effects');
 await set({hunter:{x:0,z:12,angle:0,strikeAngle:0,stun:0,attack:2,swing:.5,hitDelay:.01}});await sleep(600);s=await state();assert.equal(s.survivors[slot].hp,2);assert.equal(s.survivors[slot].state,'active');
 await set({...freeze,placeMine:{x:0,z:14,arm:0},mailisu:[{x:0,z:14}]});await sleep(400);s=await state();assert.equal(s.survivors[slot].launchTime,0);assert.equal(s.survivors[slot].kuchiSlow,0);assert.equal(s.mines.length,1);assert.equal(s.mailisuCount,1);
 await set({clearMailisu:true,spawnPig:{ownerSlot:2,x:0,z:12,phase:'hunting',throwTime:0,angle:0}});await until(async()=>(await state()).pigs.length===0,'pig explodes');s=await state();assert.equal(s.survivors[slot].hp,2);assert.equal(s.survivors[slot].stun,0);
 await set({cats:[{id:5,legendary:true,x:0,z:12,target:{x:0,z:12},cooldown:100}]});await until(async()=>(await state()).catVisuals[0]?.clip==='Scratch','legendary cat triple scratch');
 await sleep(1400);s=await state();assert.equal(s.survivors[slot].hp,2);assert.equal(s.survivors[slot].stun,0);
 await fs.writeFile(path.join(out,'Olo-immune-in-game.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
 await set({clearCats:true,survivors:{[slot]:{x:0,z:-12}},gens:[0,0,0,0,0,0,0]});key('keyDown','F');await sleep(800);key('keyUp','F');assert((await state()).gens.every(p=>p===0));assert(await js("document.querySelector('#interaction-label').textContent!=='按住 F · 修复共鸣'"));
 await set({captureSlots:[0]});s=await state();await set({survivors:{[slot]:{x:s.survivors[0].x+1.5,z:s.survivors[0].z}}});key('keyDown','F');await sleep(850);key('keyUp','F');assert.equal((await state()).survivors[0].state,'captured');assert.equal((await state()).survivors[0].rescue,0);
 await set({survivors:{[slot]:{x:3,z:-13,item:null}},chests:{4:{opened:false,progress:0,loot:'egg'}}});key('keyDown','F');try{await until(async()=>(await state()).survivors[slot].item&&!['egg','hotpot'].includes((await state()).survivors[slot].item),'Olo opens filtered chest',14);}finally{key('keyUp','F');}
 key('keyDown','Q');key('keyUp','Q');await sleep(100);assert.equal((await state()).survivors[slot].cooldown,0);
 await set({survivors:{[slot]:{x:3,z:-13,item:'exhaust',itemQ:null}},chests:{4:{opened:false,progress:.99,loot:'yzm'}}});
 key('keyDown','F');try{await until(async()=>(await state()).survivors[slot].itemQ==='yzm','second chest fills Q');}finally{key('keyUp','F');}
 s=await state();assert.equal(s.survivors[slot].item,'exhaust');assert(Math.abs(s.renderActors[slot].opacity-1)<.001);assert(await js("document.querySelector('#skill-name').textContent==='yzm'"));
 await fs.writeFile(path.join(out,'Olo-new-model-two-items.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
 await set({survivors:{[slot]:{x:0,z:14},0:{x:0,z:16}}});key('keyDown','Q');key('keyUp','Q');
 await until(async()=>{const s=await state();return s.survivors[0].state==='active'&&s.survivors[slot].itemQ===null;},'Q yzm instantly rescues teammate');assert.equal((await state()).survivors[slot].item,'exhaust');
 for(const legendary of [false,true]){
  await set({clearCats:true,survivors:{[slot]:{x:0,z:14,kickTime:0}},cats:[{id:legendary?5:0,legendary,x:0,z:16,phase:'grooming',phaseTime:10,cooldown:100}]});
  key('keyDown','F');key('keyUp','F');await until(async()=>(await state()).cats[0]?.phase==='kicked','cat kicked');
  await until(async()=>(await state()).catVisuals[0]?.y>1.5,'visible cat flight');
  await fs.writeFile(path.join(out,legendary?'Olo-kicks-legendary-cat.png':'Olo-kicks-hakimi.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
  await until(async()=>{const s=await state();return s.cats[0]?.phase!=='kicked'&&s.catVisuals[0]?.rotationX===0;},'cat lands');
 }
 await set({clearCats:true,survivors:{[slot]:{x:0,z:14,item:'exhaust',itemQ:'exhaust',kuchiKicks:0,dogRewards:[],kickTime:0}}});
 for(let n=1;n<=3;n++){
  await set({kuchi:{x:0,z:16,phase:'squatting',phaseTime:3,path:[],moving:false,target:null},survivors:{[slot]:{kickTime:0}}});
  key('keyDown','F');key('keyUp','F');await until(async()=>(await state()).survivors[slot].kuchiKicks===n,'successful dog kick '+n);
 }
 s=await state();assert.equal(s.survivors[slot].item,'exhaust');assert.equal(s.survivors[slot].dogRewards.length,1);
 key('keyDown','E');key('keyUp','E');await until(async()=>{const a=(await state()).survivors[slot];return a.item&&a.item!=='egg'&&a.item!=='hotpot'&&!a.dogRewards.length;},'queued filtered dog reward');
 await set({survivors:{[slot]:{x:-17,z:19}},gens:[1,0,0,0,0,0,0],camera:{yaw:0,pitch:.22,distance:8}});
 await until(async()=>{const p=(await state()).generatorProjections;return p[0].visible&&p[0].textureReady&&p.filter(g=>g.visible).length===1;},'repaired generator photo projection');
 await sleep(300);await fs.writeFile(path.join(out,'Repaired-generator-photo.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
 await set({gens:[0,0,0,0,0,0,0]});await until(async()=>(await state()).generatorProjections.every(p=>!p.visible),'unrepaired generators hide projection');
 await set({clearCats:true});
 await set({captureSlots:[0,1,2]});await until(async()=>(await state()).mode==='result','others captured ends game');s=await state();assert.equal(s.survivors[slot].state,'active');assert(await js("document.querySelector('#result-title').textContent.includes('夜雾吞没')"));
 await fs.writeFile(path.join(out,'Olo-capture-victory.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
 await js("document.querySelector('#back').click()");
 return {oloTwoIndependentItemSlots:true,oloYzmInstantTeammateRescue:true,oloOpaque:true,oloNewModelAndPortrait:true,dogThreeKicksReward:true,queuedRewardPreserved:true,oloFilteredRewardAndChest:true,repairedGeneratorProjectsPhoto:true,projectionHiddenBeforeRepairAndAfterReset:true,oloRealModelAndPassiveHUD:true,oloMovesAndJumps:true,oloRealElbowPigAndCatImmune:true,oloTrapAndStatusImmunity:true,oloCannotRepair:true,oloCannotRescue:true,oloCanOpenChest:true,oloKicksBothCatTypes:true,oloIgnoredInCaptureVictory:true};
};

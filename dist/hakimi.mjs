import {stepCatKick} from './cat-kick.mjs';
import {LIMIT,distance,blocked,lineClear,move} from './core.mjs';
import {immuneToNegative} from './vr-hunter.mjs';

export const CAT_COUNT=5,CAT_SPEED=4,CAT_ENCOUNTER_RANGE=4,CAT_FIGHT_SECONDS=4,CAT_GROOM_SECONDS=3,CAT_STUN_SECONDS=3,CAT_STUN_RADIUS=3,CAT_PEACE_SECONDS=12;
export const CAT_FLAT_SECONDS=10;
export const LEGENDARY_CAT_COUNT=1,LEGENDARY_SIGHT_RANGE=8,LEGENDARY_WARNING_SECONDS=3,LEGENDARY_REACTION_COOLDOWN=9;
export const LEGENDARY_SCRATCH_RANGE=2.5,LEGENDARY_SCRATCH_SECONDS=1.5,LEGENDARY_SCRATCH_BEATS=[.35,.75,1.15];
export function createCat(id,point,random=Math.random){return {id,x:point.x,z:point.z,angle:random()*Math.PI*2,coat:id%5,legendary:false,phase:'roaming',phaseTime:0,travel:0,moving:false,cooldown:2+random()*3,reactionCooldown:0,scratchCooldown:0,scratchSerial:0,scratchStep:0,scratchConnected:false,focusId:null,fightId:null,target:null};}
export function spawnCats(obstacles=[],random=Math.random,count=CAT_COUNT){
 const cats=[];for(let i=0;i<count;i++)for(let attempt=0;attempt<600;attempt++){
  const p={x:(random()*2-1)*(LIMIT-2),z:(random()*2-1)*(LIMIT-2)};
  if(blocked(p.x,p.z,obstacles,.65)||cats.some(c=>distance(c,p)<3))continue;
  cats.push(createCat(i,p,random));break;
 }return cats;
}
export function spawnMatchCats(obstacles=[],random=Math.random){const cats=spawnCats(obstacles,random,CAT_COUNT+LEGENDARY_CAT_COUNT);for(const cat of cats.slice(CAT_COUNT))cat.legendary=true;return cats;}
function walk(cat,dt,obstacles,random){
 if(!cat.target||distance(cat,cat.target)<.25){cat.target=null;for(let i=0;i<18;i++){
  const angle=random()*Math.PI*2,range=3+random()*10,p={x:Math.max(-LIMIT+1,Math.min(LIMIT-1,cat.x+Math.sin(angle)*range)),z:Math.max(-LIMIT+1,Math.min(LIMIT-1,cat.z+Math.cos(angle)*range))};
  if(distance(cat,p)>.5&&!blocked(p.x,p.z,obstacles,.5)&&lineClear(cat,p,obstacles)){cat.target=p;break;}
 }}
 if(!cat.target){cat.moving=false;return;}
 const dx=cat.target.x-cat.x,dz=cat.target.z-cat.z,d=Math.hypot(dx,dz),length=Math.min(d,CAT_SPEED*dt),old={x:cat.x,z:cat.z};
 move(cat,dx/d*length,dz/d*length,obstacles);const traveled=distance(old,cat);cat.travel+=traveled;cat.moving=traveled>.0001;cat.angle=Math.atan2(dx,dz);if(traveled<length*.2)cat.target=null;
}
function scatter(cat,other,obstacles,random){
 const base=Math.atan2(cat.x-other.x,cat.z-other.z);cat.target=null;
 for(let i=0;i<20;i++){
  const angle=base+(i===0?0:(random()-.5)*Math.PI),p={x:cat.x+Math.sin(angle)*7,z:cat.z+Math.cos(angle)*7};
  if(!blocked(p.x,p.z,obstacles,.5)&&lineClear(cat,p,obstacles)){cat.target=p;break;}
 }cat.angle=base;
}
// The fighting pair occupies its visible comic cloud while both individual models are hidden.
export function catCarTargets(cats,fights){return cats.filter(c=>!['flattened','kicked'].includes(c.phase)).map(cat=>{
 const fight=cat.phase==='fighting'?fights.find(f=>f.id===cat.fightId):null;
 return {cat,x:fight?.x??cat.x,z:fight?.z??cat.z,radius:fight?1.15:.4};
});}
export function flattenCats(hits,cats,fights,obstacles=[],random=Math.random){
 const victims=new Set(hits.filter(c=>cats.includes(c)&&!c.legendary&&c.phase!=='flattened')),departed=[];
 for(let i=fights.length-1;i>=0;i--){const fight=fights[i];if(!fight.catIds.some(id=>[...victims].some(c=>c.id===id)))continue;
  const pair=fight.catIds.map(id=>cats.find(c=>c.id===id)).filter(Boolean);
  if(fight.phase==='fighting')pair.forEach(c=>{if(!c.legendary&&c.phase!=='flattened')victims.add(c);});
  for(const cat of pair)if(!victims.has(cat)&&cat.phase!=='flattened'){
   Object.assign(cat,{phase:'roaming',phaseTime:0,fightId:null,moving:false,cooldown:CAT_PEACE_SECONDS,target:null});
   const other=pair.find(c=>c!==cat);if(other)scatter(cat,other,obstacles,random);
  }
  departed.push(fight);fights.splice(i,1);
 }
 for(const cat of victims)Object.assign(cat,{phase:'flattened',phaseTime:CAT_FLAT_SECONDS,fightId:null,moving:false,target:null});
 return {cats:[...victims],departed};
}
export function repelCarCats(hits,cats,fights,obstacles=[],random=Math.random){const defenders=new Set(hits.filter(c=>c.legendary&&cats.includes(c))),departed=[];
 for(let i=fights.length-1;i>=0;i--){const fight=fights[i];if(!fight.catIds.some(id=>[...defenders].some(c=>c.id===id)))continue;
  const pair=fight.catIds.map(id=>cats.find(c=>c.id===id)).filter(Boolean);for(const cat of pair)if(!defenders.has(cat)&&cat.phase!=='flattened'){Object.assign(cat,{phase:'roaming',phaseTime:0,fightId:null,moving:false,target:null,cooldown:CAT_PEACE_SECONDS});const other=pair.find(c=>c!==cat);if(other)scatter(cat,other,obstacles,random);}departed.push(fight);fights.splice(i,1);
 }
 for(const cat of defenders)Object.assign(cat,{phase:'recoil',phaseTime:.7,moving:false,fightId:null,target:null,cooldown:CAT_PEACE_SECONDS,reactionCooldown:LEGENDARY_REACTION_COOLDOWN});return {cats:[...defenders],departed};
}
// The host owns encounters, timers and hits. Guests only render these snapshots.
export function stepCats(cats,fights,dt,actors=[],obstacles=[],random=Math.random){
 const events=[];let left=Math.max(0,dt);
 while(left>1e-7){const step=Math.min(.04,left);left-=step;
  for(const cat of cats){cat.cooldown=Math.max(0,cat.cooldown-step);cat.reactionCooldown=Math.max(0,(cat.reactionCooldown||0)-step);cat.scratchCooldown=Math.max(0,(cat.scratchCooldown||0)-step);
   if(cat.phase==='kicked'){stepCatKick(cat,step,obstacles);continue;}
   if(cat.phase==='flattened'){cat.moving=false;cat.phaseTime=Math.max(0,cat.phaseTime-step);if(cat.phaseTime<=1e-7){Object.assign(cat,{phase:'roaming',phaseTime:0,cooldown:CAT_PEACE_SECONDS,target:null});events.push({type:'recover',cat});}}
   else if(cat.phase==='scratching'){
    cat.moving=false;cat.phaseTime=Math.max(0,cat.phaseTime-step);
    const target=actors.find(a=>(a.id??4)===cat.focusId&&a.state==='active'&&!a.isVRPhantom&&!(a.invisible>0));
    if(target)cat.angle=Math.atan2(target.x-cat.x,target.z-cat.z);
    while((cat.scratchStep||0)<LEGENDARY_SCRATCH_BEATS.length&&LEGENDARY_SCRATCH_SECONDS-cat.phaseTime+1e-7>=LEGENDARY_SCRATCH_BEATS[cat.scratchStep||0]){
     cat.scratchStep=(cat.scratchStep||0)+1;events.push({type:'scratch-swing',cat,beat:cat.scratchStep});
     // Three chances to connect, one effect for the entire combo. Recheck the
     // locked target at each impact so dodging, invisibility and walls work.
     if(cat.scratchConnected||!target||distance(cat,target)>LEGENDARY_SCRATCH_RANGE||!lineClear(cat,target,obstacles)||target.invincible>0||immuneToNegative(target))continue;
     cat.scratchConnected=true;
     if((target.id??4)===4){target.stun=Math.max(target.stun||0,CAT_STUN_SECONDS);target.moving=false;target.interacting=false;target.attack=target.swing=target.hitDelay=0;}
     events.push({type:'scratch-hit',cat,actor:target});
    }
    if(cat.phaseTime<=1e-7)Object.assign(cat,{phase:'roaming',phaseTime:0,target:null,focusId:null});
   }
   else if(cat.phase==='warning'||cat.phase==='recoil'){cat.moving=false;cat.phaseTime=Math.max(0,cat.phaseTime-step);const target=cat.phase==='warning'?actors.find(a=>(a.id??4)===cat.focusId&&a.state==='active'&&!(a.invisible>0)&&lineClear(cat,a,obstacles)):null;if(target)cat.angle=Math.atan2(target.x-cat.x,target.z-cat.z);if(cat.phaseTime<=1e-7)Object.assign(cat,{phase:'roaming',phaseTime:0,target:null,focusId:null});}
   else if(cat.phase==='roaming')walk(cat,step,obstacles,random);else cat.moving=false;
  }
  for(let i=fights.length-1;i>=0;i--){const fight=fights[i],pair=fight.catIds.map(id=>cats.find(c=>c.id===id));
   if(pair.some(c=>!c||c.phase==='flattened')){for(const cat of pair.filter(c=>c&&c.phase!=='flattened'))Object.assign(cat,{phase:'roaming',fightId:null,cooldown:CAT_PEACE_SECONDS});events.push({type:'depart',fight});fights.splice(i,1);continue;}
   fight.phaseTime=Math.max(0,fight.phaseTime-step);
   if(fight.phaseTime<=1e-7){
    if(fight.phase==='hissing'){fight.phase='fighting';fight.phaseTime=CAT_FIGHT_SECONDS;events.push({type:'fight',fight});}
    else if(fight.phase==='fighting'){fight.phase='grooming';fight.phaseTime=CAT_GROOM_SECONDS;events.push({type:'groom',fight});}
    else{for(const cat of pair){Object.assign(cat,{phase:'roaming',phaseTime:0,fightId:null,cooldown:CAT_PEACE_SECONDS});scatter(cat,pair.find(c=>c!==cat),obstacles,random);}events.push({type:'depart',fight});fights.splice(i,1);continue;}
   }
   for(const cat of pair){cat.phase=fight.phase;cat.phaseTime=fight.phaseTime;}
   if(fight.phase==='fighting')for(const actor of actors){
    const id=actor.id??4;if(actor.isVRPhantom||actor.state!=='active'||immuneToNegative(actor)||fight.hitIds.includes(id)||distance(actor,fight)>CAT_STUN_RADIUS||!lineClear(fight,actor,obstacles))continue;
    fight.hitIds.push(id);actor.stun=Math.max(actor.stun||0,CAT_STUN_SECONDS);actor.moving=false;actor.interacting=false;actor.attack=0;actor.swing=0;actor.hitDelay=0;
    events.push({type:'stun',fight,actor});
   }
  }
  for(const cat of cats)if((cat.legendary&&['roaming','warning'].includes(cat.phase))||(!cat.legendary&&cat.phase==='roaming'&&cat.reactionCooldown<=0)){
   const target=actors.filter(a=>(cat.legendary||a.isVRPhantom)&&a.state==='active'&&!(a.invisible>0)&&distance(cat,a)<=LEGENDARY_SIGHT_RANGE&&lineClear(cat,a,obstacles)).sort((a,b)=>distance(cat,a)-distance(cat,b))[0];
   if(target&&!target.isVRPhantom&&cat.legendary&&cat.scratchCooldown<=0&&distance(cat,target)<=LEGENDARY_SCRATCH_RANGE){Object.assign(cat,{phase:'scratching',phaseTime:LEGENDARY_SCRATCH_SECONDS,moving:false,target:null,focusId:target.id??4,scratchSerial:(cat.scratchSerial||0)+1,scratchStep:0,scratchConnected:false,scratchCooldown:LEGENDARY_REACTION_COOLDOWN,reactionCooldown:LEGENDARY_REACTION_COOLDOWN,angle:Math.atan2(target.x-cat.x,target.z-cat.z)});}
   else if(target&&cat.phase==='roaming'&&cat.reactionCooldown<=0){Object.assign(cat,{phase:'warning',phaseTime:LEGENDARY_WARNING_SECONDS,moving:false,target:null,focusId:target.id??4,reactionCooldown:LEGENDARY_REACTION_COOLDOWN,angle:Math.atan2(target.x-cat.x,target.z-cat.z)});events.push({type:'hiss',fight:cat});}
  }
  for(let i=0;i<cats.length;i++){const a=cats[i];if(a.phase!=='roaming'||a.cooldown>0)continue;
   for(const b of cats.slice(i+1)){if(b.phase!=='roaming'||b.cooldown>0||distance(a,b)>CAT_ENCOUNTER_RANGE||distance(a,b)<.1||!lineClear(a,b,obstacles))continue;
    const center={x:(a.x+b.x)/2,z:(a.z+b.z)/2};if(blocked(center.x,center.z,obstacles,.35))continue;
    const serial=Math.max(a.encounters||0,b.encounters||0)+1,id=`${a.id}-${b.id}-${serial}`,windup=5+random()*5;
    const fight={id,...center,catIds:[a.id,b.id],phase:'hissing',phaseTime:windup,windup,hitIds:[]};fights.push(fight);
    for(const [cat,other] of [[a,b],[b,a]])Object.assign(cat,{phase:'hissing',phaseTime:windup,moving:false,target:null,fightId:id,encounters:serial,angle:Math.atan2(other.x-cat.x,other.z-cat.z)});
    events.push({type:'hiss',fight});break;
   }
  }
 }return events;
}
export const catState=cat=>Object.fromEntries(['id','x','z','angle','coat','legendary','reactionCooldown','scratchCooldown','scratchSerial','scratchStep','focusId','phase','phaseTime','travel','moving','cooldown','fightId','kickVX','kickVZ','kickFlatTime','kickDuration','kickHeight','kickPower','kickSerial'].map(k=>[k,cat[k]]));
export const catFightState=f=>Object.fromEntries(['id','x','z','catIds','phase','phaseTime','windup'].map(k=>[k,f[k]]));

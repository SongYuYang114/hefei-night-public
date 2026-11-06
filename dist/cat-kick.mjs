import {isOlo} from './olo.mjs';
import {distance,lineClear,move} from './core.mjs';
export const CAT_KICK_RANGE=2.5,CAT_KICK_SECONDS=1.1,CAT_KICK_SPEED=12,CAT_KICK_HEIGHT=3.2,CAT_KICK_ACTION_SECONDS=.55;
export function nearestKickCat(actor,cats,obstacles=[]){
 if(!isOlo(actor)||actor.state!=='active'||actor.stun>0||actor.kickTime>0||actor.jumpTime>0||actor.launchTime>0||actor.shoeTime>0)return null;
 return cats.filter(c=>c.phase!=='kicked'&&distance(actor,c)<=CAT_KICK_RANGE&&lineClear(actor,c,obstacles)).sort((a,b)=>distance(actor,a)-distance(actor,b)||a.id-b.id)[0]||null;
}
export function randomCatKick(random=Math.random){
 const r=Math.max(0,Math.min(1,random())),power=r<.9?.5+r/.9*2.5:3+Math.pow((r-.9)/.1,3)*97;
 return {power,height:CAT_KICK_HEIGHT*power,speed:CAT_KICK_SPEED*Math.min(power,20),seconds:power<=3?CAT_KICK_SECONDS:CAT_KICK_SECONDS+(power-3)/97*4.9};
}
export function kickNearestCat(actor,cats,fights,obstacles=[],random=Math.random){
 const cat=nearestKickCat(actor,cats,obstacles);if(!cat)return null;
 const departed=[];
 for(let i=fights.length-1;i>=0;i--){const f=fights[i];if(!f.catIds.includes(cat.id))continue;
  for(const other of cats.filter(c=>c!==cat&&f.catIds.includes(c.id)))Object.assign(other,{phase:'roaming',phaseTime:0,fightId:null,target:null,moving:false,cooldown:12});
  departed.push(f);fights.splice(i,1);
 }
 const angle=distance(actor,cat)>.01?Math.atan2(cat.x-actor.x,cat.z-actor.z):actor.angle||0;
 const flat=cat.phase==='flattened'?cat.phaseTime:0;
 const force=randomCatKick(random);
 Object.assign(cat,{phase:'kicked',phaseTime:force.seconds,kickDuration:force.seconds,kickHeight:force.height,kickPower:force.power,kickSerial:(cat.kickSerial||0)+1,kickVX:Math.sin(angle)*force.speed,kickVZ:Math.cos(angle)*force.speed,kickFlatTime:flat,fightId:null,focusId:null,target:null,moving:false,cooldown:12});
 Object.assign(actor,{angle,kickTime:CAT_KICK_ACTION_SECONDS,moving:false,interacting:false});
 return {cat,departed};
}
export function stepCatKick(cat,dt,obstacles=[]){
 if(cat.phase!=='kicked')return;
 let left=Math.min(Math.max(0,dt),cat.phaseTime);
 while(left>1e-7){const t=Math.min(.01,left),moved=move(cat,cat.kickVX*t,cat.kickVZ*t,obstacles);left-=t;if(moved<1e-6){cat.kickVX=cat.kickVZ=0;break;}}
 cat.phaseTime=Math.max(0,cat.phaseTime-dt);cat.kickFlatTime=Math.max(0,(cat.kickFlatTime||0)-dt);cat.moving=false;
 if(cat.phaseTime<=1e-7)Object.assign(cat,{phase:cat.kickFlatTime>0?'flattened':'roaming',phaseTime:cat.kickFlatTime||0,kickVX:0,kickVZ:0,target:null,cooldown:12});
}
export const catKickHeight=cat=>cat.phase==='kicked'?Math.sin(Math.PI*Math.max(0,Math.min(1,1-cat.phaseTime/(cat.kickDuration||CAT_KICK_SECONDS))))*(cat.kickHeight||CAT_KICK_HEIGHT):0;
export function applyCatKickPose(root,cat){
 root.position.y+=catKickHeight(cat);
 root.rotation.x=cat.phase==='kicked'?(1-cat.phaseTime/(cat.kickDuration||CAT_KICK_SECONDS))*Math.PI*2*(1+Math.min(7,Math.floor(Math.log2(Math.max(1,cat.kickPower||1))))):0;
 root.rotation.z=0;
}

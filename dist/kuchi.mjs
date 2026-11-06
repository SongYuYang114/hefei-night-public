import {isOlo} from './olo.mjs';
import {LIMIT,blocked,lineClear,findPath,distance} from './core.mjs';
import {jumpGrounded} from './jump.mjs';
export const KUCHI_SPEED=20,KUCHI_WANDER_SECONDS=5,KUCHI_SQUAT_SECONDS=3,KUCHI_SLOW_SECONDS=5,KUCHI_SLOW_FACTOR=.5,KUCHI_STUN_SECONDS=10,KUCHI_KICK_RANGE=2.3,KUCHI_KICK_SECONDS=.55;
export const canSeeMailisu=viewerSlot=>viewerSlot===4;
export function canKickKuchi(actor,dog,obstacles=[]){return !!dog&&dog.phase==='squatting'&&actor.state==='active'&&actor.stun<=0&&!(actor.jumpTime>0)&&!(actor.launchTime>0)&&!(actor.kickTime>0)&&distance(actor,dog)<=KUCHI_KICK_RANGE&&lineClear(actor,dog,obstacles);}
export function kickKuchi(actor,dog,obstacles=[]){if(!canKickKuchi(actor,dog,obstacles))return false;Object.assign(dog,{phase:'stunned',phaseTime:KUCHI_STUN_SECONDS,moving:false,path:[],target:null});actor.kickTime=KUCHI_KICK_SECONDS;actor.angle=Math.atan2(dog.x-actor.x,dog.z-actor.z);actor.moving=false;actor.interacting=false;return true;}
export function consumeKickInput(actor,input,dog,obstacles=[]){const press=input.fPress||0;if(press<=(actor.kickAck||0))return false;actor.kickAck=press;return kickKuchi(actor,dog,obstacles);}
export function createKuchi(point,random=Math.random){return {x:point.x,z:point.z,angle:random()*Math.PI*2,phase:'roaming',phaseTime:KUCHI_WANDER_SECONDS,moving:true,path:[],target:null,travel:0,drops:0};}
function pickRoute(dog,obstacles,random){
 for(let attempt=0;attempt<36;attempt++){
  const angle=random()*Math.PI*2,range=6+random()*16,point={x:Math.max(-LIMIT+1,Math.min(LIMIT-1,dog.x+Math.sin(angle)*range)),z:Math.max(-LIMIT+1,Math.min(LIMIT-1,dog.z+Math.cos(angle)*range))};
  if(distance(point,dog)<2||blocked(point.x,point.z,obstacles,.65))continue;
  const path=lineClear(dog,point,obstacles)?[point]:attempt>12?findPath(dog,point,obstacles):[];
  if(path.length){dog.target=point;dog.path=path;return;}
 }
 dog.path=[];dog.target=null;
}
export function stepKuchi(dog,dt,obstacles=[],random=Math.random){
 const drops=[];let left=Math.max(0,dt);while(left>1e-7){
  const step=Math.min(.02,left,dog.phaseTime);dog.phaseTime-=step;left-=step;
  if(dog.phase==='roaming'){
   let travel=KUCHI_SPEED*step;dog.moving=false;
   for(let guard=0;travel>1e-7&&guard<20;guard++){
    if(!dog.path.length)pickRoute(dog,obstacles,random);const target=dog.path[0];if(!target)break;
    const d=distance(dog,target);if(d<.025){dog.path.shift();continue;}
    const length=Math.min(d,travel),dx=(target.x-dog.x)/d*length,dz=(target.z-dog.z)/d*length;
    if(blocked(dog.x+dx,dog.z+dz,obstacles,.48)){dog.path=[];dog.target=null;break;}
    dog.angle=Math.atan2(dx,dz);dog.x+=dx;dog.z+=dz;dog.travel+=length;dog.moving=true;travel-=length;
    if(length>=d-1e-7)dog.path.shift();
   }
  }else dog.moving=false;
  if(dog.phaseTime<=1e-7){
   if(dog.phase==='roaming'){dog.phase='squatting';dog.phaseTime=KUCHI_SQUAT_SECONDS;dog.moving=false;}
   else{if(dog.phase==='squatting'){drops.push({x:dog.x,z:dog.z});dog.drops++;}dog.phase='roaming';dog.phaseTime=KUCHI_WANDER_SECONDS;dog.path=[];dog.target=null;}
  }
 }return drops;
}
export function stepMailisu(traps,survivors,obstacles=[],previous=new Map()){
 const hits=[];for(let i=traps.length-1;i>=0;i--){const trap=traps[i];
  const target=survivors.find(a=>{
   if(isOlo(a)||a.state!=='active'||!jumpGrounded(a))return false;
   const start=previous.get(a),dx=start?a.x-start.x:0,dz=start?a.z-start.z:0,d=dx*dx+dz*dz;
   // Ignore discontinuities such as teleport/rescue; test continuous walking paths.
   const t=start&&d<4&&d>0?Math.max(0,Math.min(1,((trap.x-start.x)*dx+(trap.z-start.z)*dz)/d)):1;
   const p=start&&d<4?{x:start.x+dx*t,z:start.z+dz*t}:a;
   return distance(trap,p)<.7&&lineClear(trap,p,obstacles);
  });
  if(target){target.kuchiSlow=KUCHI_SLOW_SECONDS;traps.splice(i,1);hits.push(target);}
 }return hits;
}
export const kuchiSpeedFactor=a=>a.kuchiSlow>0?KUCHI_SLOW_FACTOR:1;
export const kuchiState=dog=>dog?Object.fromEntries(['x','z','angle','phase','phaseTime','moving','travel','drops'].map(k=>[k,dog[k]])):null;

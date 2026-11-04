import {immuneToNegative} from './vr-hunter.mjs';
import {distance,move,findPath,lineClear,blocked} from './core.mjs';
import {launchDrivenCar} from './drive-car.mjs';
export const PIG_SPEED=7,PIG_THROW_SECONDS=.5,PIG_THROW_DISTANCE=3,PIG_STUN_SECONDS=3,PIG_BLAST_RADIUS=2.5;
export const pigActorId=actor=>actor.id??4;
function routeClear(a,b,obstacles){const steps=Math.ceil(distance(a,b)/.25);for(let i=1;i<=steps;i++){const t=i/steps;if(blocked(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,obstacles,.5))return false;}return true;}
export function createSeekerPig(owner,id){return {id,ownerSlot:pigActorId(owner),x:owner.x,z:owner.z,angle:owner.angle,phase:'thrown',throwTime:PIG_THROW_SECONDS,active:true,state:'active',moving:true,kuchiSlow:0,travel:0,path:[],repath:0,targetSlot:null};}
export const pigHeight=p=>p.phase==='thrown'?.35+Math.sin(Math.PI*(1-p.throwTime/PIG_THROW_SECONDS))*1.6:0;
export function nearestPigTarget(pig,actors){return actors.filter(a=>a.state==='active'&&pigActorId(a)!==pig.ownerSlot&&!(a.launchTime>0)&&!(a.driving&&a.drivePhase==='airborne')).sort((a,b)=>distance(pig,a)-distance(pig,b)||pigActorId(a)-pigActorId(b))[0]||null;}
export function explodeSeekerPig(pig,actors,obstacles=[],random=Math.random,crushedCar=null){
 if(!pig.active)return null;pig.active=false;pig.state='eliminated';pig.moving=false;
 const hits=[];for(const a of actors){if(a.state!=='active'||immuneToNegative(a)||pigActorId(a)===pig.ownerSlot||distance(pig,a)>PIG_BLAST_RADIUS||!lineClear(pig,a,obstacles))continue;
  if(a===crushedCar||a.driving&&a.drivePhase==='driving'){launchDrivenCar(a,random);hits.push(a);continue;}
  if(a.driving&&a.drivePhase==='airborne')continue;
  a.stun=Math.max(a.stun||0,PIG_STUN_SECONDS);a.swing=0;a.hitDelay=0;a.moving=false;a.interacting=false;a.healTime=0;a.craftTime=0;a.craftBlocked=true;a.path=[];a.repath=0;hits.push(a);
 }
 if(crushedCar&&!hits.includes(crushedCar)){launchDrivenCar(crushedCar,random);hits.push(crushedCar);}
 return {x:pig.x,z:pig.z,hits,crushed:!!crushedCar||hits.some(a=>a.driving&&a.drivePhase==='airborne')};
}
export function stepSeekerPig(pig,dt,actors,obstacles=[],random=Math.random){
 if(!pig.active)return null;let left=Math.max(0,dt);
 while(left>1e-7){const step=Math.min(.02,left);left-=step;pig.kuchiSlow=Math.max(0,pig.kuchiSlow-step);pig.repath-=step;
  if(pig.phase==='thrown'){const travel=Math.min(step,pig.throwTime)*PIG_THROW_DISTANCE/PIG_THROW_SECONDS;const moved=move(pig,Math.sin(pig.angle)*travel,Math.cos(pig.angle)*travel,obstacles);pig.travel+=moved;pig.throwTime=Math.max(0,pig.throwTime-step);if(!pig.throwTime){pig.phase='hunting';pig.repath=0;}continue;}
  const target=nearestPigTarget(pig,actors);pig.moving=false;if(!target){pig.targetSlot=null;continue;}
  const targetSlot=pigActorId(target);if(targetSlot!==pig.targetSlot){pig.targetSlot=targetSlot;pig.repath=0;}
  if(distance(pig,target)<1.05&&lineClear(pig,target,obstacles))return explodeSeekerPig(pig,actors,obstacles,random,target.driving&&target.drivePhase==='driving'?target:null);
  if(routeClear(pig,target,obstacles)){pig.path=[{x:target.x,z:target.z}];}
  else if(pig.repath<=0){pig.path=findPath(pig,target,obstacles);pig.repath=.65;}
  let travel=PIG_SPEED*(pig.kuchiSlow>0?.5:1)*step;
  for(let guard=0;travel>1e-7&&pig.path.length&&guard<10;guard++){const point=pig.path[0],d=distance(pig,point);if(d<.12){pig.path.shift();continue;}const amount=Math.min(d,travel),dx=(point.x-pig.x)/d*amount,dz=(point.z-pig.z)/d*amount,moved=move(pig,dx,dz,obstacles);pig.angle=Math.atan2(dx,dz);pig.travel+=moved;pig.moving=moved>1e-7;travel-=amount;if(moved<amount*.5){pig.repath=0;pig.path=[];break;}if(amount>=d-1e-7)pig.path.shift();}
  if(distance(pig,target)<1.05&&lineClear(pig,target,obstacles))return explodeSeekerPig(pig,actors,obstacles,random,target.driving&&target.drivePhase==='driving'?target:null);
 }return null;
}
export const seekerPigState=p=>Object.fromEntries(['id','ownerSlot','x','z','angle','phase','throwTime','active','moving','kuchiSlow','travel','targetSlot'].map(k=>[k,p[k]]));

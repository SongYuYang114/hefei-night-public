import {blocked,distance,move,findPath,lineClear} from './core.mjs';
import {immuneToNegative} from './vr-hunter.mjs';
import {resetDrive} from './drive-car.mjs';
export const RED_EYE_SPEED=20,SHOE_HOLD_SECONDS=15,RED_EYE_CATCH_DISTANCE=1.15;
export const redEyeActorId=a=>a.id??4;
const validTarget=(a,hunter)=>a&&a.state==='active'&&!immuneToNegative(a)&&(a===hunter||(a.characterId??a.id)===3);
export function redEyeTargets(npc,hunter,survivors){return [hunter,...survivors].filter(a=>validTarget(a,hunter)&&!(a.shoeTime>0)&&!npc.caught.includes(redEyeActorId(a)));}
export function redEyeSpawn(owner,obstacles=[]){
 for(const r of [1.3,2,3])for(let i=0;i<12;i++){const angle=(owner.angle||0)+i*Math.PI/6,p={x:owner.x+Math.sin(angle)*r,z:owner.z+Math.cos(angle)*r};if(!blocked(p.x,p.z,obstacles,.6))return p;}
 return null;
}
export function createRedEye(owner,point,id){return {id,ownerSlot:redEyeActorId(owner),...point,angle:owner.angle||0,phase:'chasing',active:true,invincible:true,moving:false,travel:0,holdTime:0,holdTarget:null,caught:[],path:[],repath:0,targetSlot:null};}
export function releaseShoeHold(actor,npcId){if(!actor||actor.shoeNpcId!==npcId)return;actor.shoeTime=0;actor.shoeNpcId=0;actor.shoeX=actor.x;actor.shoeZ=actor.z;actor.moving=false;}
export function lockUnderShoe(actor,npc){
 if(immuneToNegative(actor))return false;
 Object.assign(actor,{shoeTime:SHOE_HOLD_SECONDS,shoeNpcId:npc.id,shoeX:actor.x,shoeZ:actor.z,shoeAngle:actor.angle,launchTime:0,jumpTime:0,kickTime:0,healTime:0,craftTime:0,craftBlocked:true,mealActive:false,mealTime:0,eating:0,moving:false,running:false,interacting:false,swing:0,hitDelay:0,path:[],repath:0});
 if(actor.driving)resetDrive(actor);
 npc.phase='holding';npc.holdTarget=redEyeActorId(actor);npc.holdTime=SHOE_HOLD_SECONDS;npc.caught.push(npc.holdTarget);npc.x=actor.x;npc.z=actor.z;npc.angle=actor.angle;npc.moving=false;
}
const clearRoute=(a,b,obs)=>{const count=Math.ceil(distance(a,b)/.2);for(let i=1;i<=count;i++){const f=i/count;if(blocked(a.x+(b.x-a.x)*f,a.z+(b.z-a.z)*f,obs,.5))return false;}return true;};
export function stepRedEye(npc,dt,hunter,survivors,obstacles=[]){
 if(!npc.active)return [];const events=[],actors=[hunter,...survivors];let left=Math.max(0,dt);
 while(left>1e-8&&npc.active){const step=Math.min(.02,left);left-=step;
  if(npc.phase==='holding'){
   const target=actors.find(a=>redEyeActorId(a)===npc.holdTarget);
   if(!validTarget(target,hunter)||target.shoeNpcId!==npc.id){releaseShoeHold(target,npc.id);npc.phase='chasing';npc.holdTarget=null;npc.holdTime=0;npc.repath=0;continue;}
   npc.holdTime=Math.max(0,npc.holdTime-step);Object.assign(target,{x:target.shoeX,z:target.shoeZ,angle:target.shoeAngle,shoeTime:npc.holdTime,moving:false,interacting:false,launchTime:0,jumpTime:0});npc.x=target.x;npc.z=target.z;npc.angle=target.angle;npc.moving=false;
   if(npc.holdTime<=1e-7){npc.holdTime=0;releaseShoeHold(target,npc.id);events.push({type:'released',target});npc.phase='chasing';npc.holdTarget=null;npc.repath=0;}continue;
  }
  const candidates=redEyeTargets(npc,hunter,survivors).sort((a,b)=>distance(npc,a)-distance(npc,b)||redEyeActorId(a)-redEyeActorId(b));npc.moving=false;
  if(!candidates.length){npc.active=false;events.push({type:'departed'});break;}
  const target=candidates[0],id=redEyeActorId(target);if(id!==npc.targetSlot){npc.targetSlot=id;npc.repath=0;}
  const catchable=()=>distance(npc,target)<RED_EYE_CATCH_DISTANCE&&lineClear(npc,target,obstacles)&&!(target.launchTime>0)&&!(target.jumpTime>0)&&!(target.driving&&target.drivePhase==='airborne');
  if(catchable()){lockUnderShoe(target,npc);events.push({type:'caught',target});continue;}
  npc.repath-=step;if(clearRoute(npc,target,obstacles))npc.path=[{x:target.x,z:target.z}];else if(npc.repath<=0){npc.path=findPath(npc,target,obstacles);npc.repath=.45;}
  let travel=RED_EYE_SPEED*step;for(let guard=0;travel>1e-8&&npc.path.length&&guard<10;guard++){const p=npc.path[0],d=distance(npc,p);if(d<.08){npc.path.shift();continue;}const amount=Math.min(d,travel),dx=(p.x-npc.x)/d*amount,dz=(p.z-npc.z)/d*amount,moved=move(npc,dx,dz,obstacles);npc.angle=Math.atan2(dx,dz);npc.travel+=moved;npc.moving=moved>1e-6;travel-=amount;if(moved<amount*.5){npc.repath=0;npc.path=[];break;}if(amount>=d-1e-8)npc.path.shift();}
  if(catchable()){lockUnderShoe(target,npc);events.push({type:'caught',target});}
 }
 return events;
}
export const redEyeState=npc=>Object.fromEntries(['id','ownerSlot','x','z','angle','phase','active','invincible','moving','travel','holdTime','holdTarget'].map(k=>[k,npc[k]]));

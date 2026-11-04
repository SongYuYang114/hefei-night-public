import {immuneToNegative} from './vr-hunter.mjs';
import {launchDrivenCar} from './drive-car.mjs';
import {move,lineClear} from './core.mjs';
export const CURRY_CRAFT_SECONDS=10,CURRY_ARM_SECONDS=1.2,CURRY_STUN_SECONDS=3,CURRY_FLIGHT_SECONDS=.8;
export const canSeeCurryMine=(mine,viewerSlot)=>Number.isInteger(mine.ownerSlot)&&mine.ownerSlot>=0&&mine.ownerSlot<4&&mine.ownerSlot===viewerSlot;
export function cancelCurryCraft(actor){actor.craftTime=0;actor.craftBlocked=true;}
export function advanceCurryCraft(actor,held,stationary,dt){
 if(!held)actor.craftBlocked=false;
 if(actor.state!=='active'||actor.stun>0||actor.curryReady||!held||!stationary||actor.craftBlocked){actor.craftTime=0;return false;}
 actor.interacting=true;actor.moving=false;
 actor.craftTime=Math.min(CURRY_CRAFT_SECONDS,(actor.craftTime||0)+dt);
 if(actor.craftTime<CURRY_CRAFT_SECONDS-1e-7)return false;
 actor.craftTime=0;actor.curryReady=true;actor.craftBlocked=true;return true;
}
export function plantCurry(actor){
 if(actor.state!=='active'||actor.stun>0||!actor.curryReady)return null;
 actor.curryReady=false;cancelCurryCraft(actor);
 return {x:actor.x,z:actor.z,ownerSlot:actor.id,arm:CURRY_ARM_SECONDS};
}
export function stepCurryMine(mine,dt,actors,obstacles,random=Math.random){
 mine.arm=Math.max(0,mine.arm-dt);if(mine.arm>0)return null;
 const contact=a=>{if(a.driving&&a.drivePhase==='driving'&&Number.isFinite(a.driveLastX)&&Number.isFinite(a.driveLastZ)){const dx=a.x-a.driveLastX,dz=a.z-a.driveLastZ,d=dx*dx+dz*dz,t=d?Math.max(0,Math.min(1,((mine.x-a.driveLastX)*dx+(mine.z-a.driveLastZ)*dz)/d)):0;return {x:a.driveLastX+dx*t,z:a.driveLastZ+dz*t};}return a;};
 const target=actors.filter(a=>{const p=contact(a);return a.state==='active'&&!immuneToNegative(a)&&!(a.shoeTime>0)&&!(a.launchTime>0)&&Math.hypot(p.x-mine.x,p.z-mine.z)<(a.driving&&a.drivePhase==='driving'?1.6:.85)&&lineClear(mine,p,obstacles);}).sort((a,b)=>Math.hypot(contact(a).x-mine.x,contact(a).z-mine.z)-Math.hypot(contact(b).x-mine.x,contact(b).z-mine.z))[0];
 if(!target)return null;
 if(target.driving&&target.drivePhase==='driving'){launchDrivenCar(target,random);cancelCurryCraft(target);target.path=[];target.repath=0;return target;}
 const angle=random()*Math.PI*2,range=6+random()*4;
 target.stun=Math.max(target.stun||0,CURRY_STUN_SECONDS);target.launchTime=CURRY_FLIGHT_SECONDS;
 target.launchVX=Math.sin(angle)*range/CURRY_FLIGHT_SECONDS;target.launchVZ=Math.cos(angle)*range/CURRY_FLIGHT_SECONDS;
 target.moving=false;target.interacting=false;target.swing=0;target.hitDelay=0;target.path=[];target.repath=0;cancelCurryCraft(target);
 return target;
}
export function stepCurryFlight(actor,dt,obstacles){
 if(!(actor.launchTime>0))return;
 if(actor.state!=='active'){actor.launchTime=0;return;}
 let left=Math.min(dt,actor.launchTime);
 // Small collision steps prevent fast knockback tunnelling through walls.
 while(left>1e-7){const step=Math.min(left,.01);move(actor,actor.launchVX*step,actor.launchVZ*step,obstacles);left-=step;}
 actor.launchTime=Math.max(0,actor.launchTime-dt);
}
export const curryFlightHeight=actor=>actor.launchTime>0?Math.sin(Math.PI*(1-actor.launchTime/CURRY_FLIGHT_SECONDS))*2.5:0;

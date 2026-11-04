import {immuneToNegative} from './vr-hunter.mjs';
import {blocked,lineClear,distance} from './core.mjs?v=car-horizontal-1';
export const BLIND_SECONDS=5,EXHAUST_RANGE=8,EXHAUST_SPEED=12,EXHAUST_RADIUS=1.65;
export function createExhaust(owner){return {owner,ownerSlot:owner.id,origin:{x:owner.x,z:owner.z},x:owner.x,z:owner.z,angle:owner.angle+Math.PI,travel:0,active:true,fade:.65,hitActors:new Set()};}
export function stepExhaust(gas,dt,obstacles,actors){
 const hits=[];if(!gas.active)return {hits,blocked:false};const fx=Math.sin(gas.angle),fz=Math.cos(gas.angle);let left=Math.min(EXHAUST_SPEED*Math.max(0,dt),EXHAUST_RANGE-gas.travel),collision=false;
 const collect=()=>{for(const actor of actors){if(actor===gas.owner||immuneToNegative(actor)||actor.state!=='active'||gas.hitActors.has(actor))continue;
  if((actor.x-gas.origin.x)*fx+(actor.z-gas.origin.z)*fz<.6||distance(gas,actor)>EXHAUST_RADIUS||!lineClear(gas,actor,obstacles))continue;
  gas.hitActors.add(actor);hits.push(actor);
 }};
 collect();while(left>1e-6){const step=Math.min(.15,left),x=gas.x+fx*step,z=gas.z+fz*step;if(blocked(x,z,obstacles,.35)){gas.active=false;collision=true;break;}gas.x=x;gas.z=z;gas.travel+=step;left-=step;collect();}
 if(gas.travel>=EXHAUST_RANGE-1e-6)gas.active=false;return {hits,blocked:collision};
}

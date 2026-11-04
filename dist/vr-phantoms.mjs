import {LIMIT,blocked,distance} from './core.mjs';
import {isVRHunter} from './vr-hunter.mjs';

export const VR_PHANTOM_COUNT=3;
// These are perceptual decoys, never player slots or damage targets.
export function spawnVRPhantoms(hunter,obstacles=[],random=Math.random,elapsed=0){
 if(!isVRHunter(hunter)||!(hunter.vrTime>0))return [];
 const result=[];
 for(let i=0;i<VR_PHANTOM_COUNT;i++)for(let attempt=0;attempt<600;attempt++){
  const point={x:(random()*2-1)*(LIMIT-2),z:(random()*2-1)*(LIMIT-2)};
  if(blocked(point.x,point.z,obstacles,.65)||result.some(p=>distance(p,point)<4))continue;
  result.push({id:-1000-(hunter.vrSerial||0)*10-i,...point,angle:random()*Math.PI*2,born:elapsed,phase:random()*2,isVRPhantom:true,state:'active'});break;
 }
 return result;
}
export const vrPhantomState=p=>Object.fromEntries(['id','x','z','angle','born','phase','isVRPhantom','state'].map(k=>[k,p[k]]));

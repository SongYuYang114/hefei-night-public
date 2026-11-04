import * as THREE from 'three';
import {JUMP_SECONDS} from './jump.mjs';

// Pose the original skins in model space, so different bone rolls and actor
// headings share the same raised fist / lifted knee silhouette.
export function createMarioJumpPose(model){
 const bones=new Map(),targets=[];model.updateMatrixWorld(true);
 model.traverse(b=>{if(b.isBone)bones.set(b.name.replace(/[^a-z0-9]/gi,'').toLowerCase(),b);});
 const saved=new Map([...bones.values()].map(b=>[b,b.quaternion.clone()]));
 const direction=(name,child,xyz)=>{
  const b=bones.get(name),end=bones.get(child);if(!b||!end)return;
  model.updateMatrixWorld(true);
  const from=end.getWorldPosition(new THREE.Vector3()).sub(b.getWorldPosition(new THREE.Vector3())).normalize();
  const to=new THREE.Vector3(...xyz).normalize().applyQuaternion(model.getWorldQuaternion(new THREE.Quaternion()));
  const world=b.getWorldQuaternion(new THREE.Quaternion()).premultiply(new THREE.Quaternion().setFromUnitVectors(from,to));
  b.quaternion.copy(b.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
  targets.push([b,b.quaternion.clone()]);
 };
 direction('upperarmr','forearmr',[-.12,.98,.15]);
 direction('forearmr','handr',[.05,.94,.33]);
 direction('upperarml','forearml',[.3,-.8,-.52]);
 direction('forearml','handl',[.15,-.92,.36]);
 direction('thighr','shinr',[-.08,-.25,.97]);
 direction('shinr','footr',[0,-.93,-.37]);
 direction('thighl','shinl',[.08,-.94,-.33]);
 direction('shinl','footl',[0,-.93,.37]);
 // Close the raised hand where articulated fingers are available.
 for(const finger of ['index','middle','ring','little'])for(const segment of ['01','02','03']){
  const b=bones.get(`${finger}${segment}r`);if(!b)continue;
  const axis=new THREE.Vector3(1,0,0).applyQuaternion(b.getWorldQuaternion(new THREE.Quaternion()).invert());
  b.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis,-1.15));targets.push([b,b.quaternion.clone()]);
 }
 for(const [b,q] of saved)b.quaternion.copy(q);model.updateMatrixWorld(true);
 let weight=0;const base=targets.map(([b])=>b.quaternion.clone());
 return {get weight(){return weight;},restore(){
  // AnimationMixer skips writes when its sampled value has not changed. Undo
  // our previous overlay first, including on the frame that lands or resets.
  targets.forEach(([b],i)=>b.quaternion.copy(base[i]));
 },apply(actor){
  const remaining=actor?.jumpTime||0;
  weight=remaining>0&&(!actor.state||actor.state==='active')&&!(actor.stun>0||actor.kickTime>0||actor.launchTime>0||actor.driving||actor.swing>0)
   ?Math.min(1,(JUMP_SECONDS-remaining)/.1,remaining/.1):0;
  targets.forEach(([b,q],i)=>{base[i].copy(b.quaternion);b.quaternion.slerp(q,weight);});
 }};
}

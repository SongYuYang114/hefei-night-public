import {createShoeSupportPose} from './shoe-support-pose.mjs';
import {createMarioJumpPose} from './mario-jump-pose.mjs';
import * as THREE from 'three';
export const SURVIVOR_NAMES=['白给','2980','猪脸','宋玉莹','长腿猪脸','欧比旺','Olo'];
export const SURVIVOR_ASSET_IDS=[0,1,2,3,4,5,6];
export const SURVIVOR_ASSETS=['baige','2980','zhulian','songyuying','longleg','obiwan','olo'].map(slug=>`./assets/survivor-${slug}.glb`);
export const SURVIVOR_CLIPS=['Idle','Walk','Run','HurtIdle','HurtWalk','Interact','Captured'];

export function createSurvivorRig(gltf){
 const raw=gltf.scene,model=new THREE.Group();model.add(raw);raw.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(raw),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 if(!Number.isFinite(size.y)||size.y<=0)throw new Error('逃生者模型尺寸无效');
 const scale=1.9/size.y;raw.scale.setScalar(scale);raw.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
 let skins=0;raw.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}if(o.isSkinnedMesh)skins++;});
 if(!skins)throw new Error('逃生者模型缺少蒙皮骨骼');
 const jumpPose=createMarioJumpPose(raw);
 const shoePose=createShoeSupportPose(raw);
 const mixer=new THREE.AnimationMixer(raw),actions={},kickBones=new Map();raw.updateMatrixWorld(true);
 raw.traverse(b=>{if(b.isBone)kickBones.set(b.name.replace(/[^a-zA-Z0-9_]/g,''),{bone:b,axis:new THREE.Vector3(1,0,0).applyQuaternion(b.getWorldQuaternion(new THREE.Quaternion()).invert())});});
 function kickPose(name,angle){const b=kickBones.get(name);if(b)b.bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(b.axis,angle));}
 for(const name of SURVIVOR_CLIPS){const clip=gltf.animations.find(c=>c.name===name);if(!clip)throw new Error(`逃生者缺少 ${name} 动画`);actions[name]=mixer.clipAction(clip);}
 let current='Idle',kickWeight=0;actions.Idle.play();
 return {model,mixer,actions,get current(){return current;},get kickWeight(){return kickWeight;},get jumpWeight(){return jumpPose.weight;},get shoeWeight(){return shoePose.weight;},headTop:()=>shoePose.headTop(),
  update(actor,dt){
   shoePose.restore();jumpPose.restore();
   const moving=actor.state==='active'&&actor.moving;
   const next=actor.jumpTime>0&&!(actor.stun>0||actor.launchTime>0||actor.kickTime>0)&&actor.state==='active'?'Idle':actor.state==='captured'?'Captured':(actor.interacting||actor.eating>0)?'Interact':actor.hp===1?(moving?'HurtWalk':'HurtIdle'):moving?(actor.running||actor.dash>0||actor.legRush>0?'Run':'Walk'):'Idle';
   if(next!==current){actions[current].fadeOut(.15);actions[next].reset().setEffectiveWeight(1).fadeIn(.15).play();current=next;}
   actions.Walk.setEffectiveTimeScale(1.3);actions.Run.setEffectiveTimeScale(actor.legRush>0?2.8:1.45);actions.HurtWalk.setEffectiveTimeScale(actor.legRush>0?2.5:1.25);mixer.update(dt);
   jumpPose.apply(actor);shoePose.apply(actor);
   kickWeight=0;if(actor.kickTime>0){const t=1-Math.min(1,actor.kickTime/.55),strength=Math.sin(Math.PI*t);kickWeight=strength;kickPose('thighR',-1.35*strength);kickPose('shinR',Math.max(0,.4-t)*2*strength);kickPose('footR',-.25*strength);kickPose('upper_armL',-.35*strength);kickPose('upper_armR',.25*strength);}
  },
  reset(){shoePose.restore();jumpPose.restore();mixer.stopAllAction();current='Idle';actions.Idle.reset().setEffectiveWeight(1).play();mixer.update(0);jumpPose.apply(null);shoePose.apply(null);}
 };
}

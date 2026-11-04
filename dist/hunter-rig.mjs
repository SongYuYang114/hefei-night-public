import {createShoeSupportPose} from './shoe-support-pose.mjs';
import {createMarioJumpPose} from './mario-jump-pose.mjs';
import * as THREE from 'three';
export {ELBOW_DURATION,ELBOW_IMPACT} from './core.mjs?v=car-horizontal-1';
export function createHunterRig(gltf,{vr=false}={}){
 const model=gltf.scene;
 // Export converts Blender -Y forward to glTF +Z. Gameplay heading 0 also means +Z.
 model.rotation.y=0;model.scale.setScalar(1.3);if(vr){model.scale.setScalar(1);model.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(model),size=b.getSize(new THREE.Vector3());model.scale.setScalar(2.18/size.y);model.position.y=-b.min.y*model.scale.y;}const headset=[];model.traverse(o=>{if(o.name==='VR_Headset')headset.push(o);});
 let skins=0;model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(vr)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.name.includes('blue violet')){m.color.set('#493893');m.emissive.set('#241847');m.emissiveIntensity=.25;m.metalness=.45;m.roughness=.18;}}if(o.isSkinnedMesh)skins++;});
 if(!skins)throw new Error('追杀者资产没有蒙皮骨骼');
 const jumpPose=createMarioJumpPose(model);
 const shoePose=createShoeSupportPose(model);
 const mixer=new THREE.AnimationMixer(model),actions={};
 for(const name of vr?['Idle','Walk','Elbow','Equip','Dance']:['Idle','Walk','Elbow']){const clip=gltf.animations.find(c=>c.name===name);if(!clip)throw new Error(`追杀者缺少 ${name} 动画`);actions[name]=mixer.clipAction(clip);}
 actions.Elbow.setLoop(THREE.LoopOnce,1);actions.Elbow.clampWhenFinished=true;
 let locomotion='Idle',striking=false;actions.Idle.play();
 const choose=name=>{if(name===locomotion)return;actions[locomotion].fadeOut(.09);actions[name].reset().setEffectiveWeight(1).fadeIn(.09).play();locomotion=name;};
 return {model,mixer,actions,get jumpWeight(){return jumpPose.weight;},get shoeWeight(){return shoePose.weight;},get vrVisible(){return headset.length>0&&headset.every(o=>o.visible);},headTop:()=>shoePose.headTop(),
  strike(){striking=true;choose('Elbow');},
  update(moving,swing,dt,actor){
   shoePose.restore();jumpPose.restore();for(const o of headset)o.visible=vr&&actor?.vrTime>0;
   if(swing>0){striking=true;choose('Elbow');const duration=actor?.elbowDuration||.8,impact=actor?.elbowImpact||.3,t=Math.max(0,duration-swing),clipTime=t<impact?.3*t/impact:.3+.5*(t-impact)/(duration-impact);actions.Elbow.paused=true;actions.Elbow.time=Math.min(.8,clipTime);}
   else{striking=false;const next=vr&&actor?.vrTime>0?(actor.vrElapsed<.7?'Equip':'Dance'):moving&&!(actor?.jumpTime>0)?'Walk':'Idle';choose(next);if(next==='Equip'){actions.Equip.paused=true;actions.Equip.time=actor.vrElapsed||0;}if(next==='Dance'){actions.Dance.paused=true;actions.Dance.time=Math.max(0,(actor.vrElapsed||0)-.7)%actions.Dance.getClip().duration;}}
   actions.Walk.setEffectiveTimeScale(1.25);mixer.update(dt);jumpPose.apply(actor);shoePose.apply(actor);
  },
  reset(){shoePose.restore();jumpPose.restore();mixer.stopAllAction();striking=false;locomotion='Idle';actions.Idle.reset().setEffectiveWeight(1).play();mixer.update(0);for(const o of headset)o.visible=false;jumpPose.apply(null);shoePose.apply(null);}
 };
}

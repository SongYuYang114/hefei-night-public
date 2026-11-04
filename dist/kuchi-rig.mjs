import * as THREE from 'three';
import {KUCHI_SQUAT_SECONDS} from './kuchi.mjs';
export function createKuchiRig(gltf){
 const raw=gltf.scene,model=new THREE.Group();model.add(raw);raw.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(raw),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 const scale=.8/size.y;raw.scale.setScalar(scale);raw.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
 let skins=0;raw.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}if(o.isSkinnedMesh)skins++;});if(!skins)throw Error('库奇模型缺少骨骼');
 const mixer=new THREE.AnimationMixer(raw),actions={};for(const name of ['Idle','Run','Squat']){const clip=gltf.animations.find(a=>a.name===name);if(!clip)throw Error('库奇缺少 '+name);actions[name]=mixer.clipAction(clip);}
 actions.Squat.setLoop(THREE.LoopOnce,1);actions.Squat.clampWhenFinished=true;let current='Idle';actions.Idle.play();
 return {model,mixer,actions,get current(){return current;},update(dog,dt){const next=dog.phase==='squatting'?'Squat':dog.moving?'Run':'Idle';if(next!==current){actions[current].fadeOut(.08);actions[next].reset().setEffectiveWeight(1).fadeIn(.08).play();current=next;}if(next==='Squat'){actions.Squat.setEffectiveTimeScale(0);actions.Squat.time=Math.max(0,Math.min(.99,(1-dog.phaseTime/KUCHI_SQUAT_SECONDS)));}actions.Run.setEffectiveTimeScale(1.7);mixer.update(dt);},reset(){mixer.stopAllAction();current='Idle';actions.Idle.reset().setEffectiveWeight(1).play();mixer.update(0);}};
}

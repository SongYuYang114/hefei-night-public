import * as T from 'three';
import {LEGENDARY_SCRATCH_SECONDS,LEGENDARY_SCRATCH_BEATS} from './hakimi.mjs';
import {cloneModel} from './character-preview.mjs';

export function createLegendaryCatVisual(gltf){
 if(!gltf)throw Error('传说橘猫模型未载入');
 const root=new T.Group();root.name='HakimiCat';const raw=cloneModel(gltf.scene);root.add(raw);raw.updateMatrixWorld(true);
 const bounds=new T.Box3().setFromObject(raw),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3()),scale=1.15/size.y;
 raw.scale.setScalar(scale);raw.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);raw.name='LegendaryOrangeCatOriginal';let skins=0;
 raw.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.userData.sharedCatGeometry=true;}if(o.isSkinnedMesh)skins++;});if(!skins)throw Error('传说橘猫缺少骨骼');
 const mixer=new T.AnimationMixer(raw),actions={};for(const name of ['Idle','Walk','Hiss','Groom','Recoil','Scratch']){const clip=gltf.animations.find(c=>c.name===name);if(!clip)throw Error('传说橘猫缺少动作 '+name);actions[name]=mixer.clipAction(clip);}
 actions.Scratch.setLoop(T.LoopOnce,1);actions.Scratch.clampWhenFinished=true;let swipeSerial=-1,swipeMask=0;
 actions.Recoil.setLoop(T.LoopOnce,1);actions.Recoil.clampWhenFinished=true;let current='Idle',time=0;actions.Idle.play();
 const gold=new T.MeshBasicMaterial({color:'#ffcd62',toneMapped:false}),fur=new T.MeshStandardMaterial({color:'#cf863e',roughness:1}),bristles=new T.Group(),hiss=new T.Group(),crown=new T.Group();root.add(bristles,hiss,crown);
 for(let i=0;i<10;i++){const m=new T.Mesh(new T.ConeGeometry(.055,.17,4),fur);m.position.set((i%2?-.14:.14),.35+i*.065,-.14);m.rotation.z=i%2?.5:-.5;bristles.add(m);}
 const band=new T.Mesh(new T.TorusGeometry(.22,.026,5,20),gold);band.rotation.x=Math.PI/2;crown.add(band);for(let i=0;i<5;i++){const m=new T.Mesh(new T.ConeGeometry(.055,.13,4),gold),a=i*Math.PI*2/5;m.position.set(Math.sin(a)*.21,.07,Math.cos(a)*.21);crown.add(m);}crown.position.y=1.33;
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=112;const ctx=canvas.getContext('2d');ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 54px Microsoft YaHei';ctx.lineWidth=9;ctx.strokeStyle='#1a2d35';ctx.fillStyle='#ffdb88';ctx.strokeText('传说橘猫',256,56);ctx.fillText('传说橘猫',256,56);const map=new T.CanvasTexture(canvas),label=new T.Sprite(new T.SpriteMaterial({map,transparent:true,depthWrite:false}));label.position.y=1.62;label.scale.set(1.25,.28,1);root.add(label);
 for(const side of [-1,1]){const g=new T.BufferGeometry().setFromPoints([[side*.35,1.05,.1],[side*.46,1.15,.1],[side*.39,1.22,.1],[side*.55,1.3,.1]].map(p=>new T.Vector3(...p)));hiss.add(new T.Line(g,new T.LineBasicMaterial({color:'#ffd36e'})));}
 const slashes=new T.Group();root.add(slashes);
 for(let i=0;i<3;i++){const stroke=new T.Group();for(let claw=0;claw<3;claw++){const points=[];for(let j=0;j<=12;j++){const t=j/12;points.push(new T.Vector3((t-.5)*1.8,.5+claw*.12+Math.sin(t*Math.PI)*.4,1+Math.sin(t*Math.PI)*.3));}const line=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:'#fff0c4',transparent:true,opacity:1,depthWrite:false}));stroke.add(line);}stroke.rotation.z=i%2?-.45:.45;slashes.add(stroke);}
 root.userData={bristles,hiss,slashes,getSwipeMask:()=>swipeMask,legendary:true,mixer,model:raw,skins,getClip:()=>current,disposeLegendary(){mixer.stopAllAction();mixer.uncacheRoot(raw);map.dispose();},poseLegendary(cat,dt){
  time+=dt;const angry=cat.phase==='warning'||cat.phase==='hissing'||cat.phase==='scratching',next=cat.phase==='scratching'?'Scratch':cat.phase==='recoil'?'Recoil':angry?'Hiss':cat.phase==='grooming'?'Groom':cat.moving?'Walk':'Idle';
  if(next!==current){actions[current].fadeOut(.1);actions[next].reset().setEffectiveWeight(1).fadeIn(.1).play();current=next;}
  actions.Walk.setEffectiveTimeScale(2.3);
  if(next==='Scratch'){mixer.update(dt);actions.Scratch.time=Math.max(0,Math.min(LEGENDARY_SCRATCH_SECONDS,LEGENDARY_SCRATCH_SECONDS-cat.phaseTime));mixer.update(0);}else mixer.update(dt);
  if(swipeSerial!==cat.scratchSerial){swipeSerial=cat.scratchSerial;swipeMask=0;}
  slashes.visible=cat.phase==='scratching';const elapsed=LEGENDARY_SCRATCH_SECONDS-cat.phaseTime;
  slashes.children.forEach((stroke,i)=>{const delta=elapsed-LEGENDARY_SCRATCH_BEATS[i];stroke.visible=slashes.visible&&delta>=-.08&&delta<.22;if(stroke.visible){swipeMask|=1<<i;stroke.children.forEach(line=>line.material.opacity=Math.max(0,1-Math.max(0,delta)/.22));}});
  root.position.set(cat.x,0,cat.z);root.rotation.y=cat.angle;root.scale.setScalar(1);root.visible=cat.phase!=='fighting';bristles.visible=angry;hiss.visible=angry;crown.rotation.y=time*.6;crown.position.y=1.33+Math.sin(time*2)*.025;
 }};root.userData.poseLegendary({x:0,z:0,angle:0,phase:'roaming',moving:false},0);return root;
}

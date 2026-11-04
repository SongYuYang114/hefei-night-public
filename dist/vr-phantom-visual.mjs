import * as T from 'three';
import {cloneModel} from './character-preview.mjs';
import {createHunterRig} from './hunter-rig.mjs?v=car-horizontal-1';

export function createVRPhantomVisual(gltf){
 const motion=createHunterRig({scene:cloneModel(gltf.scene),animations:gltf.animations},{vr:true});
 const root=new T.Group();root.name='VRDancePhantom';root.add(motion.model);
 motion.model.traverse(o=>{if(!o.isMesh)return;o.castShadow=false;o.receiveShadow=false;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.transparent=true;m.opacity=.52;m.depthWrite=false;m.color.lerp(new T.Color('#a898ff'),.22);if(m.emissive){m.emissive.set('#6654c8');m.emissiveIntensity=.45;}}});
 const ring=new T.Mesh(new T.RingGeometry(.65,.7,32),new T.MeshBasicMaterial({color:'#b9a4ff',side:T.DoubleSide,transparent:true,opacity:.5,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.035;root.add(ring);
 const canvas=document.createElement('canvas');canvas.width=384;canvas.height=80;const ctx=canvas.getContext('2d');ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 44px Microsoft YaHei';ctx.lineWidth=7;ctx.strokeStyle='#253347';ctx.fillStyle='#d9ccff';ctx.strokeText('嘉豪幻影',192,40);ctx.fillText('嘉豪幻影',192,40);
 const map=new T.CanvasTexture(canvas),label=new T.Sprite(new T.SpriteMaterial({map,transparent:true,depthWrite:false}));label.position.y=2.5;label.scale.set(1.5,.32,1);root.add(label);
 root.userData={motion,ring,pose(phantom,elapsed,dt){root.position.set(phantom.x,0,phantom.z);root.rotation.y=phantom.angle;motion.update(false,0,dt,{state:'active',vrTime:1,vrElapsed:.7+Math.max(0,elapsed-phantom.born)+phantom.phase});ring.material.opacity=.35+Math.sin((elapsed-phantom.born)*3)*.12;},dispose(){motion.mixer.stopAllAction();motion.mixer.uncacheRoot(motion.model);const materials=new Set(),skeletons=new Set();motion.model.traverse(o=>{if(o.skeleton)skeletons.add(o.skeleton);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])materials.add(m);});materials.forEach(m=>m.dispose());skeletons.forEach(s=>s.dispose());ring.geometry.dispose();ring.material.dispose();label.material.dispose();map.dispose();root.removeFromParent();}};
 return root;
}

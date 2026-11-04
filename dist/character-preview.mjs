import * as THREE from 'three';

export function cloneModel(source){
 const clone=source.clone(true),originals=[],copies=[];source.traverse(o=>originals.push(o));clone.traverse(o=>copies.push(o));
 const lookup=new Map(originals.map((o,i)=>[o,copies[i]]));
 originals.forEach((o,i)=>{const copy=copies[i];if(o.isSkinnedMesh){copy.skeleton=o.skeleton.clone();copy.skeleton.bones=o.skeleton.bones.map(b=>lookup.get(b));copy.bind(copy.skeleton,o.bindMatrix);}
  if(o.isMesh){copy.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();for(const m of Array.isArray(copy.material)?copy.material:[copy.material]){m.opacity=1;m.transparent=!!o.material?.transparent;}copy.castShadow=false;copy.receiveShadow=false;}
 });return clone;
}
export function createCharacterPreview(container){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.1,30);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x000000,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;container.appendChild(renderer.domElement);
 scene.add(new THREE.HemisphereLight('#d5e5ec','#4a4c3d',3));const key=new THREE.DirectionalLight('#ffe0b0',3);key.position.set(3,5,4);scene.add(key);const fill=new THREE.DirectionalLight('#87c8d2',1.3);fill.position.set(-4,2,3);scene.add(fill);
 const pivot=new THREE.Group();scene.add(pivot);let model,mixer,companionMixer,drag=null,height=1.9,modelWidth=1,lastWidth=0,lastHeight=0;
 function resize(){const r=container.getBoundingClientRect(),width=Math.max(1,r.width),height=Math.max(1,r.height);if(width===lastWidth&&height===lastHeight)return;lastWidth=width;lastHeight=height;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();}
 function frameCamera(front=false){const distance=Math.max(height*1.22,modelWidth*1.3/camera.aspect)/Math.tan(THREE.MathUtils.degToRad(17))/2;camera.position.set(front?0:height*.35,height*.56,distance);camera.lookAt(0,height*.52,0);}
 container.addEventListener('pointerdown',e=>{drag=e.clientX;container.setPointerCapture(e.pointerId);});container.addEventListener('pointermove',e=>{if(drag!==null){pivot.rotation.y+=(e.clientX-drag)*.01;container.dataset.angle=String(pivot.rotation.y);drag=e.clientX;}});for(const type of ['pointerup','pointercancel'])container.addEventListener(type,()=>drag=null);
 return {renderer,
  setModel(source,clip,companion){
   if(model){pivot.remove(model);model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});}
   const primary=cloneModel(source);primary.visible=true;primary.rotation.y=0;if(!clip)primary.traverse(o=>{if(o.type==='Group')o.rotation.set(0,0,0);});model=primary;companionMixer=null;container.dataset.companion='';
   if(companion){model=new THREE.Group();primary.position.x=-.35;model.add(primary);const pet=cloneModel(companion.model);pet.visible=true;pet.position.set(.8,0,.2);pet.rotation.set(0,0,0);const stars=pet.getObjectByName('KuchiStun');if(stars)stars.visible=false;model.add(pet);companionMixer=new THREE.AnimationMixer(pet);companionMixer.clipAction(companion.clip).play();container.dataset.companion='kuchi';}
   pivot.add(model);pivot.rotation.y=0;container.dataset.angle='0';model.updateMatrixWorld(true);
   const bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3());height=bounds.max.y-bounds.min.y;modelWidth=bounds.max.x-bounds.min.x;
   model.position.x-=center.x;model.position.y-=bounds.min.y;model.position.z-=center.z;
   mixer=clip?new THREE.AnimationMixer(primary):null;if(clip)mixer.clipAction(clip).play();resize();frameCamera();renderer.render(scene,camera);
  },
  update(dt){if(!model)return;resize();mixer?.update(dt);companionMixer?.update(dt);renderer.render(scene,camera);},
  portrait(){const previousRotation=pivot.rotation.y;const previousPosition=camera.position.clone();const oldSize=renderer.getSize(new THREE.Vector2()),oldRatio=renderer.getPixelRatio(),oldAspect=camera.aspect;
   pivot.rotation.y=0;renderer.setPixelRatio(1);renderer.setSize(480,720);camera.aspect=480/720;camera.updateProjectionMatrix();frameCamera(true);renderer.render(scene,camera);const data=renderer.domElement.toDataURL('image/png');
   pivot.rotation.y=previousRotation;renderer.setPixelRatio(oldRatio);renderer.setSize(oldSize.x,oldSize.y);camera.aspect=oldAspect;camera.position.copy(previousPosition);camera.lookAt(0,height*.52,0);camera.updateProjectionMatrix();return data;
  }
 };
}

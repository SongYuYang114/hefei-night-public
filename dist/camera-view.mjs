import * as T from 'three';
export const CAMERA_MIN_PITCH=-.12,CAMERA_MAX_PITCH=1.42,CAMERA_MIN_DISTANCE=4,CAMERA_MAX_DISTANCE=12;
export function orbitPosition(focus,yaw,pitch,distance){const horizontal=Math.cos(pitch)*distance;return new T.Vector3(focus.x+Math.sin(yaw)*horizontal,Math.max(.65,focus.y+Math.sin(pitch)*distance),focus.z+Math.cos(yaw)*horizontal);}
export function createCameraOcclusion(scene){
 scene.updateMatrixWorld(true);const entries=[],ray=new T.Ray(),direction=new T.Vector3(),hit=new T.Vector3(),side=new T.Vector3();
 scene.traverse(mesh=>{if(!mesh.isMesh||!mesh.geometry||mesh.userData.cameraIgnore)return;const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];if(materials.some(m=>m.transparent&&m.opacity<.9))return;const bounds=new T.Box3().setFromObject(mesh);if(bounds.max.y<.35||bounds.min.y>15)return;entries.push({mesh,bounds:bounds.expandByScalar(.08),original:mesh.material,materials,clones:null,factor:1,castShadow:mesh.castShadow});});
 let faded=0;
 function restore(entry){entry.mesh.material=entry.original;entry.mesh.castShadow=entry.castShadow;entry.factor=1;}
 return {update(camera,focus,dt,active=true){faded=0;direction.subVectors(focus,camera.position).normalize();side.crossVectors(direction,new T.Vector3(0,1,0)).normalize().multiplyScalar(.32);const targets=[focus,focus.clone().add(new T.Vector3(0,-.85,0)),focus.clone().add(side),focus.clone().sub(side)];
  for(const entry of entries){let blocks=false;if(active&&entry.mesh.visible)for(const target of targets){direction.subVectors(target,camera.position);const distance=direction.length();ray.set(camera.position,direction.normalize());if(entry.bounds.containsPoint(camera.position)||ray.intersectBox(entry.bounds,hit)&&hit.distanceTo(camera.position)<distance-.18){blocks=true;break;}}
   const goal=blocks?.16:1;entry.factor+=(goal-entry.factor)*(1-Math.exp(-Math.max(0,dt)*(blocks?18:8)));
   if(!active||!blocks&&entry.factor>.995){if(entry.mesh.material!==entry.original)restore(entry);continue;}
   if(entry.factor<.995){if(!entry.clones)entry.clones=entry.materials.map(m=>m.clone());entry.mesh.material=Array.isArray(entry.original)?entry.clones:entry.clones[0];entry.mesh.castShadow=false;entry.clones.forEach((m,i)=>{m.transparent=true;m.opacity=entry.materials[i].opacity*entry.factor;m.depthWrite=false;});faded++;}
  }
 },reset(){entries.forEach(restore);faded=0;},stats(){return {faded,total:entries.length};},dispose(){entries.forEach(e=>{restore(e);e.clones?.forEach(m=>m.dispose());});}};
}

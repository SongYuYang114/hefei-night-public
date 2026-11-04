import * as T from 'three';
export function createCarVisual(){
 const root=new T.Group(),wheels=[];
 const paint=new T.MeshStandardMaterial({color:'#a74334',roughness:.32,metalness:.55}),trim=new T.MeshStandardMaterial({color:'#26383d',roughness:.45,metalness:.7}),glass=new T.MeshStandardMaterial({color:'#7dacba',roughness:.15,metalness:.3,transparent:true,opacity:.38,depthWrite:false}),rubber=new T.MeshStandardMaterial({color:'#152125',roughness:.93}),hub=new T.MeshStandardMaterial({color:'#aebbb5',roughness:.3,metalness:.85});
 const light=new T.MeshStandardMaterial({color:'#fff1b5',emissive:'#ffe89c',emissiveIntensity:2}),tail=new T.MeshStandardMaterial({color:'#d77763',emissive:'#d34029',emissiveIntensity:1.5});
 function mesh(geo,mat,x,y,z){const o=new T.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;root.add(o);return o;}
 const box=(x,y,z,w,h,d,m)=>mesh(new T.BoxGeometry(w,h,d),m,x,y,z);
 box(0,.55,0,1.8,.45,3.5,paint);box(0,.82,1.08,1.72,.3,1.2,paint);box(0,.8,-1.2,1.72,.25,.9,paint);
 box(0,1.1,-.22,1.48,.72,1.62,glass);box(0,1.48,-.22,1.58,.12,1.72,paint);
 for(const x of [-.75,.75]){box(x,1.1,-.27,.05,.69,.08,trim);box(x,1.1,.6,.07,.69,.08,paint);box(x,1.1,-1.03,.07,.69,.08,paint);box(x,.77,-.28,.025,.1,1.42,paint);box(x*1.2,1.03,.47,.24,.13,.16,trim);}
 box(0,.44,1.78,1.8,.15,.12,trim);box(0,.44,-1.78,1.8,.15,.12,trim);box(0,.73,1.77,.65,.15,.04,trim);
 for(const x of [-.62,.62]){box(x,.76,1.78,.4,.2,.06,light);box(x,.73,-1.78,.34,.18,.05,tail);}
 for(const x of [-.92,.92])for(const z of [-1.11,1.08]){
  const wheel=mesh(new T.CylinderGeometry(.36,.36,.2,16),rubber,x,.36,z);wheel.rotation.z=Math.PI/2;wheels.push(wheel);
  const cap=mesh(new T.CylinderGeometry(.19,.19,.22,12),hub,x,.36,z);cap.rotation.z=Math.PI/2;wheels.push(cap);
 }
 // Emissive headlamps keep the scene light count constant when entering/leaving the car.
 const steering=mesh(new T.TorusGeometry(.18,.025,6,16),trim,.35,.98,.36);steering.rotation.x=-.35;
 const trail=new T.Mesh(new T.PlaneGeometry(1.75,4.8),new T.MeshBasicMaterial({color:'#e9aa65',transparent:true,opacity:.23,side:T.DoubleSide,depthWrite:false}));trail.rotation.x=-Math.PI/2;trail.position.set(0,.025,-3.65);root.add(trail);
 root.userData.wheels=wheels;root.userData.trail=trail;return root;
}
export function disposeCarVisual(root){const geos=new Set(),mats=new Set();root.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());root.removeFromParent();}

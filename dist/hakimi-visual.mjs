import {applyCatKickPose} from './cat-kick.mjs';
import * as T from 'three';
const COATS=['#dc9855','#e1d5bb','#69747d','#3f4651','#b99077'];
function add(parent,geometry,material,x=0,y=0,z=0){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;}
function line(parent,points,material){const g=new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p))),l=new T.Line(g,material);parent.add(l);return l;}
// Bake rigid face and fur pieces by material, keeping the animated jaw and paws separate.
function batchPieces(group,except=null){const batches=new Map();for(const m of [...group.children])if(m.isMesh&&m!==except){m.updateMatrix();const g=(m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone()).applyMatrix4(m.matrix);if(!batches.has(m.material))batches.set(m.material,[]);batches.get(m.material).push(g);m.geometry.dispose();group.remove(m);}
 for(const [material,parts] of batches){const merged=new T.BufferGeometry();for(const name of ['position','normal','uv']){const arrays=parts.map(g=>g.getAttribute(name)),data=new Float32Array(arrays.reduce((n,a)=>n+a.array.length,0));let offset=0;for(const a of arrays){data.set(a.array,offset);offset+=a.array.length;}merged.setAttribute(name,new T.BufferAttribute(data,arrays[0].itemSize));}parts.forEach(g=>g.dispose());add(group,merged,material);}
}
export function createCatVisual(coat=0){
 const root=new T.Group();root.name='HakimiCat';const fur=new T.MeshStandardMaterial({color:COATS[coat%5],roughness:1}),cream=new T.MeshStandardMaterial({color:'#f6ead3'}),pink=new T.MeshStandardMaterial({color:'#e8a6a4'}),ink=new T.MeshBasicMaterial({color:'#1a2730'}),white=new T.MeshBasicMaterial({color:'#fff2cf'}),wire=new T.LineBasicMaterial({color:'#20343b'});
 const body=new T.Group();root.add(body);body.position.y=.48;const torso=add(body,new T.SphereGeometry(1,12,8),fur);torso.scale.set(.27,.3,.51);
 const head=new T.Group();head.position.set(0,.29,.39);body.add(head);add(head,new T.SphereGeometry(.29,14,10),fur).scale.z=.86;
 for(const side of [-1,1]){const ear=add(head,new T.ConeGeometry(.14,.29,3),fur,side*.18,.25,-.015);ear.rotation.z=side*-.15;add(head,new T.ConeGeometry(.083,.18,3),pink,side*.18,.26,.035);add(head,new T.SphereGeometry(.068,8,6),white,side*.108,.055,.224);add(head,new T.SphereGeometry(.028,8,6),ink,side*.108,.055,.28).scale.y=1.5;add(head,new T.SphereGeometry(.1,10,6),cream,side*.085,-.065,.22);for(let i=0;i<3;i++)line(head,[[side*.12,-.055+i*.024,.28],[side*.4,-.1+i*.055,.19]],wire);}
 const nose=add(head,new T.ConeGeometry(.036,.045,3),pink,0,-.035,.31);nose.rotation.z=Math.PI;const mouth=add(head,new T.SphereGeometry(.065,8,6),ink,0,-.13,.24);mouth.scale.set(.7,.4,.2);
 const paws=[];for(const z of [-.3,.29])for(const x of [-.19,.19]){const pivot=new T.Group();pivot.position.set(x,-.08,z);body.add(pivot);add(pivot,new T.CylinderGeometry(.075,.09,.28,7),fur,0,-.12,0);add(pivot,new T.SphereGeometry(.1,8,6),cream,0,-.25,.035).scale.y=.65;paws.push(pivot);}
 const tail=new T.Group();tail.position.set(0,.05,-.43);body.add(tail);const tailMesh=add(tail,new T.TorusGeometry(.3,.068,6,12,Math.PI*1.2),fur,0,.21,-.04);tailMesh.rotation.y=Math.PI/2;
 const bristles=new T.Group();body.add(bristles);for(let i=0;i<9;i++){const tuft=add(bristles,new T.ConeGeometry(.07,.23,4),fur,(i%2?-.1:.1),.29,-.35+i*.08);tuft.rotation.z=(i%2?1:-1)*.4;}
 const hiss=new T.Group();root.add(hiss);for(const side of [-1,1])line(hiss,[[side*.38,1.05,.4],[side*.5,1.15,.4],[side*.43,1.2,.4],[side*.59,1.3,.4]],new T.LineBasicMaterial({color:'#ffd68a'}));
 batchPieces(head,mouth);batchPieces(bristles);root.userData={body,head,paws,tail,bristles,mouth,hiss,time:0};return root;
}
export function poseCatVisual(root,cat,dt=0){
 if(root.userData.poseLegendary){root.userData.poseLegendary(cat,dt);applyCatKickPose(root,cat);return;}
 const u=root.userData,flat=cat.phase==='flattened'||cat.phase==='kicked'&&cat.kickFlatTime>0;if(!flat)u.time+=dt;const h=cat.phase==='hissing'||cat.phase==='warning',g=cat.phase==='grooming',stride=cat.moving&&!flat?Math.sin(cat.travel*7)*.5:0;
 root.visible=cat.phase!=='fighting';root.position.set(cat.x,flat?.065:0,cat.z);root.rotation.y=cat.angle;root.scale.set(flat?1.45:1,flat?.045:1,flat?1.45:1);
 u.body.position.y=h?.54:.48+(cat.moving&&!flat?Math.abs(Math.sin(cat.travel*7))*.035:0);u.body.scale.set(h?1.13:1,h?1.13:1,1);
 u.head.rotation.set(g?.6+Math.sin(u.time*6)*.15:h?-.15:0,0,g?-.27:0);
 u.paws.forEach((paw,i)=>paw.rotation.set(g&&i===3?-2+Math.sin(u.time*6)*.12:stride*(i%3===0?1:-1),0,g&&i===3?-.45:0));
 u.tail.rotation.set(h?-.5:0,flat?0:Math.sin(u.time*(h?12:2))*(h?.15:.35),0);u.bristles.visible=h;u.hiss.visible=h;u.hiss.scale.setScalar(1+Math.sin(u.time*9)*.07);u.mouth.scale.y=h?1:g?.18:.4;applyCatKickPose(root,cat);
}
export function createCatFightVisual(){
 const root=new T.Group();root.name='HakimiComicFight';const dust=new T.MeshStandardMaterial({color:'#e7dfcf',roughness:1,flatShading:true}),ink=new T.MeshBasicMaterial({color:'#263b44',side:T.BackSide}),gold=new T.MeshBasicMaterial({color:'#ffd36a',toneMapped:false,side:T.DoubleSide}),white=new T.MeshBasicMaterial({color:'#fff9dd',toneMapped:false}),cloud=new T.Group();root.add(cloud);
 const puffs=[];for(let i=0;i<11;i++){const r=.48+(i%3)*.12,a=i*2.399,m=add(cloud,new T.IcosahedronGeometry(r,1),dust,Math.sin(a)*.8,.65+(i%3)*.28,Math.cos(a)*.65);add(m,m.geometry,ink).scale.setScalar(1.055);puffs.push(m);}
 const sparks=[];for(let i=0;i<7;i++){const shape=new T.Shape();for(let j=0;j<10;j++){const a=j*Math.PI/5,r=j%2?.1:.27;j?shape.lineTo(Math.sin(a)*r,Math.cos(a)*r):shape.moveTo(Math.sin(a)*r,Math.cos(a)*r);}shape.closePath();const star=add(root,new T.ShapeGeometry(shape),i%2?white:gold);sparks.push(star);}
 const strokes=new T.Group();root.add(strokes);for(let i=0;i<12;i++){const a=i*Math.PI/6;line(strokes,[[Math.sin(a)*1.2,.9,Math.cos(a)*1.2],[Math.sin(a)*1.65,1.05,Math.cos(a)*1.65]],new T.LineBasicMaterial({color:i%2?'#fff1ce':'#273a41'}));}
 const ring=add(root,new T.RingGeometry(2.93,3,64),new T.MeshBasicMaterial({color:'#ffc274',side:T.DoubleSide,transparent:true,opacity:.3,depthWrite:false}),0,.025,0);ring.rotation.x=-Math.PI/2;
 root.userData={cloud,puffs,sparks,strokes,ring,time:0};return root;
}
export function poseCatFightVisual(root,fight,dt=0,camera=null){
 const u=root.userData;u.time+=dt;const fighting=fight.phase==='fighting';root.visible=fight.phase!=='grooming';root.position.set(fight.x,0,fight.z);u.cloud.visible=fighting;u.strokes.visible=fighting;u.ring.material.opacity=fighting?.38:.12+(Math.sin(u.time*4)+1)*.07;
 u.cloud.rotation.y=u.time*4;u.cloud.position.y=Math.abs(Math.sin(u.time*14))*.15;
 u.puffs.forEach((p,i)=>p.scale.setScalar(1+Math.sin(u.time*13+i*2)*.14));u.strokes.rotation.y=-u.time*3;
 u.sparks.forEach((star,i)=>{star.visible=fighting;const a=u.time*2+i*Math.PI*2/7;star.position.set(Math.sin(a)*1.5,1+Math.abs(Math.sin(u.time*5+i))*.85,Math.cos(a)*1.5);if(camera)star.quaternion.copy(camera.quaternion);star.rotateZ(u.time*3+i);});
}
export function disposeCatVisual(root){root.userData.disposeLegendary?.();const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry&&!o.userData.sharedCatGeometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])materials.add(m);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();}

import * as T from 'three';
import {pigHeight} from './seeker-pig.mjs';
export function createPigVisual(){
 const root=new T.Group();root.name='ProfessionalPig';const pink=new T.MeshStandardMaterial({color:'#e9a7a6',roughness:.85}),snout=new T.MeshStandardMaterial({color:'#d98389'}),black=new T.MeshStandardMaterial({color:'#26282c'}),white=new T.MeshStandardMaterial({color:'#fff5e9'}),hooves=new T.MeshStandardMaterial({color:'#765459'});
 function box(x,y,z,w,h,d,m,parent=root){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 box(0,.65,-.05,.72,.55,1.05,pink);box(0,.79,.61,.64,.57,.6,pink);box(0,.69,.96,.39,.23,.16,snout);
 for(const x of [-.11,.11])box(x,.7,1.05,.055,.06,.015,black);
 for(const x of [-.23,.23]){box(x,.91,.92,.14,.12,.02,white);box(x,.9,.935,.065,.08,.018,black);const ear=box(x,1.16,.48,.19,.22,.13,pink);ear.rotation.z=x>0?-.18:.18;}
 const legs=[];for(const x of [-.24,.24])for(const z of [-.39,.29]){const leg=new T.Group();leg.position.set(x,.48,z);root.add(leg);box(0,-.15,0,.21,.34,.23,pink,leg);box(0,-.34,0,.22,.08,.24,hooves,leg);legs.push(leg);}
 const tail=new T.Mesh(new T.TorusGeometry(.11,.035,5,12,Math.PI*1.7),snout);tail.position.set(0,.76,-.64);root.add(tail);
 const marker=new T.Mesh(new T.RingGeometry(.52,.57,24),new T.MeshBasicMaterial({color:'#f3ae7b',transparent:true,opacity:.65,side:T.DoubleSide,depthWrite:false}));marker.rotation.x=-Math.PI/2;marker.position.y=.025;root.add(marker);root.userData.legs=legs;return root;
}
export function posePigVisual(root,pig){root.position.set(pig.x,pigHeight(pig),pig.z);root.rotation.set(pig.phase==='thrown'?-.22:0,pig.angle,0);root.userData.legs.forEach((leg,i)=>leg.rotation.x=pig.moving?Math.sin(pig.travel*7+(i===0||i===3?0:Math.PI))*.65:0);root.visible=pig.active;}
export function disposePigVisual(root){const geos=new Set(),mats=new Set();root.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)mats.add(o.material);});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());root.removeFromParent();}

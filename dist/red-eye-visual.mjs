import * as T from 'three';
export function createRedEyeVisual(){
 const root=new T.Group();root.name='RedEyeWoman';const skin=new T.MeshStandardMaterial({color:'#e4d8d2',roughness:.8}),dress=new T.MeshStandardMaterial({color:'#24202b',roughness:.76}),red=new T.MeshStandardMaterial({color:'#a91636',roughness:.6}),hair=new T.MeshStandardMaterial({color:'#11121a'}),sole=new T.MeshStandardMaterial({color:'#574a4a'}),eyes=new T.MeshBasicMaterial({color:'#ff243f',toneMapped:false});
 const add=(geo,material,parent,x,y,z)=>{const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;};const box=(p,x,y,z,w,h,d,m)=>add(new T.BoxGeometry(w,h,d),m,p,x,y,z);
 const body=new T.Group();root.add(body);body.name='RedEyeBody';
 add(new T.CylinderGeometry(.25,.36,.65,12),dress,body,0,1.24,0);const skirt=add(new T.ConeGeometry(.45,.72,16),dress,body,0,.87,0);skirt.rotation.y=Math.PI/16;box(body,0,1.19,.18,.045,.48,.04,red);box(body,0,1.38,.17,.42,.08,.06,red);
 add(new T.SphereGeometry(.13,12,8),skin,body,0,1.68,0);const head=add(new T.SphereGeometry(.235,20,16),skin,body,0,1.94,0);head.scale.z=.87;const cap=add(new T.SphereGeometry(.25,20,12,0,Math.PI*2,0,Math.PI*.55),hair,body,0,2.01,-.025);box(body,0,1.78,-.14,.47,.66,.2,hair);
 for(const x of [-.215,.215]){const strand=box(body,x,1.74,.025,.095,.62,.16,hair);strand.rotation.z=x>0?-.07:.07;}
 for(const x of [-.085,.085]){add(new T.SphereGeometry(.046,12,8),eyes,body,x,1.955,.19);const brow=box(body,x,2.025,.19,.1,.023,.04,hair);brow.rotation.z=x>0?.2:-.2;}box(body,0,1.85,.205,.085,.015,.015,red);
 const legs=[],arms=[],shoes=[];for(const side of [-1,1]){const leg=new T.Group();leg.position.set(side*.145,.76,0);body.add(leg);box(leg,0,-.32,0,.14,.64,.17,skin);const shoe=new T.Group();shoe.name=side===1?'ShoeOnHead':'OtherShoe';shoe.position.set(0,-.69,.055);leg.add(shoe);box(shoe,0,.04,0,.23,.12,.43,red);box(shoe,0,-.03,0,.25,.055,.46,sole);box(shoe,0,-.09,-.13,.06,.13,.055,red);legs.push(leg);shoes.push(shoe);
  const arm=new T.Group();arm.position.set(side*.31,1.51,0);body.add(arm);box(arm,0,-.2,0,.15,.43,.18,dress);box(arm,0,-.45,.025,.115,.18,.13,skin);arms.push(arm);}
 const ring=add(new T.RingGeometry(.47,.51,40),new T.MeshBasicMaterial({color:'#ed3153',transparent:true,opacity:.55,side:T.DoubleSide,depthWrite:false}),root,0,.012,0);ring.rotation.x=-Math.PI/2;
 root.userData={body,legs,arms,shoes,ring};return root;
}
export function poseRedEyeVisual(root,npc,victimHeadHeight=1.9,time=0){
 const {legs,arms,ring}=root.userData,holding=npc.phase==='holding';root.visible=npc.active;root.position.set(npc.x,holding?victimHeadHeight-.0125:0,npc.z);root.rotation.set(0,npc.angle,0);
 const stride=npc.moving?Math.sin(npc.travel*3.4)*.62:0;legs.forEach((leg,i)=>{leg.rotation.set(holding?0:stride*(i?1:-1),0,0);});arms.forEach((arm,i)=>arm.rotation.set(holding?-.3:stride*(i?-1:1),0,holding?(i?-.12:.12):0));ring.visible=!holding;
 if(holding){root.position.x-=Math.cos(npc.angle)*.145;root.position.z+=Math.sin(npc.angle)*.145;root.rotation.z=Math.sin(time*2)*.025;}
}
export function disposeRedEyeVisual(root){const geometry=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material)materials.add(o.material);});for(const g of geometry)g.dispose();for(const m of materials)m.dispose();root.removeFromParent();}

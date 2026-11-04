import * as T from 'three';
// Overlay the original skins; restore before AnimationMixer sampling so the
// restraint never leaves shoulders or the head stuck after release.
export function createShoeSupportPose(model){
 model.updateMatrixWorld(true);const bones=new Map(),targets=[];model.traverse(b=>{if(b.isBone)bones.set(b.name.replace(/[^a-z0-9]/gi,'').toLowerCase(),b);});const originals=new Map([...bones.values()].map(b=>[b,b.quaternion.clone()]));
 const direction=(name,child,xyz)=>{const b=bones.get(name),end=bones.get(child);if(!b||!end)return;model.updateMatrixWorld(true);const from=end.getWorldPosition(new T.Vector3()).sub(b.getWorldPosition(new T.Vector3())).normalize(),to=new T.Vector3(...xyz).normalize().applyQuaternion(model.getWorldQuaternion(new T.Quaternion())),world=b.getWorldQuaternion(new T.Quaternion()).premultiply(new T.Quaternion().setFromUnitVectors(from,to));b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(world));targets.push([b,b.quaternion.clone()]);};
 direction('upperarmr','forearmr',[.4,.78,.4]);direction('forearmr','handr',[-.18,.98,.08]);direction('upperarml','forearml',[-.4,.78,.4]);direction('forearml','handl',[.18,.98,.08]);direction('neck','head',[0,.98,-.2]);
 const head=bones.get('head');if(head){const axis=new T.Vector3(1,0,0).applyQuaternion(head.getWorldQuaternion(new T.Quaternion()).invert());head.quaternion.multiply(new T.Quaternion().setFromAxisAngle(axis,-.22));targets.push([head,head.quaternion.clone()]);}
 for(const [b,q] of originals)b.quaternion.copy(q);model.updateMatrixWorld(true);const base=targets.map(([b])=>b.quaternion.clone());let weight=0;
 return {get weight(){return weight;},restore(){targets.forEach(([b],i)=>b.quaternion.copy(base[i]));},apply(actor){weight=actor?.shoeTime>0&&actor.state==='active'?1:0;targets.forEach(([b,q],i)=>{base[i].copy(b.quaternion);if(weight)b.quaternion.slerp(q,weight);});},headTop(){if(!head)return null;head.updateWorldMatrix(true,false);const p=head.getWorldPosition(new T.Vector3());p.y+=.18;return p;}};
}

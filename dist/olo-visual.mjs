const prepared=new WeakSet();
export const OLO_OPACITY=1;
export function applyOloAppearance(model){
 if(prepared.has(model))return;prepared.add(model);
 const copies=new Map();
 model.traverse(o=>{if(!o.isMesh)return;o.castShadow=false;o.receiveShadow=false;const copy=m=>{if(!copies.has(m)){const c=m.clone();const glass=/lenses/i.test(c.name);c.opacity=glass?.1:OLO_OPACITY;if(glass)c.roughness=.12;c.transparent=glass;c.depthWrite=!glass;copies.set(m,c);}return copies.get(m);};o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);});
}

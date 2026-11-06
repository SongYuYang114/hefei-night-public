import {isOlo} from './olo.mjs';
export const LIMIT=39, REQUIRED=5, DURATION=null;
export const HUNTER_WARNING_DISTANCE=12;
export const repairDuration=(difficulty,ai=false)=>(difficulty==='easy'?50:difficulty==='hard'?80:64)*(ai?1.25:1);
export const ELBOW_DURATION=.8, ELBOW_IMPACT=.3;
export const CAR_SPEED=18,CAR_RANGE=24,CAR_HALF_WIDTH=.9,CAR_HALF_LENGTH=1.75;
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function blocked(x,z,obstacles,r=.48){return Math.abs(x)>LIMIT||Math.abs(z)>LIMIT||obstacles.some(o=>Math.abs(x-o.x)<o.w/2+r&&Math.abs(z-o.z)<o.d/2+r);}
export function move(actor,dx,dz,obstacles){const sx=actor.x,sz=actor.z;const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.3));for(let i=0;i<steps;i++){if(!blocked(actor.x+dx/steps,actor.z,obstacles))actor.x+=dx/steps;if(!blocked(actor.x,actor.z+dz/steps,obstacles))actor.z+=dz/steps;}return Math.hypot(actor.x-sx,actor.z-sz);}
export function lineClear(a,b,obs){const d=distance(a,b),n=Math.ceil(d/.4);for(let i=1;i<n;i++){const t=i/n;if(blocked(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,obs,.15))return false;}return true;}
export function findPath(a,b,obs){
 const start=[Math.round(a.x),Math.round(a.z)],goal=[Math.round(clamp(b.x,-LIMIT+1,LIMIT-1)),Math.round(clamp(b.z,-LIMIT+1,LIMIT-1))];
 if(blocked(goal[0],goal[1],obs,.6)){let best=null;for(let r=1;r<=4&&!best;r++)for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++){const p=[goal[0]+x,goal[1]+z];if(!blocked(...p,obs,.6)&&(!best||Math.hypot(x,z)<best.d))best={p,d:Math.hypot(x,z)};}if(!best)return [];goal[0]=best.p[0];goal[1]=best.p[1];}
 const key=(x,z)=>x+','+z,open=[{p:start,g:0,f:0}],seen=new Map([[key(...start),0]]),parents=new Map();let final=null;
 for(let iterations=0;open.length&&iterations<(2*LIMIT+1)**2+10;iterations++){
  let bi=0;for(let i=1;i<open.length;i++)if(open[i].f<open[bi].f)bi=i;const cur=open.splice(bi,1)[0], [x,z]=cur.p,k=key(x,z);if(seen.get(k)<cur.g)continue;
  if(x===goal[0]&&z===goal[1]){final=cur.p;break;}
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
   const nx=x+dx,nz=z+dz;if(blocked(nx,nz,obs,.6)||(dx&&dz&&(blocked(x+dx,z,obs,.6)||blocked(x,z+dz,obs,.6))))continue;
   const nk=key(nx,nz),g=cur.g+Math.hypot(dx,dz);if(g>=(seen.get(nk)??Infinity))continue;seen.set(nk,g);parents.set(nk,cur.p);open.push({p:[nx,nz],g,f:g+Math.hypot(nx-goal[0],nz-goal[1])});
  }
 }
 if(!final)return [];const path=[];let p=final;while(key(...p)!==key(...start)){path.push({x:p[0],z:p[1]});p=parents.get(key(...p));if(!p)return [];}return path.reverse();
}
export function hit(hunter,survivors,obstacles){
 const candidates=survivors.filter(s=>!isOlo(s)&&s.state==='active'&&s.invincible<=0&&distance(hunter,s)<3.1&&lineClear(hunter,s,obstacles));
 candidates.sort((a,b)=>distance(hunter,a)-distance(hunter,b));
 return candidates.find(s=>{const angle=Math.atan2(s.x-hunter.x,s.z-hunter.z);return Math.cos(angle-hunter.angle)>.2;})||null;
}
export function outcome(survivors,time){const escaped=survivors.filter(s=>s.state==='escaped').length,resolved=survivors.length>0&&survivors.every(s=>['escaped','eliminated','captured'].includes(s.state));if(escaped>=3)return 'survivor';if(survivors.some(s=>s.state==='captured'&&s.item==='yzm'))return null;const capturable=survivors.filter(s=>!isOlo(s));if(capturable.some(s=>s.state==='captured')&&capturable.every(s=>['captured','escaped'].includes(s.state)))return 'hunter';if(resolved)return escaped===2?'draw':'hunter';return null;}
export function carBlocked(car,obstacles){
 const f={x:Math.sin(car.angle),z:Math.cos(car.angle)},r={x:f.z,z:-f.x};
 const rx=CAR_HALF_LENGTH*Math.abs(f.x)+CAR_HALF_WIDTH*Math.abs(r.x),rz=CAR_HALF_LENGTH*Math.abs(f.z)+CAR_HALF_WIDTH*Math.abs(r.z);
 if(Math.abs(car.x)+rx>LIMIT||Math.abs(car.z)+rz>LIMIT)return true;
 return obstacles.some(o=>{const x=o.x-car.x,z=o.z-car.z,hw=o.w/2,hd=o.d/2;
  return Math.abs(x)<hw+rx&&Math.abs(z)<hd+rz&&Math.abs(x*f.x+z*f.z)<CAR_HALF_LENGTH+hw*Math.abs(f.x)+hd*Math.abs(f.z)&&Math.abs(x*r.x+z*r.z)<CAR_HALF_WIDTH+hw*Math.abs(r.x)+hd*Math.abs(r.z);
 });
}
export function createCarRush(actor){return {x:actor.x,z:actor.z,origin:{x:actor.x,z:actor.z},angle:actor.angle,travel:0,active:true,hitIds:new Set()};}
export function stepCarRush(car,dt,obstacles,survivors){
 const hits=[];if(!car.active)return {hits,blocked:false};const fx=Math.sin(car.angle),fz=Math.cos(car.angle);
 let left=Math.min(CAR_SPEED*dt,CAR_RANGE-car.travel),collision=false;
 function collect(){for(const s of survivors){if(isOlo(s)||s.state!=='active'||s.invincible>0||car.hitIds.has(s.id))continue;
  // A summoned vehicle damages only the forward path, not people behind its caster.
  if((s.x-car.origin.x)*fx+(s.z-car.origin.z)*fz<.45)continue;
  const dx=s.x-car.x,dz=s.z-car.z;
  if(Math.abs(dx*fz-dz*fx)<=CAR_HALF_WIDTH+.4&&Math.abs(dx*fx+dz*fz)<=CAR_HALF_LENGTH+.4){car.hitIds.add(s.id);hits.push(s);}
 }}
 if(carBlocked(car,obstacles)){car.active=false;return {hits,blocked:true};}collect();
 while(left>1e-6){const step=Math.min(.15,left),next={...car,x:car.x+fx*step,z:car.z+fz*step};
  if(carBlocked(next,obstacles)){car.active=false;collision=true;break;}
  car.x=next.x;car.z=next.z;car.travel+=step;left-=step;collect();
 }
 if(car.travel>=CAR_RANGE-1e-6)car.active=false;
 return {hits,blocked:collision};
}

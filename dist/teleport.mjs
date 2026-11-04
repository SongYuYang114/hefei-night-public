import {immuneToNegative} from './vr-hunter.mjs';
import {blocked,lineClear,distance,HUNTER_WARNING_DISTANCE,carBlocked} from './core.mjs';
export const TELEPORT_COOLDOWN=40;
const present=a=>a&&['active','captured'].includes(a.state);
export function nearbyTeleportPoint(target,actors,obstacles,fixtures,random,radii,accept=()=>true){
 const offset=random()*Math.PI*2,blockers=[...obstacles,...fixtures];
 for(const radius of radii)for(let i=0;i<48;i++){
  const angle=offset+i*Math.PI*2/48,p={x:target.x+Math.sin(angle)*radius,z:target.z+Math.cos(angle)*radius};
  if(!accept(p)||blocked(p.x,p.z,blockers,.6)||!lineClear(target,p,obstacles)||actors.some(a=>present(a)&&distance(a,p)<1.05))continue;
  return p;
 }
 return null;
}
function relocate(actor,point){
 Object.assign(actor,point,{path:[],repath:0,destination:null,moving:false,interacting:false,launchTime:0});
}
// The host supplies the RNG and computes the whole plan before changing any state.
export function teleportToTeammate(actor,hunter,{survivors=[],obstacles=[],fixtures=[],random=Math.random}={}){
 const teammates=survivors.filter(s=>s!==actor&&s.id!==actor.id&&present(s));
 if(!teammates.length)return {ok:false,reason:'no-teammates'};
 const teammate=teammates[Math.min(teammates.length-1,Math.floor(random()*teammates.length))];
 const rollBringHunter=random()<.5,bringHunter=rollBringHunter&&!immuneToNegative(hunter);
 const to=nearbyTeleportPoint(teammate,[...survivors.filter(s=>s!==actor),hunter],obstacles,fixtures,random,[1.7,2.1,2.3]);
 if(!to)return {ok:false,reason:'no-safe-landing'};
 const hunterTo=bringHunter?nearbyTeleportPoint(to,[...survivors.filter(s=>s!==actor),{...actor,...to}],obstacles,fixtures,random,[HUNTER_WARNING_DISTANCE-.5,HUNTER_WARNING_DISTANCE-.8,HUNTER_WARNING_DISTANCE-.2],p=>!hunter.driving||!carBlocked({...hunter,...p},[...obstacles,...fixtures])):null;
 if(bringHunter&&!hunterTo)return {ok:false,reason:'no-safe-landing'};
 const result={ok:true,type:'teleport',slot:actor.id,teammateSlot:teammate.id,from:{x:actor.x,z:actor.z},to};
 relocate(actor,to);actor.cooldown=TELEPORT_COOLDOWN;
 if(bringHunter){
  result.hunterFrom={x:hunter.x,z:hunter.z};result.hunterTo=hunterTo;
  relocate(hunter,hunterTo);Object.assign(hunter,{memory:null,patrol:null,swing:0,hitDelay:0,strikeAngle:hunter.angle});
 }
 return result;
}

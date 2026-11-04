import {carBlocked,clamp,lineClear} from './core.mjs';
export const DRIVE_SECONDS=5,DRIVE_COOLDOWN=10,DRIVE_SPEED=10,DRIVE_WALL_BOOST=5,DRIVE_TURN_RATE=2.4;
export const CAR_AIR_SECONDS=1.8,CAR_AIR_HEIGHT=7.5,CAR_CRASH_STUN=5;
export function resetDrive(a){Object.assign(a,{driving:false,drivePhase:'none',driveTime:0,driveAirTime:0,driveAirTotal:0,driveVX:0,driveVZ:0,driveSteer:0,driveTravel:0,driveBounces:0,driveWallBoost:false,driveLastX:a.x,driveLastZ:a.z});}
export function beginDrive(a){if(a.driving||a.cooldown>0||a.stun>0||a.shoeTime>0||a.state!=='active')return false;resetDrive(a);Object.assign(a,{driving:true,drivePhase:'driving',driveTime:DRIVE_SECONDS,cooldown:DRIVE_COOLDOWN,swing:0,hitDelay:0,moving:true});return true;}
export const driveSpeed=a=>DRIVE_SPEED+(a.driveWallBoost?DRIVE_WALL_BOOST:0);
export const driveSteer=input=>clamp((input.keys?.a?1:0)-(input.keys?.d?1:0)-(input.touch?.x||0),-1,1);
export const driveHeight=a=>a.driving&&a.drivePhase==='airborne'?Math.sin(Math.PI*clamp(1-a.driveAirTime/CAR_AIR_SECONDS,0,1))*CAR_AIR_HEIGHT:0;
export const driveSpin=a=>a.driving&&a.drivePhase==='airborne'?clamp(1-a.driveAirTime/CAR_AIR_SECONDS,0,1)*Math.PI*4:0;
export function launchDrivenCar(a,random=Math.random){if(!a.driving||a.drivePhase!=='driving')return false;const angle=random()*Math.PI*2,range=20+random()*8;Object.assign(a,{drivePhase:'airborne',driveTime:0,driveAirTime:CAR_AIR_SECONDS,driveAirTotal:CAR_AIR_SECONDS,driveVX:Math.sin(angle)*range/CAR_AIR_SECONDS,driveVZ:Math.cos(angle)*range/CAR_AIR_SECONDS,launchTime:0,moving:false,swing:0,hitDelay:0,stun:Math.max(a.stun||0,CAR_AIR_SECONDS)});return true;}
export function stepDrivenCar(a,steer,dt,obstacles=[],targets=[],hitIds=new Set(),hazards=[],catTargets=[]){
 const result={hits:[],crushed:[],catHits:[],legendaryHits:[],bounces:0,landed:false,ended:false},catHitIds=new Set(),orderedCats=[...catTargets].sort((a,b)=>Number(!!b.cat.legendary)-Number(!!a.cat.legendary));if(!a.driving||dt<=0)return result;
 if(a.drivePhase==='airborne'){
  let left=Math.min(dt,a.driveAirTime);while(left>1e-7){const step=Math.min(.008,left),dx=a.driveVX*step,dz=a.driveVZ*step;if(!carBlocked({...a,x:a.x+dx},obstacles))a.x+=dx;if(!carBlocked({...a,z:a.z+dz},obstacles))a.z+=dz;left-=step;}
  a.driveAirTime=Math.max(0,a.driveAirTime-dt);a.moving=false;if(a.driveAirTime<=1e-7){a.driveAirTime=0;a.driving=false;a.drivePhase='crashed';a.stun=Math.max(a.stun||0,CAR_CRASH_STUN);a.moving=false;result.landed=true;}return result;
 }
 a.driveLastX=a.x;a.driveLastZ=a.z;const elapsed=Math.min(dt,a.driveTime);a.driveTime=Math.max(0,a.driveTime-dt);
 // Constant forward speed. Neither idle controls, S, a menu nor stun can brake it.
 let left=elapsed;while(left>1e-7){const step=Math.min(left,.006),old=a.angle,turned=old+(a.stun>0?0:clamp(steer,-1,1))*DRIVE_TURN_RATE*step;
  if(!carBlocked({...a,angle:turned},obstacles))a.angle=turned;
  const speed=driveSpeed(a);let dx=Math.sin(a.angle)*speed*step,dz=Math.cos(a.angle)*speed*step;
  if(carBlocked({...a,x:a.x+dx,z:a.z+dz},obstacles)){
   const bx=carBlocked({...a,x:a.x+dx},obstacles),bz=carBlocked({...a,z:a.z+dz},obstacles);
   if(bx&&!bz)dx=-dx;else if(bz&&!bx)dz=-dz;else{dx=-dx;dz=-dz;}
   const reflected=Math.atan2(dx,dz);a.driveWallBoost=true;
   // A corner can be clear for the old hull and occupied after reflection.
   // Commit position AND heading together. A 180-degree rebound preserves the
   // exact old hull and safely retraces the approach when the normal rebound
   // would rotate the car into the obstacle.
   let resolved=null;
   for(const heading of [reflected,a.angle+Math.PI]){
    for(const fraction of [1,.5,.25,.125,.0625,.03125]){
     const travel=driveSpeed(a)*step*fraction,p={...a,angle:heading,x:a.x+Math.sin(heading)*travel,z:a.z+Math.cos(heading)*travel};
     if(!carBlocked(p,obstacles)){resolved=p;break;}
    }
    if(resolved)break;
   }
   if(resolved){a.angle=resolved.angle;dx=resolved.x-a.x;dz=resolved.z-a.z;}
   else{dx=0;dz=0;}
   a.driveBounces=(a.driveBounces||0)+1;result.bounces++;
  }
  if(!carBlocked({...a,x:a.x+dx,z:a.z+dz},obstacles)){a.x+=dx;a.z+=dz;a.driveTravel=(a.driveTravel||0)+Math.hypot(dx,dz);}
  const fx=Math.sin(a.angle),fz=Math.cos(a.angle);
  for(const target of orderedCats){if(target.cat.phase==='flattened'||catHitIds.has(target.cat.id))continue;const x=target.x-a.x,z=target.z-a.z;if(Math.abs(x*fz-z*fx)<=.95+target.radius&&Math.abs(x*fx+z*fz)<=1.85+target.radius&&lineClear(a,target,obstacles)){catHitIds.add(target.cat.id);if(target.cat.legendary){launchDrivenCar(a);result.legendaryHits.push(target.cat);return result;}result.catHits.push(target.cat);}}
  for(const s of targets){if(s.state!=='active'||s.invincible>0||hitIds.has(s.id))continue;const x=s.x-a.x,z=s.z-a.z;if(Math.abs(x*fz-z*fx)<=1.3&&Math.abs(x*fx+z*fz)<=2.15&&lineClear(a,s,obstacles)){hitIds.add(s.id);result.hits.push(s);}}
  for(const hazard of hazards){if(!hazard.active||hazard.phase==='thrown'&&hazard.throwTime>.08)continue;const x=hazard.x-a.x,z=hazard.z-a.z;if(Math.abs(x*fz-z*fx)<=1.65&&Math.abs(x*fx+z*fz)<=2.45&&lineClear(a,hazard,obstacles)){launchDrivenCar(a);result.crushed.push(hazard);return result;}}
  left-=step;
 }
 a.moving=true;if(a.driveTime<=1e-7){a.driveTime=0;a.driving=false;a.drivePhase='finished';a.moving=false;result.ended=true;}return result;
}

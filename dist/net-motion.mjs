import {stepDrivenCar,driveSteer} from './drive-car.mjs';
import {oloSpeedMultiplier} from './olo.mjs';
import {move,clamp} from './core.mjs';
import {consumeJumpInput} from './jump.mjs';
import {kuchiSpeedFactor} from './kuchi.mjs';
export const INPUT_STEP=.02;
export const MAX_INPUT_BACKLOG=.12;
export function remoteFallback(input,age){
 if(!input||age>=2500)return null;
 if(age<600)return input;
 // Movement times out quickly; an interaction hold tolerates a brief retry.
 return {...input,keys:{f:input.keys?.f===true,q:input.keys?.q===true},touch:{x:0,z:0}};
}
export function moveControlled(actor,input,dt,obstacles,isHunter=false){
 actor.moving=false;if(actor.shoeTime>0){actor.jumpAck=Math.max(actor.jumpAck||0,input.jumpPress||0);actor.kickAck=Math.max(actor.kickAck||0,input.fPress||0);return;}consumeJumpInput(actor,input);if(isHunter&&actor.driving){stepDrivenCar(actor,driveSteer(input),dt,obstacles);return;}if(actor.state!=='active'||actor.stun>0||actor.kickTime>0)return;
 const keys=input.keys||{},touch=input.touch||{x:0,z:0};let dx=(keys.d?1:0)-(keys.a?1:0)+touch.x,dz=(keys.s?1:0)-(keys.w?1:0)+touch.z;
 const n=Math.hypot(dx,dz);if(n<=0)return;dx/=Math.max(1,n);dz/=Math.max(1,n);
 const yaw=input.yaw||0,mx=dx*Math.cos(yaw)+dz*Math.sin(yaw),mz=-dx*Math.sin(yaw)+dz*Math.cos(yaw);
 let speed=isHunter?4.55:3.7;if(actor.dash>0)speed=8.2;if(actor.slow>0)speed*=.63;if(isHunter&&actor.swing>0)speed*=.4;if(!isHunter&&actor.legRush>0)speed*=4;if(!isHunter)speed*=kuchiSpeedFactor(actor);
 if(!isHunter)speed*=oloSpeedMultiplier(actor);
 actor.moving=move(actor,mx*speed*dt,mz*speed*dt,obstacles)>.001;actor.angle=Math.atan2(mx,mz);
}
function replayStep(actor,command,obstacles,isHunter,carObstacles=obstacles){
 moveControlled(actor,command.input,command.dt,actor.driving?carObstacles:obstacles,isHunter);
 for(const key of ['kickTime','dash','slow','kuchiSlow','jumpTime','jumpCooldown','swing','legRush','stun'])if(actor[key]>0)actor[key]=Math.max(0,actor[key]-command.dt);
}
export class LocalPrediction{
 constructor(obstacles=[],isHunter=false,carObstacles=obstacles){this.carObstacles=carObstacles;this.obstacles=obstacles;this.isHunter=isHunter;this.pending=[];this.sequence=0;this.lastSent=0;this.sentAt=new Map();this.lastAck=0;this.error={x:0,z:0};this.rtt=0;this.actor=null;this.lastAuth=null;}
 reset(actor){this.pending=[];this.sequence=0;this.lastSent=0;this.sentAt.clear();this.lastAck=0;this.error={x:0,z:0};this.actor={...actor};this.lastAuth={...actor};}
 push(input,dt,now){
  if(!this.actor)return null;if(this.pending.length>=100)this.pending.shift();
  const command={seq:++this.sequence,dt,input:{keys:{...input.keys},yaw:input.yaw,touch:{...input.touch},jumpPress:input.jumpPress||0,fPress:input.fPress||0},created:now};this.pending.push(command);this.sentAt.set(command.seq,now);if(this.sentAt.size>2000)this.sentAt.delete(this.sentAt.keys().next().value);replayStep(this.actor,command,this.obstacles,this.isHunter,this.carObstacles);return command;
 }
 // Repeat up to 600 ms of unconfirmed commands to survive burst loss.
 // The host settles time already simulated by fallback instead of moving twice.
 outgoing(){const commands=this.pending.slice(-30);if(commands.length)this.lastSent=commands.at(-1).seq;return commands.map(({seq,dt,input})=>({seq,dt,...input}));}
 reconcile(authoritative,now){
  const ack=authoritative.inputAck||0;if(ack>this.lastAck){const created=this.sentAt.get(ack);if(created!==undefined){const sample=now-created;this.rtt=this.rtt?this.rtt*.8+sample*.2:sample;}this.lastAck=ack;for(const seq of this.sentAt.keys()){if(seq>ack)break;this.sentAt.delete(seq);}}
  this.pending=this.pending.filter(c=>c.seq>ack);const old=this.actor,next={...authoritative};
  if(this.isHunter&&next.driving){
   // Autopilot advances on host wall time, independently of delayed input ACKs.
   // Extrapolate only the estimated snapshot transit, rather than the whole ACK backlog.
   let lag=Math.min(.4,(this.rtt||0)/2000),commands=[];for(let i=this.pending.length-1;i>=0&&lag>0;i--){const c=this.pending[i],dt=Math.min(lag,c.dt);commands.unshift({...c,dt});lag-=dt;}for(const c of commands)replayStep(next,c,this.obstacles,true,this.carObstacles);
  }else{let lead=Math.max(0,Math.min(.6,authoritative.inputLead||0));for(const command of this.pending){const covered=Math.min(lead,command.dt);lead-=covered;if(command.dt-covered>1e-8)replayStep(next,{...command,dt:command.dt-covered},this.obstacles,this.isHunter,this.carObstacles);}}
  const snap=!old||!this.lastAuth||authoritative.state!==this.lastAuth.state||(authoritative.shoeNpcId||0)!==(this.lastAuth.shoeNpcId||0)||Math.hypot(authoritative.x-this.lastAuth.x,authoritative.z-this.lastAuth.z)>Math.max(4,authoritative.driving?50*Math.max(0,(authoritative.inputClock||0)-(this.lastAuth.inputClock||0))+.5:4)||authoritative.launchTime>this.lastAuth.launchTime+.15||authoritative.drivePhase!==this.lastAuth.drivePhase;
  if(snap)this.error={x:0,z:0};else{this.error.x+=old.x-next.x;this.error.z+=old.z-next.z;if(Math.hypot(this.error.x,this.error.z)>2)this.error={x:0,z:0};}
  this.actor=next;this.lastAuth={...authoritative};
 }
 pose(dt){if(!this.actor)return null;const decay=Math.exp(-18*dt);this.error.x*=decay;this.error.z*=decay;return {...this.actor,x:this.actor.x+this.error.x,z:this.actor.z+this.error.z};}
}
const angleLerp=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
export class MotionTrack{
 constructor(delay=.10){this.delay=delay;this.samples=[];this.clock=null;this.received=0;}
 push(time,pose,now){
  const last=this.samples.at(-1);if(last&&time<=last.time)return;
  const snap=!last||pose.state!==last.pose.state||pose.kickSerial!==last.pose.kickSerial||Math.hypot(pose.x-last.pose.x,pose.z-last.pose.z)>Math.max(3,(pose.driving||last.pose.driving?60:20)*(time-last.time))||pose.launchTime>(last.pose.launchTime||0)+.15;
  if(snap){this.samples=[];this.clock=time-this.delay;}
  this.samples.push({time,pose:{...pose}});if(this.samples.length>32)this.samples.shift();this.received=now;
 }
 pose(dt,now){
  const newest=this.samples.at(-1);if(!newest)return null;
  this.clock=Math.max(this.clock??newest.time,newest.time-this.delay);this.clock=Math.min(this.clock+dt,newest.time+Math.min(.10,Math.max(0,(now-this.received)/1000)));
  const target=Math.min(this.clock,newest.time+Math.min(.10,Math.max(0,(now-this.received)/1000)));
  for(let i=1;i<this.samples.length;i++){const b=this.samples[i],a=this.samples[i-1];if(target<=b.time){const t=clamp((target-a.time)/(b.time-a.time),0,1);return {...b.pose,x:a.pose.x+(b.pose.x-a.pose.x)*t,z:a.pose.z+(b.pose.z-a.pose.z)*t,angle:angleLerp(a.pose.angle||0,b.pose.angle||0,t),...(a.pose.state==='kicked'&&b.pose.state==='kicked'?{phaseTime:a.pose.phaseTime+(b.pose.phaseTime-a.pose.phaseTime)*t}:{}),...(a.pose.jumpSerial===b.pose.jumpSerial?{jumpTime:(a.pose.jumpTime||0)+((b.pose.jumpTime||0)-(a.pose.jumpTime||0))*t}:{}),...(a.pose.drivePhase===b.pose.drivePhase&&b.pose.driveAirTime>0?{driveAirTime:a.pose.driveAirTime+(b.pose.driveAirTime-a.pose.driveAirTime)*t}:{})};}}
  const previous=this.samples.at(-2);if(previous&&newest.pose.moving!==false&&newest.pose.state!=='captured'&&(newest.pose.stun||0)<=0){const interval=newest.time-previous.time,extra=clamp(target-newest.time,0,.10);let vx=(newest.pose.x-previous.pose.x)/interval,vz=(newest.pose.z-previous.pose.z)/interval;const speed=Math.hypot(vx,vz);const cap=newest.pose.driving?45:20;if(speed>cap){vx*=cap/speed;vz*=cap/speed;}return {...newest.pose,x:newest.pose.x+vx*extra,z:newest.pose.z+vz*extra};}
  return {...newest.pose};
 }
}
export class InputQueue{
 constructor(){this.queue=[];this.lastSeq=0;this.ack=0;this.clock=0;this.credit=0;this.dropped=0;this.speculativeTime=0;}
 get queuedSeconds(){return this.queue.reduce((sum,c)=>sum+c.dt,0);}
 // A key edge is not proof that earlier movement was simulated.
 control(seq){if(!Number.isSafeInteger(seq)||seq<0)return;}
 receive(commands){
  for(const c of commands){
   if(!Number.isSafeInteger(c.seq)||c.seq<=this.lastSeq||!Number.isFinite(c.dt)||c.dt<=0||c.dt>.04)continue;
   const gap=c.seq-this.lastSeq-1;if(gap>0)this.speculativeTime=Math.max(0,this.speculativeTime-gap*INPUT_STEP);
   const covered=Math.min(this.speculativeTime,c.dt);this.speculativeTime=Math.max(0,this.speculativeTime-covered);this.lastSeq=c.seq;
   if(c.dt-covered<=1e-8){this.ack=Math.max(this.ack,c.seq);continue;}
   this.queue.push({...c,dt:c.dt-covered,input:{keys:c.keys,yaw:c.yaw,touch:c.touch,jumpPress:c.jumpPress||0,fPress:c.fPress||0}});
  }
  let queued=this.queuedSeconds;while(this.queue.length>1&&queued>MAX_INPUT_BACKLOG+1e-8){const stale=this.queue.shift();queued-=stale.dt;this.ack=Math.max(this.ack,stale.seq);this.dropped++;}
 }
 advance(dt,apply,fallback=null){this.credit=Math.min(.12,this.credit+dt);let count=0;while(this.queue.length&&this.queue[0].dt<=this.credit+1e-8&&count++<12){const c=this.queue.shift();apply(c.input,c.dt);this.credit=Math.max(0,this.credit-c.dt);this.clock+=c.dt;this.ack=Math.max(this.ack,c.seq);}if(fallback&&!this.queue.length&&this.credit>1e-8){const step=this.credit;this.credit=0;apply(fallback,step);this.clock+=step;this.speculativeTime=Math.min(.6,this.speculativeTime+step);}}
}

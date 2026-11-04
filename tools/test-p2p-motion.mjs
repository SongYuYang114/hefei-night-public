import fs from 'node:fs';
import assert from 'node:assert/strict';
import {LocalPrediction,InputQueue,moveControlled,remoteFallback,INPUT_STEP} from '../dist/net-motion.mjs';
const actor=()=>({x:0,z:8,angle:0,state:'active',hp:2,stun:0,kickTime:0,jumpTime:0,jumpCooldown:0,launchTime:0,inputAck:0,inputClock:0,inputLead:0});
function simulate({name,loss=0,burst=false,hostHz=60,obstacles=[]}){
 let randomState=1234567;const rand=()=>{randomState^=randomState<<13;randomState^=randomState>>>17;randomState^=randomState<<5;return (randomState>>>0)/4294967296;};
 const host=actor(),prediction=new LocalPrediction(obstacles),queue=new InputQueue();prediction.reset(host);
 const messages=[],corrections=[];let serial=0,latest=null,lastReceived=0,inputAcc=0,hostAcc=0,sendAcc=0,snapshotAcc=0,lastSignature='',lastPose=prediction.pose(0),maxBackStep=0,distance=0,finalPose;
 const wire=(kind,payload,t)=>{if(kind==='input'&&(rand()<loss||burst&&t>1.2&&t<1.65||burst&&t>3.1&&t<3.55))return;messages.push({kind,payload:structuredClone(payload),at:t+.055+(kind==='control'?0:rand()*.065)});};
 for(let frame=0;frame<540;frame++){
  const t=frame/60,dt=1/60;
  messages.sort((a,b)=>a.at-b.at);
  while(messages[0]?.at<=t){const m=messages.shift();if(m.kind==='snapshot'){const before=prediction.actor;prediction.reconcile(m.payload,t*1000);corrections.push(Math.hypot(before.x-prediction.actor.x,before.z-prediction.actor.z));continue;}
   if(latest?.serial>m.payload.serial)continue;latest=m.payload;lastReceived=t;
   if(m.kind==='control')queue.control(m.payload.seq,m.payload);else queue.receive(m.payload.commands);
  }
  const keys=t<2?{w:true}:t<3?{d:true}:t<4?{s:true}:t<6?{a:true}:{};
  const input={keys,yaw:0,touch:{x:0,z:0},jumpPress:0,fPress:0};inputAcc+=dt;
  while(inputAcc>=INPUT_STEP-1e-9){prediction.push(input,INPUT_STEP,t*1000);inputAcc-=INPUT_STEP;}
  const signature=JSON.stringify(keys);if(signature!==lastSignature){lastSignature=signature;wire('control',{...input,seq:prediction.sequence,serial:++serial},t);}
  sendAcc+=dt;if(sendAcc>=.04){sendAcc-=.04;wire('input',{...input,seq:prediction.sequence,serial:++serial,commands:prediction.outgoing()},t);}
  hostAcc+=dt;if(hostAcc>=1/hostHz-1e-9){const step=hostAcc;hostAcc=0;const before={...host};queue.advance(step,(i,d)=>moveControlled(host,i,d,obstacles),remoteFallback(latest,(t-lastReceived)*1000));distance+=Math.hypot(before.x-host.x,before.z-host.z);host.inputAck=queue.ack;host.inputClock=queue.clock;host.inputLead=queue.speculativeTime||0;snapshotAcc+=step;if(snapshotAcc>=.1){snapshotAcc-=.1;wire('snapshot',host,t);}}
  const pose=prediction.pose(dt);if(lastPose&&keys.w)maxBackStep=Math.max(maxBackStep,pose.z-lastPose.z);lastPose=pose;finalPose=pose;
 }
 const sorted=corrections.slice().sort((a,b)=>a-b);
 return {name,loss,burst,hostHz,maximumCorrection:Math.max(...corrections),p95Correction:sorted[Math.floor(sorted.length*.95)],maximumBackStep:maxBackStep,finalError:Math.hypot(finalPose.x-host.x,finalPose.z-host.z),distance,ack:queue.ack,clock:queue.clock,dropped:queue.dropped};
}
const results=[simulate({name:'clean'}),simulate({name:'20-percent-loss',loss:.2,burst:true}),simulate({name:'35-percent-loss-12fps-host',loss:.35,burst:true,hostHz:12}),simulate({name:'wall-collision-loss',loss:.25,burst:true,obstacles:[{x:0,z:5,w:8,d:1}]})];
for(const r of results){assert(r.maximumCorrection<.5,r.name+' correction');assert(r.maximumBackStep<.05,r.name+' backstep');assert(r.finalError<.01,r.name+' convergence');assert(r.distance<22.6,r.name+' speed limit');}
const debtQueue=new InputQueue(),debtActor=actor(),forward={keys:{w:true},yaw:0,touch:{x:0,z:0}};
debtQueue.advance(.1,(i,d)=>moveControlled(debtActor,i,d,[]),forward);const beforeLate={...debtActor};
debtQueue.receive(Array.from({length:5},(_,i)=>({...forward,seq:i+1,dt:.02})));assert.equal(debtQueue.ack,5);assert.equal(debtQueue.queue.length,0);assert.equal(debtActor.z,beforeLate.z);
debtQueue.control(500);assert.equal(debtQueue.ack,5,'key edge cannot acknowledge unapplied movement');
debtQueue.advance(.02,(i,d)=>moveControlled(debtActor,i,d,[]),forward);assert(Math.abs(debtActor.z-(8-3.7*.12))<1e-9);
const guardQueue=new InputQueue();let simulated=0;for(let tick=0;tick<100;tick++){guardQueue.receive(Array.from({length:30},(_,i)=>({seq:tick*30+i+1,dt:.04,keys:{w:true}})));guardQueue.advance(.02,(_,dt)=>simulated+=dt);}assert(simulated<=2+1e-8,'input flood cannot advance beyond host wall time');
const caught=new LocalPrediction();caught.reset(actor());caught.push(forward,.02,0);caught.reconcile({...actor(),x:20,z:20,state:'captured',inputAck:1},100);assert.deepEqual([caught.pose(.02).x,caught.pose(.02).z],[20,20]);
const report={passed:true,version:JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url))).version,protocol:32,lateInputsNotSimulatedTwice:true,keyEdgesDoNotDiscardMovement:true,hostWallTimeBudgetEnforced:true,captureRemainsAuthoritative:true,results};
fs.writeFileSync(process.argv[2]||new URL('../../p2p-motion-result.json',import.meta.url),JSON.stringify(report,null,2));console.log(report);

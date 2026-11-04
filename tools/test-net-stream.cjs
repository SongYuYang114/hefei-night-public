const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {LatestStreams,diff,patch}=require('../net-stream.cjs');
const {createRoomServer,connectRoom,PROTOCOL}=require('../network.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(fn,label,ms=4000)=>{const end=Date.now()+ms;while(Date.now()<end){if(fn())return;await sleep(10);}throw Error('Timeout: '+label);};
async function constrainedLink(){
 const begin=Date.now(),rate=5120,timers=new Set();let a,b,nextA=begin,nextB=begin,bytes=0,queued=0,maxQueue=0,stalls=0,frames=0,latestAge=0,maxAge=0,received=0,pings=0,actionReceived=false;
 const forward=(to,direction)=>message=>{
  const wire=JSON.stringify(message),size=Buffer.byteLength(wire)+1,now=Date.now();bytes+=size;queued+=size;maxQueue=Math.max(maxQueue,queued);
  let free=direction==='a'?nextA:nextB;free=Math.max(now,free)+size/rate*1000;
  // Reliable TCP retransmission pauses are intentionally serialized with data.
  if(direction==='a'&&++frames%19===0){free+=650;stalls++;}
  if(direction==='a')nextA=free;else nextB=free;
  const timer=setTimeout(()=>{timers.delete(timer);queued-=size;const m=JSON.parse(wire);to().receive(m,value=>{if(value.type==='snapshot'){received++;latestAge=Date.now()-value.state.stamp;maxAge=Math.max(maxAge,latestAge);}else if(value.type==='input')assert(value.input.commands.at(-1).seq>=1);});if(m.type==='ping')pings++;if(m.type==='action')actionReceived=true;},Math.max(0,free-now)+150);timers.add(timer);
 };
 a=new LatestStreams(forward(()=>b,'a'));b=new LatestStreams(forward(()=>a,'b'));
 const fields=fs.readFileSync(path.join(__dirname,'../dist/game.js'),'utf8').match(/const netActorFields=\[([^\]]+)\]/)[1].match(/'([^']+)'/g).map(s=>s.slice(1,-1));
 const world=i=>{const actor=id=>({...Object.fromEntries(fields.map(k=>[k,0])),id,state:'active',hp:2,x:Math.sin(i/19+id)*22,z:Math.cos(i/23+id)*22,angle:i/37,moving:true,inputAck:i,stun:Math.max(0,3-i/20),cooldown:Math.max(0,30-i/20)});return {stamp:Date.now(),elapsed:i/20,hostFps:12,hunter:actor(4),survivors:[0,1,2,3].map(actor),gens:[0,.12,0,1,0,0,0],gates:[0,0],mailisu:Array.from({length:100},(_,id)=>({id,x:id*.123,z:-id*.456})),events:[],mines:[],pigs:[],cars:[],gases:[],echoes:[],chests:[]};};
 let i=0,seq=0,legacyBytes=0;
 const tick=setInterval(()=>{const state=world(++i);legacyBytes+=Buffer.byteLength(JSON.stringify({type:'compressed',data:zlib.deflateRawSync(JSON.stringify({type:'snapshot',state}),{level:1}).toString('base64')}))+1;a.send({type:'snapshot',state});const commands=Array.from({length:6},(_,j)=>({seq:Math.max(1,seq-5+j),dt:.02,keys:{w:true},yaw:0,touch:{x:0,z:0}}));seq+=2;b.send({type:'input',input:{keys:{w:true},commands}});},50);
 await sleep(6500);a.write({type:'action',action:'skill'});a.write({type:'ping',id:1});await sleep(2000);clearInterval(tick);
 const last=world(++i);last.survivors[0].state='captured';a.send({type:'snapshot',state:last});a.barrier('result');a.write({type:'result',result:'hunter'});await sleep(1200);
 const stats={bytes,legacySnapshotBytes:legacyBytes,bandwidthReduction:1-bytes/legacyBytes,maximumQueuedBytes:maxQueue,maximumStateAgeMs:maxAge,finalStateAgeMs:latestAge,snapshotsReceived:received,retransmissionStalls:stalls,coalesced:a.stats().coalesced,actionsArrived:actionReceived,pingsArrived:pings};
 a.close();b.close();for(const timer of timers)clearTimeout(timer);
 assert(received>=10);assert(stalls>=1);assert(maxQueue<6000);assert(maxAge<2200);assert(latestAge<2200);assert(actionReceived&&pings===1);assert(stats.bandwidthReduction>.6);
 return stats;
}
async function actualRelay(){
 const relay=await createRoomServer({host:'127.0.0.1',port:0}),connections=[],events=[[],[],[]];
 try{
  const host=await connectRoom({address:'127.0.0.1:'+relay.port,create:true,slot:4},m=>events[0].push(m));connections.push(host);
  const guest=await connectRoom({address:'127.0.0.1:'+relay.port,code:host.code,slot:0},m=>events[1].push(m));connections.push(guest);
  const other=await connectRoom({address:'127.0.0.1:'+relay.port,code:host.code,slot:1},m=>events[2].push(m));connections.push(other);
  for(const slot of [2,3]){const extra=await connectRoom({address:'127.0.0.1:'+relay.port,code:host.code,slot},()=>{});connections.push(extra);extra.send({type:'ready',ready:true});}
  await assert.rejects(()=>connectRoom({address:'127.0.0.1:'+relay.port,code:host.code},()=>{}),/房间已满/);
  guest.send({type:'ready',ready:true});other.send({type:'ready',ready:true});await until(()=>events[0].at(-1)?.players?.every(p=>p.slot===4||p.ready),'ready');host.send({type:'start'});await until(()=>events.every(e=>e.some(m=>m.type==='start')),'start');
  for(let i=0;i<200;i++){guest.send({type:'input',input:{keys:{w:true},commands:[{seq:i+1,dt:.02,keys:{w:true}}]}});host.send({type:'snapshot',state:{elapsed:i/20,survivors:[{x:i},{},{},{}],mailisu:[{id:1,x:1,z:2}],mines:[{id:2,ownerSlot:0},{id:3,ownerSlot:1}]}});}
  host.send({type:'feedback',id:guest.id,message:'control stays reliable'});guest.send({type:'action',action:'skill'});
  await until(()=>events[1].some(m=>m.state?.elapsed===199/20)&&events[0].some(m=>m.input?.commands?.at(-1)?.seq===200),'latest snapshot/input');
  for(const [i,slot]of [[1,0],[2,1]]){const snapshots=events[i].filter(m=>m.type==='snapshot');assert(snapshots.length<30);assert(snapshots.every(m=>!m.state.mailisu.length&&m.state.mines.every(m=>m.ownerSlot===slot)));}
  assert(events[0].some(m=>m.type==='action'));assert(events[1].some(m=>m.type==='feedback'));
  host.send({type:'snapshot',state:{elapsed:11,survivors:[{state:'captured'},{},{},{}],mailisu:[],mines:[]}});host.send({type:'result',result:'hunter'});
  await until(()=>events[1].some(m=>m.type==='result'),'result');const end=events[1].findIndex(m=>m.type==='result');assert(events[1].slice(0,end).some(m=>m.state?.elapsed===11));
  host.send({type:'lobby'});await until(()=>events[1].some(m=>m.type==='lobby'),'lobby');connections.slice(1).forEach(c=>c.send({type:'ready',ready:true}));await sleep(60);host.send({type:'start'});await until(()=>events[1].filter(m=>m.type==='start').length===2,'second round');host.send({type:'snapshot',state:{elapsed:0,survivors:[{x:-1},{},{},{}],mailisu:[],mines:[]}});await until(()=>events[1].some(m=>m.match===2&&m.state?.elapsed===0),'second-round baseline');
  const foreignEvents=[],foreign=await connectRoom({address:'127.0.0.1:'+relay.port,create:true},m=>foreignEvents.push(m));connections.push(foreign);
  guest.send({type:'signal',to:host.id,signal:{kind:'restart'}});await until(()=>events[0].some(m=>m.type==='signal'&&m.from===guest.id),'same-room signaling');
  foreign.send({type:'signal',to:host.id,signal:{kind:'restart'}});host.send({type:'signal',to:foreign.id,signal:{kind:'restart'}});guest.send({type:'signal',to:other.id,signal:{kind:'restart'}});await sleep(80);assert(!foreignEvents.some(m=>m.type==='signal'));assert(!events[2].some(m=>m.type==='signal'));assert(!events[0].some(m=>m.type==='signal'&&m.from===foreign.id));
  const legacy22=await connectRoom({address:'127.0.0.1:'+relay.port,create:true,protocol:22},()=>{});connections.push(legacy22);assert(legacy22.id);
  const legacy=await connectRoom({address:'127.0.0.1:'+relay.port,create:true,protocol:21},()=>{});connections.push(legacy);assert(legacy.id);
  await assert.rejects(()=>connectRoom({address:'127.0.0.1:'+relay.port,code:legacy.code},()=>{}),/版本不一致/);
  return {fiveSlotCap:true,burstCoalescing:true,trapPrivacy:true,reliableActions:true,finalStateBeforeResult:true,secondRound:true,legacy21Rooms:true,mixedVersionRejected:true,legacy22Rooms:true,signalingRoomIsolation:true,hostStats:host.stats(),guestStats:guest.stats()};
 }finally{connections.forEach(c=>c.close());await relay.close();}
}
(async()=>{
 const base={a:[1,{x:2,remove:3}],b:null},next={a:[2,{x:4}],new:{safe:true}};assert.deepEqual(patch(base,diff(base,next)),next);assert.deepEqual(base,{a:[1,{x:2,remove:3}],b:null});
 assert.throws(()=>patch({},JSON.parse('[1,{"__proto__":[0,{"polluted":true}]},[]]')));assert.equal({}.polluted,undefined);
 const {InputQueue,LocalPrediction,remoteFallback}=await import('../dist/net-motion.mjs');const q=new InputQueue();let x=0,seq=0;const held={keys:{w:true,f:true,q:true},touch:{x:1,z:0}};assert.equal(remoteFallback(held,599),held);assert.deepEqual(remoteFallback(held,600).keys,{f:true,q:true});assert.deepEqual(remoteFallback(held,2499).touch,{x:0,z:0});assert.equal(remoteFallback(held,2500),null);
 for(let tick=0;tick<300;tick++){if(tick%15===0){const commands=Array.from({length:6},()=>({seq:++seq,dt:.02,keys:{w:true}}));q.receive(commands);}q.advance(.02,(input,dt)=>{if(input.keys.w)x+=3.7*dt;},{keys:{w:true}});assert(q.queuedSeconds<=.12+1e-8);}
 assert(Math.abs(x-22.2)<1e-7,'weak-link movement must not slow down');
 q.receive([{seq:1000,dt:.02,keys:{f:true}}]);const beforeControl=q.ack;q.control(1000);assert.equal(q.ack,beforeControl);q.advance(.02,()=>{});assert.equal(q.ack,1000);q.receive([{seq:999,dt:.02,keys:{f:true}}]);assert.equal(q.queue.length,0);
 const predictor=new LocalPrediction();predictor.reset({x:0,z:0,state:'active'});for(let i=0;i<100;i++)predictor.push({keys:{},touch:{},yaw:0},.02,i*20);assert.equal(predictor.outgoing().at(-1).seq,100);assert.equal(predictor.outgoing().length,30);
 const result={passed:true,version:'1.20.0',protocol:PROTOCOL,weakLinkMovementFullSpeed:true,patchRoundTripAndPrototypeGuard:true,constrained:await constrainedLink(),relay:await actualRelay()};fs.writeFileSync(path.join(__dirname,'../../network-pressure.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});

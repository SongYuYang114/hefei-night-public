const {connectRoom,PROTOCOL}=require('../network.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const peers=[],received=[0,0,0,0],ack=[0,0,0,0],serial=[0,0,0,0],times=[new Map(),new Map(),new Map(),new Map()],latencies=[],errors=[];let host,tick,frames;
 try{
  host=await connectRoom({address:process.argv[2]||process.env.HEFEI_TEST_ADDRESS,create:true,slot:4},m=>{if(m.type==='input'||m.type==='control')ack[m.slot]=Math.max(ack[m.slot],m.input.seq);if(m.type==='error')errors.push(m.message);});peers.push(host);
  for(let slot=0;slot<4;slot++){
   const client=await connectRoom({address:process.argv[2]||process.env.HEFEI_TEST_ADDRESS,code:host.code,slot,character:slot},m=>{if(m.type==='snapshot'){received[slot]++;const seq=m.state.survivors[slot].inputAck,stamp=times[slot].get(seq);if(stamp){latencies.push(Date.now()-stamp);times[slot].delete(seq);}assert(!m.state.mailisu.length);assert(m.state.mines.every(m=>m.ownerSlot===slot));}if(m.type==='error')errors.push(m.message);});peers.push(client);client.send({type:'ready',ready:true});
  }
  await sleep(350);host.send({type:'start'});await sleep(350);
  const original=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/network-state.json'))),keys=['pigs','timeLimit','remaining','elapsed','hostFps','kuchi','mailisu','chests','hunter','survivors','echoes','gens','gates','mines','gases','cars','events'];
  const state=Object.fromEntries(keys.map(k=>[k,original[k]]));state.mailisu=[{id:999,x:1,z:1}];state.mines=[{id:1,ownerSlot:0},{id:2,ownerSlot:1}];state.events=[];let seq=0,frame=0;
  tick=setInterval(()=>{seq++;for(let slot=0;slot<4;slot++){const input={seq,serial:++serial[slot],keys:{w:seq%50<25},yaw:seq*.01,touch:{x:0,z:0},commands:Array.from({length:Math.min(seq,6)},(_,i)=>({seq:Math.max(1,seq-5+i),dt:.02,keys:{w:true},yaw:seq*.01,touch:{x:0,z:0}}))};times[slot].set(seq,Date.now());peers[slot+1].send({type:'input',input});if(seq%25===0)peers[slot+1].send({type:'control',input:{...input,serial:++serial[slot],commands:undefined}});}},40);
  frames=setInterval(()=>{frame++;state.elapsed=frame/10;for(let slot=0;slot<4;slot++){state.survivors[slot].inputAck=ack[slot];state.survivors[slot].x=Math.sin(frame/10+slot)*20;state.survivors[slot].z=Math.cos(frame/11+slot)*20;}host.send({type:'snapshot',state});},100);
  await sleep(8500);clearInterval(tick);clearInterval(frames);await sleep(500);
  const sorted=latencies.slice().sort((a,b)=>a-b),p95=sorted[Math.floor(sorted.length*.95)];assert(peers.every(p=>p.stats().buffered<4096));assert(received.every(n=>n>=15));assert(sorted.length>=30);assert(p95<2500);assert(!errors.length);
  const result={passed:true,version:'1.20.0',protocol:PROTOCOL,address:process.argv[2]||process.env.HEFEI_TEST_ADDRESS,players:5,snapshotsReceived:received,commandConfirmation:{samples:sorted.length,medianMs:sorted[Math.floor(sorted.length/2)],p95Ms:p95,maximumMs:sorted.at(-1)},transport:peers.map(p=>p.stats()),errors};fs.writeFileSync(path.join(__dirname,'../../public-relay-v120.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{clearInterval(tick);clearInterval(frames);peers.forEach(p=>p.close());}
})().catch(e=>{console.error(e);process.exitCode=1;});

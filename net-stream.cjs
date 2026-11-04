// TCP remains reliable for actions. Replaceable state has one acknowledged frame
// per stream in flight, so a slow link cannot accumulate seconds of old poses.
const zlib=require('node:zlib');
const {performance}=require('node:perf_hooks');
const INVALID_KEYS=new Set(['__proto__','constructor','prototype']);
const LIMIT=256*1024;
function diff(before,after){
 if(Object.is(before,after))return null;
 if(before&&after&&typeof before==='object'&&typeof after==='object'&&Array.isArray(before)===Array.isArray(after)&&(!Array.isArray(after)||before.length===after.length)){
  const changes={};for(const key of Object.keys(after)){const patch=diff(before[key],after[key]);if(patch)changes[key]=patch;}
  const removed=Object.keys(before).filter(key=>!Object.hasOwn(after,key));
  return Object.keys(changes).length||removed.length?[1,changes,removed]:null;
 }
 return [0,after];
}
function patch(before,delta,depth=0){
 if(depth>64||!Array.isArray(delta))throw Error('Invalid state patch');
 if(delta[0]===0)return delta[1];
 if(delta[0]!==1||!before||typeof before!=='object'||!delta[1]||typeof delta[1]!=='object'||!Array.isArray(delta[2]))throw Error('Missing state baseline');
 const next=Array.isArray(before)?before.slice():{...before};
 for(const key of delta[2]){if(INVALID_KEYS.has(key))throw Error('Invalid state key');delete next[key];}
 for(const [key,value]of Object.entries(delta[1])){if(INVALID_KEYS.has(key))throw Error('Invalid state key');next[key]=patch(before[key],value,depth+1);}
 return next;
}
const keyFor=m=>m?.type==='snapshot'?'snapshot':m?.type==='input'?'input'+(Number.isInteger(m.slot)?':'+m.slot:''):null;
class LatestStreams{
 constructor(write){this.write=write;this.out=new Map();this.incoming=new Map();this.closed=false;this.counters={sent:0,coalesced:0,bytes:0,ackRtt:0};}
 send(message){
  const key=keyFor(message);if(!key)return false;
  // Copy once: the renderer/relay may mutate the next state before its turn.
  const value=JSON.parse(JSON.stringify(message));
  let stream=this.out.get(key);if(!stream){stream={seq:0,ack:0,base:null,inflight:null,pending:null,timer:null,last:0};this.out.set(key,stream);}
  if(stream.pending)this.counters.coalesced++;
  stream.pending=value;this.pump(key,stream);return true;
 }
 pump(key,stream,force=false){
  if(this.closed||!stream.pending||stream.inflight&&!force)return;
  const interval=key==='snapshot'?100:40,wait=interval-(performance.now()-stream.last);
  if(!force&&wait>0){if(!stream.timer){stream.timer=setTimeout(()=>{stream.timer=null;this.pump(key,stream);},wait);stream.timer.unref?.();}return;}
  if(stream.timer){clearTimeout(stream.timer);stream.timer=null;}
  const value=stream.pending;stream.pending=null;
  const delta=force?[0,value]:(diff(stream.base,value)||[0,value]);
  const data=zlib.deflateRawSync(JSON.stringify(delta),{level:1}).toString('base64');
  const frame={type:'latest-state',stream:key,seq:++stream.seq,base:force?0:stream.ack,data};
  stream.last=performance.now();stream.inflight={seq:frame.seq,value,sent:stream.last};
  this.counters.sent++;this.counters.bytes+=Buffer.byteLength(JSON.stringify(frame))+1;
  this.write(frame);
 }
 receive(message,deliver){
  if(message?.type==='state-ack'){
   const stream=this.out.get(message.stream),current=stream?.inflight;
   if(current&&message.seq===current.seq){this.counters.ackRtt=performance.now()-current.sent;stream.ack=current.seq;stream.base=current.value;stream.inflight=null;this.pump(message.stream,stream);}
   return true;
  }
  if(message?.type!=='latest-state')return false;
  if(!/^(snapshot|input(?::[0-4])?)$/.test(message.stream)||!Number.isSafeInteger(message.seq)||message.seq<=0||!Number.isSafeInteger(message.base)||message.base<0||typeof message.data!=='string'||message.data.length>LIMIT)throw Error('Invalid state frame');
  let history=this.incoming.get(message.stream);if(!history){history=new Map();this.incoming.set(message.stream,history);}
  if(history.has(message.seq)){this.write({type:'state-ack',stream:message.stream,seq:message.seq});return true;}
  const raw=zlib.inflateRawSync(Buffer.from(message.data,'base64'),{maxOutputLength:LIMIT});
  const value=patch(message.base?history.get(message.base):null,JSON.parse(raw));
  if(keyFor(value)!==message.stream)throw Error('State stream mismatch');
  history.set(message.seq,value);while(history.size>4)history.delete(history.keys().next().value);
  this.write({type:'state-ack',stream:message.stream,seq:message.seq});deliver(value);return true;
 }
 barrier(type){
  if(!['result','start','lobby'].includes(type))return;
  for(const [key,stream]of this.out){if(type==='result')this.pump(key,stream,true);else stream.pending=null;}
 }
 stats(){return {...this.counters,pending:[...this.out.values()].filter(s=>s.pending).length,inflight:[...this.out.values()].filter(s=>s.inflight).length};}
 close(){this.closed=true;for(const s of this.out.values())clearTimeout(s.timer);this.out.clear();this.incoming.clear();}
}
module.exports={LatestStreams,diff,patch};

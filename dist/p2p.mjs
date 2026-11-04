import {encodePacket,decodePacket,stateDiff,statePatch,privateSnapshot,cleanPeerInput} from './p2p-codec.mjs';
const now=()=>performance.now(),copy=value=>JSON.parse(JSON.stringify(value));
const ACTIONS=new Set(['skill','attack','item']);
export class PeerRoom{
 constructor({relay,deliver,Peer=globalThis.RTCPeerConnection,iceServers=[{urls:'stun:stun.cloudflare.com:3478'}]}={}){
  this.relay=relay;this.deliver=deliver;this.Peer=Peer;this.iceServers=iceServers;this.id=null;this.room=null;this.match=0;this.playing=false;this.peers=new Map();this.pendingCandidates=new Map();this.pendingActions=new Map();this.seenActions=new Set();this.actionSerial=0;this.lastSnapshot=null;this.address=null;this.disabled=false;this.closed=false;this.sentFast=0;this.receivedFast=0;this.errors=0;this.session=globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2);this.timer=setInterval(()=>this.tick(),250);this.timer.unref?.();
 }
 get host(){return !!this.room&&this.room.hostId===this.id;}
 configure({id,address}={}){if(id)this.id=id;if(address)this.address=address;}
 signal(to,signal){this.relay({type:'signal',to,signal});}
 observe(message){
  if(message.type==='welcome')this.id=message.id;
  if(message.type==='room'){this.room=message;this.sync();}
  if(message.type==='signal'){void this.handleSignal(message).catch(()=>{this.errors++;});return true;}
  if(message.type==='start'){this.match=message.match;this.playing=true;this.lastSnapshot=null;this.pendingActions.clear();this.seenActions.clear();for(const p of this.peers.values()){p.sent.clear();p.received.clear();p.ack=0;p.sequence=0;p.lastReceived=0;p.pending=null;}}
  if(['result','lobby'].includes(message.type)){this.playing=false;this.pendingActions.clear();}
  if(message.type==='left')this.drop(message.id);
  if(['closed','disconnected'].includes(message.type)){this.closePeers();this.room=null;this.playing=false;}
  if(message.type==='action'&&message.actionId){if(message.match!==this.match||!this.playing)return true;return !this.acceptAction(message.id,message.actionId);}
  return false;
 }
 sync(){
  if(!this.room||!this.id||!this.Peer||this.closed||this.disabled)return;
  const targets=this.room.players.filter(p=>p.id!==this.id&&(this.host||p.id===this.room.hostId));
  for(const id of this.peers.keys())if(!targets.some(p=>p.id===id))this.drop(id);
  if(this.host)for(const target of targets)if(!this.peers.has(target.id))void this.offer(target.id).catch(()=>{this.errors++;});
 }
 create(id,generation){
  this.drop(id);let iceServers=this.iceServers;
  const address=/^(?:tls:\/\/)?([a-zA-Z0-9.-]+)(?::([0-9]{1,5}))?$/.exec(this.address||'');
  if(address&&this.room?.p2p?.stun)iceServers=[{urls:`stun:${address[1]}:${address[2]||29804}`},...iceServers];
  const pc=new this.Peer({iceServers,bundlePolicy:'max-bundle'}),p={id,generation,pc,reliable:null,fast:null,created:now(),lastPing:0,lastPong:0,rtt:null,pings:new Map(),pingSerial:0,sequence:0,ack:0,sent:new Map(),received:new Map(),lastReceived:0,candidates:[],pending:null,encoding:false,decoding:0,forceFull:false,lastAction:0};this.peers.set(id,p);
  pc.onicecandidate=e=>{if(e.candidate&&this.peers.get(id)===p)this.signal(id,{kind:'candidate',generation,candidate:e.candidate.toJSON()});};
  pc.ondatachannel=e=>this.attach(p,e.channel);
  pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed')p.lastPong=0;};return p;
 }
 async offer(id){
  if(!this.host||this.disabled||!this.room?.players.some(p=>p.id===id))return;
  const generation=globalThis.crypto.randomUUID(),p=this.create(id,generation);
  this.attach(p,p.pc.createDataChannel('reliable',{ordered:true}));this.attach(p,p.pc.createDataChannel('realtime',{ordered:false,maxRetransmits:0}));
  await p.pc.setLocalDescription(await p.pc.createOffer());if(this.peers.get(id)===p)this.signal(id,{kind:'offer',generation,sdp:p.pc.localDescription.sdp});
 }
 async handleSignal({from,signal:s}){
  if(this.closed||!this.room?.players.some(p=>p.id===from)||from===this.id)return;
  if(s?.kind==='action-ack'){const a=this.pendingActions.get(s.actionId);if(a?.target===from)this.pendingActions.delete(s.actionId);return;}
  if(this.disabled||!this.Peer||(!this.host&&from!==this.room.hostId))return;
  if(s?.kind==='restart'){if(this.host){const p=this.peers.get(from);if(!p||now()-p.created>2000)await this.offer(from);}return;}
  if(typeof s?.generation!=='string'||s.generation.length>64)return;
  let p=this.peers.get(from);
  if(s.kind==='offer'){
   if(this.host||typeof s.sdp!=='string')return;p=this.create(from,s.generation);await p.pc.setRemoteDescription({type:'offer',sdp:s.sdp});
   const queued=this.pendingCandidates.get(from+':'+s.generation)||[];this.pendingCandidates.delete(from+':'+s.generation);for(const candidate of queued)await p.pc.addIceCandidate(candidate);
   await p.pc.setLocalDescription(await p.pc.createAnswer());if(this.peers.get(from)===p)this.signal(from,{kind:'answer',generation:s.generation,sdp:p.pc.localDescription.sdp});return;
  }
  if(s.kind==='candidate'&&(!p||p.generation!==s.generation)){
   if(this.pendingCandidates.size>=8)this.pendingCandidates.delete(this.pendingCandidates.keys().next().value);const key=from+':'+s.generation,queue=this.pendingCandidates.get(key)||[];if(queue.length<32)queue.push(s.candidate);this.pendingCandidates.set(key,queue);return;
  }
  if(!p||p.generation!==s.generation)return;
  if(s.kind==='answer'&&this.host){await p.pc.setRemoteDescription({type:'answer',sdp:s.sdp});for(const candidate of p.candidates.splice(0))await p.pc.addIceCandidate(candidate);}
  else if(s.kind==='candidate'){if(p.pc.remoteDescription)await p.pc.addIceCandidate(s.candidate);else if(p.candidates.length<32)p.candidates.push(s.candidate);}
 }
 attach(p,channel){
  if(!['reliable','realtime'].includes(channel.label)){channel.close();return;}const key=channel.label==='reliable'?'reliable':'fast';if(p[key]&&p[key]!==channel){channel.close();return;}p[key]=channel;channel.binaryType='arraybuffer';
  channel.onopen=()=>this.ping(p);channel.onclose=()=>{p.lastPong=0;};channel.onerror=()=>{p.lastPong=0;};
  channel.onmessage=e=>{if(this.peers.get(p.id)!==p)return;if(key==='reliable'){try{if(typeof e.data!=='string'||e.data.length>16384)return;this.control(p,JSON.parse(e.data));}catch{this.errors++;}}else if(p.decoding<8){p.decoding++;void this.realtime(p,e.data).catch(()=>{this.errors++;}).finally(()=>p.decoding--);}};
 }
 reliable(p,message){if(p?.reliable?.readyState!=='open'||p.reliable.bufferedAmount>32768)return false;try{p.reliable.send(JSON.stringify(message));return true;}catch{p.lastPong=0;return false;}}
 healthy(p){return !this.disabled&&p?.pc.connectionState==='connected'&&p.fast?.readyState==='open'&&p.reliable?.readyState==='open'&&p.fast.bufferedAmount<4096&&p.lastPong>0&&now()-p.lastPong<1800;}
 ping(p){if(p.reliable?.readyState!=='open')return;const id=++p.pingSerial;p.lastPing=now();p.pings.set(id,p.lastPing);while(p.pings.size>8)p.pings.delete(p.pings.keys().next().value);this.reliable(p,{kind:'ping',id});}
 control(p,m){
  if(m.kind==='ping'&&Number.isSafeInteger(m.id)){this.reliable(p,{kind:'pong',id:m.id});return;}
  if(m.kind==='pong'){const sent=p.pings.get(m.id);if(sent!==undefined){p.rtt=now()-sent;p.lastPong=now();p.pings.delete(m.id);}return;}
  if(m.kind==='action-ack'){const a=this.pendingActions.get(m.actionId);if(a?.target===p.id)this.pendingActions.delete(m.actionId);return;}
  if(m.match!==this.match||!this.playing)return;
  if(m.kind==='snapshot-ack'&&this.host&&Number.isSafeInteger(m.seq)&&m.seq>p.ack&&p.sent.has(m.seq)){p.ack=m.seq;return;}
  if(m.kind==='resync'){p.forceFull=true;return;}
  if(m.kind==='control'&&this.host){const peer=this.room.players.find(v=>v.id===p.id);if(peer)this.deliver({type:'control',id:p.id,slot:peer.slot,match:this.match,input:cleanPeerInput(m.input)});}
  if(m.kind==='action'&&this.host&&ACTIONS.has(m.action)){
   if(this.seenActions.has(p.id+':'+m.actionId)){this.acceptAction(p.id,m.actionId);return;}if(now()-p.lastAction<90)return;
   if(!this.acceptAction(p.id,m.actionId))return;p.lastAction=now();const peer=this.room.players.find(v=>v.id===p.id);if(peer)this.deliver({type:'action',id:p.id,slot:peer.slot,match:this.match,action:m.action,actionId:m.actionId});
  }
 }
 acceptAction(id,actionId){
  if(typeof actionId!=='string'||actionId.length>96||!/^[a-zA-Z0-9:-]+$/.test(actionId))return false;
  const p=this.peers.get(id);if(!this.reliable(p,{kind:'action-ack',actionId}))this.signal(id,{kind:'action-ack',actionId});
  const key=id+':'+actionId;if(this.seenActions.has(key))return false;this.seenActions.add(key);while(this.seenActions.size>256)this.seenActions.delete(this.seenActions.values().next().value);return true;
 }
 async realtime(p,data){
  const m=await decodePacket(data);if(this.peers.get(p.id)!==p||m.match!==this.match||!this.playing)return;
  if(m.kind==='input'&&this.host){const peer=this.room.players.find(v=>v.id===p.id);if(peer){this.receivedFast++;this.deliver({type:'input',id:p.id,slot:peer.slot,match:this.match,input:cleanPeerInput(m.input)});}return;}
  if(m.kind!=='snapshot'||this.host||p.id!==this.room.hostId||!Number.isSafeInteger(m.seq)||m.seq<=p.lastReceived)return;
  if(m.base&&!p.received.has(m.base)){this.reliable(p,{kind:'resync',match:this.match});return;}
  const state=statePatch(m.base?p.received.get(m.base):null,m.delta);if(!Array.isArray(state?.survivors)||state.survivors.length!==4)return;
  p.lastReceived=m.seq;p.received.set(m.seq,state);while(p.received.size>32)p.received.delete(p.received.keys().next().value);this.receivedFast++;this.reliable(p,{kind:'snapshot-ack',match:this.match,seq:m.seq});this.deliver({type:'snapshot',match:this.match,state});
 }
 push(p,message){if(!this.healthy(p))return false;p.pending=message;void this.pump(p);return true;}
 async pump(p){
  if(p.encoding||!p.pending)return;p.encoding=true;
  try{while(p.pending){const message=p.pending;p.pending=null;const epoch=this.match;
    let wire=message,value=null,seq=0;if(message.kind==='snapshot'){value=copy(message.state);seq=++p.sequence;const base=!p.forceFull&&p.sent.has(p.ack)?p.ack:0;p.forceFull=false;wire={kind:'snapshot',match:epoch,seq,base,delta:base?stateDiff(p.sent.get(base),value)||[0,value]:[0,value]};}
    const bytes=await encodePacket(wire);if(this.peers.get(p.id)!==p||epoch!==this.match||!this.healthy(p)){p.pending=null;break;}
    if(bytes.byteLength>Math.min(p.pc.sctp?.maxMessageSize||65536,61440)){p.lastPong=0;break;}
    if(value){p.sent.set(seq,value);while(p.sent.size>32)p.sent.delete(p.sent.keys().next().value);}p.fast.send(bytes);this.sentFast++;
   }}catch{this.errors++;p.lastPong=0;}finally{p.encoding=false;}
 }
 send(message){
  if(!this.room||!this.playing)return false;
  if(this.host&&message.type==='snapshot'){
   this.lastSnapshot=message.state;const recipients=[];for(const peer of this.room.players){if(peer.id===this.id)continue;const state=privateSnapshot(message.state,peer.slot);if(!this.push(this.peers.get(peer.id),{kind:'snapshot',match:this.match,state}))recipients.push(peer.id);}
   if(recipients.length)this.relay({...message,match:this.match,recipients});return true;
  }
  if(this.host&&message.type==='result'&&this.lastSnapshot)this.relay({type:'snapshot',state:this.lastSnapshot,match:this.match});
  if(this.host)return false;const p=this.peers.get(this.room.hostId);
  if(message.type==='input')return this.push(p,{kind:'input',match:this.match,input:message.input});
  if(message.type==='control')return this.healthy(p)&&this.reliable(p,{kind:'control',match:this.match,input:message.input});
  if(message.type==='action'&&ACTIONS.has(message.action)){
   const actionId=this.session+':'+this.match+':'+(++this.actionSerial),packet={...message,match:this.match,actionId};this.pendingActions.set(actionId,{target:this.room.hostId,message:packet,created:now(),last:now()});
   if(!this.healthy(p)||!this.reliable(p,{kind:'action',match:this.match,action:message.action,actionId}))this.relay(packet);return true;
  }
  return false;
 }
 tick(){
  if(this.closed)return;this.sync();for(const p of this.peers.values()){
   if(now()-p.lastPing>=500)this.ping(p);
   if(now()-p.created>20000&&!this.healthy(p)&&now()-p.lastPong>5000){if(this.host)void this.offer(p.id).catch(()=>{this.errors++;});else{p.created=now();this.signal(p.id,{kind:'restart'});}}
  }
  for(const [id,a]of this.pendingActions){if(now()-a.created>5000){this.pendingActions.delete(id);continue;}if(now()-a.last>750){a.last=now();this.relay(a.message);}}
 }
 stats(){const list=[...this.peers.values()].map(p=>({id:p.id,direct:this.healthy(p),rtt:p.rtt,state:p.pc.connectionState}));const host=list.find(p=>p.id===this.room?.hostId);return {mode:this.host?(list.some(p=>p.direct)?'direct':'relay'):host?.direct?'direct':'relay',rtt:host?.rtt??null,direct:list.filter(p=>p.direct).length,total:list.length,sentFast:this.sentFast,receivedFast:this.receivedFast,pendingActions:this.pendingActions.size,errors:this.errors,peers:list};}
 drop(id){const p=this.peers.get(id);if(!p)return;this.peers.delete(id);p.pending=null;p.pc.onicecandidate=null;p.pc.ondatachannel=null;p.pc.onconnectionstatechange=null;for(const channel of [p.fast,p.reliable])if(channel){channel.onclose=null;channel.onmessage=null;channel.onerror=null;try{channel.close();}catch{}}try{p.pc.close();}catch{}}
 closePeers(){for(const id of [...this.peers.keys()])this.drop(id);this.pendingCandidates.clear();this.pendingActions.clear();}
 setEnabled(enabled){this.disabled=!enabled;if(this.disabled)this.closePeers();else{this.sync();if(this.room&&!this.host)this.signal(this.room.hostId,{kind:'restart'});}}
 reset(){this.closePeers();this.room=null;this.id=null;this.playing=false;this.match=0;this.lastSnapshot=null;this.seenActions.clear();}
 close(){this.closed=true;clearInterval(this.timer);this.closePeers();}
}

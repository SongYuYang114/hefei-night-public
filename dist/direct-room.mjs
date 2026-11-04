import {PeerRoom} from './p2p.mjs';
import {encodePacket,decodePacket,privateSnapshot} from './p2p-codec.mjs';
import {DIRECT_ICE_SERVERS,collectCandidates,candidateSummary,connectionDiagnosis} from './direct-connect.mjs';
export const DIRECT_PROTOCOL=32;
const now=()=>performance.now(),clone=v=>JSON.parse(JSON.stringify(v));
const uid=()=>crypto.randomUUID(),nameOf=v=>String(v||'玩家').replace(/[\u0000-\u001f<>]/g,'').slice(0,16),validId=v=>typeof v==='string'&&/^[a-zA-Z0-9-]{8,64}$/.test(v);
async function pack(value){const bytes=await encodePacket(value);return 'HFY1.'+btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
async function unpack(code,type){
 const text=String(code||'').replace(/\s+/g,'');if(text.length>100000||!/^HFY1\.[a-zA-Z0-9_-]+$/.test(text))throw Error('请粘贴完整的 HFY1. 开头的连接信息。');
 let value;try{const raw=atob(text.slice(5).replace(/-/g,'+').replace(/_/g,'/'));value=await decodePacket(Uint8Array.from(raw,c=>c.charCodeAt(0)));}catch{throw Error('连接信息损坏，请重新复制。');}
 if(value?.protocol!==DIRECT_PROTOCOL||value.type!==type||!validId(value.roomId)||!validId(value.hostId)||!validId(value.guestId)||!validId(value.generation)||typeof value.sdp!=='string'||value.sdp.length>32768)throw Error('连接信息或游戏版本不一致，请双方使用 v1.29.0。');return value;
}
export class DirectRoom extends PeerRoom{
 constructor({deliver,onStatus=()=>{},...options}={}){
  super({iceServers:DIRECT_ICE_SERVERS,...options,relay:()=>{},deliver});this.onStatus=onStatus;this.invitations=new Map();this.roomId=null;this.pureP2P=true;this.relayAttempts=0;
  // Even inherited retry/error paths cannot contact a game server.
  this.relay=()=>{this.relayAttempts++;};
 }
 signal(to,message){if(message.kind==='candidate'&&this.peers.get(to)?.trickle)this.candidateSender?.(to,message);}
 sync(){}
 create(id,generation){
  const p=super.create(id,generation);p.iceErrors=[];p.setupAt=now();
  p.pc.onicecandidateerror=e=>{if(p.iceErrors.length<12)p.iceErrors.push({code:e.errorCode,server:String(e.url||'').slice(0,120)});};
  return p;
 }
 emit(message){this.deliver(message);}
 error(message,id=this.id){if(id===this.id)this.emit({type:'error',message});else this.reliable(this.peers.get(id),{kind:'notice',message});}
 descriptor(options,id){return {id,name:nameOf(options.name),slot:Number.isInteger(options.slot)&&options.slot>=0&&options.slot<=4?options.slot:0,character:Number.isInteger(options.character)&&options.character>=0&&options.character<=5?options.character:0,hunterCharacter:options.hunterCharacter===1?1:0,ready:false};}
 createHost(options={}){
  this.reset();this.id=uid();this.roomId=uid();this.admitted=true;const peer=this.descriptor(options,this.id);if(peer.slot===4)peer.character=null;
  this.room={type:'room',protocol:DIRECT_PROTOCOL,code:'纯P2P',hostId:this.id,phase:'lobby',players:[peer],p2p:{stun:false,pure:true}};
  this.emit({type:'welcome',id:this.id});this.publish();return {id:this.id};
 }
 async createInvitation({trickle=false,guestId=uid()}={}){
  if(!this.host||this.room.phase!=='lobby')throw Error('请先创建直连房间，回到选人界面后邀请玩家。');
  if(this.room.players.length+this.invitations.size>=5)throw Error('连接名额已满，请先取消未使用的邀请。');
  if(!validId(guestId)||this.peers.has(guestId))throw Error('连接信息无效，请重新加入。');const generation=uid(),p=this.create(guestId,generation);p.trickle=trickle;this.invitations.set(guestId,{p,info:null});
  try{this.attach(p,p.pc.createDataChannel('reliable',{ordered:true}));this.attach(p,p.pc.createDataChannel('realtime',{ordered:false,maxRetransmits:0}));await p.pc.setLocalDescription(await p.pc.createOffer());if(!trickle)p.publishedCandidates=await collectCandidates(p.pc);
   if(this.peers.get(guestId)!==p)throw Error('邀请已取消，请重新生成。');return await pack({type:'invite',protocol:DIRECT_PROTOCOL,roomId:this.roomId,hostId:this.id,guestId,generation,host:this.room.players.find(v=>v.id===this.id),sdp:p.pc.localDescription.sdp});
  }catch(e){this.invitations.delete(guestId);this.drop(guestId);throw e;}
 }
 async joinInvitation(code,options={}, {trickle=false}={}){
  const invite=await unpack(code,'invite');if(!invite.host||invite.host.id!==invite.hostId)throw Error('房主信息无效。');
  this.reset();this.id=invite.guestId;this.roomId=invite.roomId;this.admitted=false;this.desired=this.descriptor(options,this.id);const host=this.descriptor(invite.host,invite.hostId);if(host.slot===4)host.character=null;
  this.room={type:'room',protocol:DIRECT_PROTOCOL,code:'纯P2P',hostId:invite.hostId,phase:'lobby',players:[host,this.desired],p2p:{stun:false,pure:true}};
  this.room.code=options.code||this.room.code;this.emit({type:'welcome',id:this.id});this.emit(clone(this.room));const p=this.create(invite.hostId,invite.generation);p.trickle=trickle;
  try{await p.pc.setRemoteDescription({type:'offer',sdp:invite.sdp});await this.drainCandidates(p);await p.pc.setLocalDescription(await p.pc.createAnswer());if(!trickle)p.publishedCandidates=await collectCandidates(p.pc);
   return {id:this.id,answer:await pack({type:'answer',protocol:DIRECT_PROTOCOL,roomId:this.roomId,hostId:invite.hostId,guestId:this.id,generation:invite.generation,peer:this.desired,sdp:p.pc.localDescription.sdp})};
  }catch(e){this.reset();throw e;}
 }
 async importResponse(code){
  if(!this.host||this.room.phase!=='lobby')throw Error('请在房主选人界面导入回应。');const response=await unpack(code,'answer');
  if(response.roomId!==this.roomId||response.hostId!==this.id)throw Error('这份回应不属于当前房间。');const invite=this.invitations.get(response.guestId);
  if(!invite||invite.p.generation!==response.generation)throw Error('邀请已失效或回应已导入，请重新生成邀请。');
  if(!response.peer||response.peer.id!==response.guestId)throw Error('玩家信息无效。');
  if(invite.p.pc.remoteDescription)throw Error('已导入此玩家的回应，正在建立直连。');invite.info=this.descriptor(response.peer,response.guestId);
  await invite.p.pc.setRemoteDescription({type:'answer',sdp:response.sdp});await this.drainCandidates(invite.p);invite.p.setupAt=now();this.admit(invite.p);return true;
 }
 async receiveCandidate(id,message){
  if(!validId(id)||!validId(message.generation)||!message.candidate)return;
  const p=this.peers.get(id);if(!p||p.generation!==message.generation)return;
  if(p.pc.remoteDescription)await p.pc.addIceCandidate(message.candidate);else if(p.candidates.length<48)p.candidates.push(message.candidate);
 }
 async drainCandidates(p){for(const candidate of p.candidates.splice(0))await p.pc.addIceCandidate(candidate);}
 cancelInvitations(){for(const id of this.invitations.keys())this.drop(id);this.invitations.clear();}
 attach(p,channel){
  super.attach(p,channel);const open=channel.onopen;channel.onopen=()=>{open?.();p.connectedAt=now();if(this.host)this.admit(p);else if(channel.label==='reliable')this.reliable(p,{kind:'hello',roomId:this.roomId});};
  if(channel.label==='reliable'){p.readQueue=Promise.resolve();channel.onmessage=e=>{p.readQueue=p.readQueue.then(async()=>{if(this.peers.get(p.id)!==p)return;let message;if(typeof e.data==='string'){if(e.data.length>16384)return;message=JSON.parse(e.data);}else message=await decodePacket(e.data);this.control(p,message);}).catch(()=>{this.errors++;});};}
 }
 enqueue(p,make){
  if(!p||p.reliable?.readyState!=='open'||(p.outbox||0)>=64||p.reliable.bufferedAmount>262144)return false;p.outbox=(p.outbox||0)+1;
  p.writeQueue=(p.writeQueue||Promise.resolve()).then(async()=>{const data=await make();if(this.peers.get(p.id)===p&&p.reliable.readyState==='open')p.reliable.send(data);}).catch(()=>{this.errors++;p.lastPong=0;}).finally(()=>p.outbox--);return true;
 }
 reliable(p,message){return this.enqueue(p,()=>JSON.stringify(message));}
 admit(p){
  const invitation=this.invitations.get(p.id);if(!this.host||!invitation?.info||p.reliable?.readyState!=='open'||p.fast?.readyState!=='open')return;
  if(this.room.phase!=='lobby'||this.room.players.length>=5){this.reliable(p,{kind:'notice',message:'房间已开始或人数已满，请等待下一局。'});return;}
  const info=invitation.info,slots=new Set(this.room.players.map(v=>v.slot));info.slot=slots.has(info.slot)?[0,1,2,3,4].find(v=>!slots.has(v)):info.slot;
  const chars=new Set(this.room.players.filter(v=>v.slot!==4).map(v=>v.character));info.character=info.slot===4?null:chars.has(info.character)?[0,1,2,3,4,5].find(v=>!chars.has(v)):info.character;
  this.invitations.delete(p.id);this.room.players.push(info);this.publish();
 }
 publish(){if(!this.host)return;for(const peer of this.room.players)if(peer.id!==this.id)this.reliable(this.peers.get(peer.id),{kind:'roster',room:clone(this.room)});this.emit(clone(this.room));}
 validRoster(value){
  if(!value||value.hostId!==this.room?.hostId||value.protocol!==DIRECT_PROTOCOL||!['lobby','playing','result'].includes(value.phase)||!Array.isArray(value.players)||value.players.length>5)return false;
  const ids=new Set(),slots=new Set(),chars=new Set();for(const p of value.players){if(!validId(p.id)||ids.has(p.id)||!Number.isInteger(p.slot)||p.slot<0||p.slot>4||slots.has(p.slot))return false;ids.add(p.id);slots.add(p.slot);if(p.slot===4&&![0,1].includes(p.hunterCharacter??0))return false;if(p.slot!==4){if(!Number.isInteger(p.character)||p.character<0||p.character>5||chars.has(p.character))return false;chars.add(p.character);}p.name=nameOf(p.name);p.ready=p.ready===true;}return ids.has(this.id)&&ids.has(value.hostId);
 }
 command(id,message){
  const peer=this.room?.players.find(v=>v.id===id);if(!this.host||!peer||this.room.phase==='playing')return;
  if(message.type==='ready'){peer.ready=message.ready===true;this.publish();return;}
  if(message.type!=='select'||!Number.isInteger(message.slot)||message.slot<0||message.slot>4)return;
  if(message.slot===4){if(message.hunterCharacter!==undefined&&![0,1].includes(message.hunterCharacter))return;if(this.room.players.some(p=>p!==peer&&p.slot===4)){this.error('追杀者已有人选择。',id);return;}peer.slot=4;peer.character=null;if(message.hunterCharacter!==undefined)peer.hunterCharacter=message.hunterCharacter;}
  else{const character=message.character??message.slot;if(!Number.isInteger(character)||character<0||character>5)return;if(this.room.players.some(p=>p!==peer&&p.slot!==4&&p.character===character)){this.error('该角色已有人选择。',id);return;}const occupied=new Set(this.room.players.filter(p=>p!==peer).map(p=>p.slot));const slot=peer.slot!==4?peer.slot:[0,1,2,3].find(n=>!occupied.has(n));if(slot===undefined){this.error('逃生者阵营已满。',id);return;}peer.slot=slot;peer.character=character;}
  peer.ready=false;this.publish();
 }
 control(p,m){
  if(!m||typeof m!=='object')return;
  if(m.kind==='hello'&&this.host&&m.roomId===this.roomId){this.admit(p);return;}
  if(m.kind==='lobby-command'&&this.host){this.command(p.id,m.message||{});return;}
  if(m.kind==='leave'&&this.host){this.removePlayer(p.id);return;}
  if(!this.host&&p.id===this.room?.hostId){
   if(m.kind==='roster'){if(this.validRoster(m.room)){this.admitted=true;this.room=clone(m.room);this.emit(clone(this.room));}return;}
   if(m.kind==='start'&&Number.isSafeInteger(m.match)&&m.match>this.match&&Number.isInteger(m.spawnSeed)){const start={type:'start',match:m.match,spawnSeed:m.spawnSeed,difficulty:['easy','normal','hard'].includes(m.difficulty)?m.difficulty:'normal'};super.observe(start);this.emit(start);return;}
   if(m.kind==='end'&&m.match===this.match&&this.playing&&Array.isArray(m.state?.survivors)&&m.state.survivors.length===4&&['hunter','survivor','draw'].includes(m.result)){this.emit({type:'snapshot',match:this.match,state:m.state});const result={type:'result',result:m.result};super.observe(result);this.emit(result);return;}
   if(m.kind==='lobby'){super.observe({type:'lobby'});this.emit({type:'lobby'});return;}
   if(m.kind==='left'){this.emit({type:'left',id:m.id,slot:m.slot});return;}
   if(m.kind==='notice'){this.emit({type:'feedback',message:String(m.message||'').slice(0,150)});return;}
   if(m.kind==='shutdown'){this.emit({type:'closed',message:'房主已关闭纯 P2P 房间。'});return;}
  }
  super.control(p,m);
 }
 acceptAction(id,actionId){
  if(typeof actionId!=='string'||actionId.length>96||!/^[a-zA-Z0-9:-]+$/.test(actionId))return false;this.reliable(this.peers.get(id),{kind:'action-ack',actionId});const key=id+':'+actionId;if(this.seenActions.has(key))return false;this.seenActions.add(key);while(this.seenActions.size>256)this.seenActions.delete(this.seenActions.values().next().value);return true;
 }
 canStart(){return !!this.host&&this.room?.phase!=='playing'&&this.invitations.size===0&&this.room.players.every(p=>p.id===this.id||p.ready&&this.healthy(this.peers.get(p.id)));}
 send(message){
  if(!this.room)return true;
  if(['select','ready'].includes(message.type)){if(this.host)this.command(this.id,message);else this.reliable(this.peers.get(this.room.hostId),{kind:'lobby-command',message});return true;}
  if(message.type==='start'&&this.host){
   if(!this.canStart()){this.error('请等待所有玩家完成 P2P 直连并准备。');return true;}this.cancelInvitations();const start={type:'start',match:this.match+1,spawnSeed:crypto.getRandomValues(new Uint32Array(1))[0],difficulty:['easy','normal','hard'].includes(message.difficulty)?message.difficulty:'normal'};
   this.room.phase='playing';this.publish();super.observe(start);for(const p of this.room.players)if(p.id!==this.id)this.reliable(this.peers.get(p.id),{kind:'start',...start});this.emit(start);return true;
  }
  if(message.type==='lobby'&&this.host){this.room.phase='lobby';this.room.players.forEach(p=>p.ready=false);super.observe({type:'lobby'});for(const p of this.room.players)if(p.id!==this.id)this.reliable(this.peers.get(p.id),{kind:'lobby'});this.publish();this.emit({type:'lobby'});return true;}
  if(message.type==='feedback'&&this.host){this.reliable(this.peers.get(message.id),{kind:'notice',message:String(message.message||'').slice(0,150)});return true;}
  if(!this.playing)return true;
  if(this.host&&message.type==='snapshot'){this.lastSnapshot=message.state;for(const p of this.room.players)if(p.id!==this.id)this.push(this.peers.get(p.id),{kind:'snapshot',match:this.match,state:privateSnapshot(message.state,p.slot)});return true;}
  if(this.host&&message.type==='result'){
   for(const peer of this.room.players)if(peer.id!==this.id){const frame={kind:'end',match:this.match,result:message.result,state:privateSnapshot(this.lastSnapshot||{},peer.slot)};this.enqueue(this.peers.get(peer.id),()=>encodePacket(frame));}
   this.room.phase='result';super.observe({type:'result'});this.publish();return true;
  }
  if(this.host)return true;const p=this.peers.get(this.room.hostId);
  if(message.type==='input'){this.push(p,{kind:'input',match:this.match,input:message.input});return true;}
  if(message.type==='control'){if(this.healthy(p))this.reliable(p,{kind:'control',match:this.match,input:message.input});return true;}
  if(message.type==='action'&&['skill','attack','item'].includes(message.action)){
   if(!this.healthy(p)){this.emit({type:'feedback',message:'P2P 直连尚未恢复，当前操作未发送；此版本没有中继备用。'});return true;}
   const actionId=this.session+':'+this.match+':'+(++this.actionSerial),packet={kind:'action',match:this.match,action:message.action,actionId};this.pendingActions.set(actionId,{target:this.room.hostId,message:packet,created:now(),last:now()});this.reliable(p,packet);
  }
  return true;
 }
 removePlayer(id){const peer=this.room?.players.find(p=>p.id===id);if(!this.host||!peer||id===this.id)return;this.drop(id);this.room.players=this.room.players.filter(p=>p.id!==id);this.emit({type:'left',id,slot:peer.slot});for(const other of this.room.players)if(other.id!==this.id)this.reliable(this.peers.get(other.id),{kind:'left',id,slot:peer.slot});this.publish();}
 tick(){
  if(this.closed||!this.invitations)return;
  for(const p of [...this.peers.values()]){if(now()-p.lastPing>=500)this.ping(p);if(p.connectedAt&&now()-(p.lastPong||p.connectedAt)>8000){if(this.host&&this.room?.players.some(v=>v.id===p.id))this.removePlayer(p.id);else if(!this.host&&this.room){this.emit({type:'closed',message:'与房主的 P2P 直连已中断。当前没有服务器中继，请重新交换连接信息。'});}}}
  for(const [id,a]of this.pendingActions){const p=this.peers.get(a.target);if(!this.healthy(p)||now()-a.created>5000){this.pendingActions.delete(id);continue;}if(now()-a.last>750){a.last=now();this.reliable(p,a.message);}}
  this.onStatus(this.stats());
 }
 stats(){const base=super.stats(),ids=new Set(this.room?.players.filter(p=>p.id!==this.id).map(p=>p.id)||[]),peers=base.peers.filter(p=>ids.has(p.id));const direct=peers.filter(p=>p.direct).length;
  const connections=[...this.peers.values()].map(p=>({direct:this.healthy(p),state:p.pc.connectionState,ice:p.pc.iceConnectionState,gathering:p.pc.iceGatheringState,waitingResponse:this.host&&!p.pc.remoteDescription,waitingMs:Math.round(now()-p.setupAt),local:p.publishedCandidates||candidateSummary(p.pc.localDescription?.sdp),remote:candidateSummary(p.pc.remoteDescription?.sdp),iceErrors:p.iceErrors||[]}));
  return {...base,mode:direct?'direct':this.room?'connecting':'disconnected',direct,total:peers.length,peers,pureP2P:true,admitted:this.host||this.admitted===true,relayAllowed:false,relayAttempts:this.relayAttempts,awaitingResponses:this.invitations?.size||0,connections,diagnosis:connectionDiagnosis(connections)};
 }
 async leave(){if(this.host){for(const p of this.room.players)if(p.id!==this.id)this.reliable(this.peers.get(p.id),{kind:'shutdown'});}else if(this.room)this.reliable(this.peers.get(this.room.hostId),{kind:'leave'});await new Promise(r=>setTimeout(r,150));this.reset();}
 reset(){super.reset();this.invitations?.clear();this.roomId=null;this.admitted=false;}
}

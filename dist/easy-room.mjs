const wait=ms=>new Promise(r=>setTimeout(r,ms));
export class EasyRoom{
 constructor({room,bridge,onStatus=()=>{}}){this.room=room;this.bridge=bridge;this.onStatus=onStatus;this.epoch=0;this.active=false;this.connected=false;this.routes=new Map();this.reverse=new Map();this.early=[];this.work=Promise.resolve();this.timers=new Map();this.room.candidateSender=(to,signal)=>this.sendCandidate(to,signal);this.timer=setInterval(()=>this.sync(),400);this.timer.unref?.();}
 status(){return {active:this.active,connected:this.connected,code:this.code||'',message:this.message||''};}
 changed(message){this.message=message;this.onStatus(this.status());}
 async begin(create,code,options){
  if(!this.bridge?.signalConnect)throw Error('请使用新版 EXE 进行房间号联机。');await this.close();const epoch=++this.epoch;this.active=true;this.options=options;this.created=create;this.changed(create?'正在生成房间号…':'正在联系房主并建立 P2P 直连…');
  this.unsubscribe=this.bridge.onSignal(m=>{this.work=this.work.then(()=>{if(epoch===this.epoch)return this.handle(m);}).catch(e=>{if(epoch===this.epoch)this.changed(e.message||'连接信息交换失败，请重新加入。');});});
  try{
   const result=await this.bridge.signalConnect({create,code:String(code||'')});if(epoch!==this.epoch)throw Error('已取消联机。');if(!result?.ok)throw Error(result?.message||'房间号服务暂不可用，请稍后重试。');
   this.id=result.id;this.hostId=result.hostId;this.code=result.code;this.connected=true;
   if(create){this.room.createHost(options);this.room.room.code=this.code;this.room.publish();this.changed('房间已创建，把六位房间号发给朋友即可。');}
   for(const m of this.early.splice(0))await this.handle(m);
   if(!create){const end=performance.now()+45000;while(epoch===this.epoch&&performance.now()<end){const stats=this.room.stats();if(stats.direct&&stats.admitted){this.changed('已与房主建立 P2P 直连。');return {id:this.room.id,code:this.code};}if(!this.connected)throw Error(this.message);if(stats.diagnosis.code==='ice-failed')throw Error(stats.diagnosis.message);await wait(100);}throw Error(epoch===this.epoch?'未能建立 P2P 直连，请退出 VPN／加速器或更换网络后重试。':'已取消联机。');}
   return {id:this.room.id,code:this.code};
  }catch(e){if(epoch===this.epoch){await this.close();if(!create)this.room.reset();}throw e;}
 }
 create(options){return this.begin(true,'',options);}
 join(code,options){if(!/^\d{6}$/.test(String(code).trim()))throw Error('请输入房主分享的六位房间号。');return this.begin(false,String(code).trim(),options);}
 send(to,data){if(this.connected)this.bridge.signalSend({type:'exchange',to,data});}
 sendCandidate(to,signal){const target=this.created?this.routes.get(to):this.hostId;if(target)this.send(target,{kind:'candidate',from:this.room.id,generation:signal.generation,candidate:signal.candidate});}
 async handle(m){
  if(!this.active)return;if(!this.connected){if(!this.id&&this.early.length<100)this.early.push(m);return;}
  if(['closed','host-left'].includes(m.type)){this.connected=false;this.changed('房间号服务已断开，已连上的玩家可继续；新玩家请使用手动直连。');return;}
  if(m.type==='error'){this.changed(m.message||'连接信息交换失败。');if(!this.created)this.connected=false;return;}
  if(m.type==='peer-left'&&this.created){this.removeRoute(m.id);return;}
  if(m.type==='peer-joined'&&this.created){
   if(this.room.room?.phase!=='lobby'){this.bridge.signalSend({type:'remove',id:m.id});return;}
   const directId=crypto.randomUUID();this.routes.set(directId,m.id);this.reverse.set(m.id,directId);const epoch=this.epoch;
   this.timers.set(m.id,setTimeout(()=>{if(epoch===this.epoch&&this.room.invitations.has(directId)){this.removeRoute(m.id);this.bridge.signalSend({type:'remove',id:m.id});this.changed('一位玩家未能直连，可重新输入房间号尝试。');}},45000));
   try{const code=await this.room.createInvitation({guestId:directId,trickle:true});if(epoch===this.epoch)this.send(m.id,{kind:'invite',code});}catch(e){this.removeRoute(m.id);this.bridge.signalSend({type:'remove',id:m.id});this.changed(e.message);}return;
  }
  if(m.type!=='exchange'||!m.data)return;const data=m.data;
  if(data.kind==='candidate'){
   const directId=this.created?this.reverse.get(m.from):data.from;if(!directId||!this.created&&m.from!==this.hostId)return;
   if(!this.room.peers.has(directId)){if(this.early.length<100)this.early.push(m);return;}await this.room.receiveCandidate(directId,data);return;
  }
  if(data.kind==='invite'&&!this.created&&m.from===this.hostId){
   const epoch=this.epoch,result=await this.room.joinInvitation(data.code,{...this.options,code:this.code},{trickle:true});if(epoch!==this.epoch)return;this.send(this.hostId,{kind:'answer',code:result.answer});const pending=this.early.splice(0);for(const event of pending)await this.handle(event);return;
  }
  if(data.kind==='answer'&&this.created&&this.reverse.has(m.from)){try{await this.room.importResponse(data.code);}catch(e){this.changed(e.message);}return;}
 }
 removeRoute(signalId){const id=this.reverse.get(signalId);if(id&&this.room.invitations.has(id)){this.room.invitations.delete(id);this.room.drop(id);}this.routes.delete(id);this.reverse.delete(signalId);clearTimeout(this.timers.get(signalId));this.timers.delete(signalId);}
 sync(){
  if(!this.active||!this.connected||!this.created||!this.room.room)return;
  const open=this.room.room.phase==='lobby';if(open!==this.open){this.open=open;this.bridge.signalSend({type:'availability',open});}
  for(const [signalId,id]of this.reverse){if(this.room.room.players.some(p=>p.id===id)){clearTimeout(this.timers.get(signalId));this.timers.delete(signalId);}else if(!this.room.peers.has(id)){this.removeRoute(signalId);this.bridge.signalSend({type:'remove',id:signalId});}}
 }
 async close(){const wasActive=this.active||this.connected||!!this.unsubscribe;this.epoch++;this.unsubscribe?.();this.unsubscribe=null;this.active=false;this.connected=false;this.id=null;this.hostId=null;this.code=null;this.open=undefined;for(const timer of this.timers.values())clearTimeout(timer);this.timers.clear();this.routes.clear();this.reverse.clear();this.early=[];this.message='';if(wasActive&&this.bridge?.signalClose)await this.bridge.signalClose();}
 destroy(){clearInterval(this.timer);return this.close();}
}

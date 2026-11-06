// Connection setup only. No match simulation, controls, coordinates or relay.
const tls=require('node:tls'),fs=require('node:fs'),path=require('node:path');
const {randomUUID,randomInt}=require('node:crypto');
const SIGNAL_PROTOCOL=1,GAME_PROTOCOL=36,DEFAULT_PORT=29805,DEFAULT_HOST=process.env.HEFEI_SIGNAL_HOST;
const MAX_LINE=100000;
function send(socket,value){if(!socket.destroyed&&socket.writableLength<512*1024)socket.write(JSON.stringify(value)+'\n');else socket.destroy();}
function listen(socket,onMessage){let buffer='';socket.setNoDelay(true);socket.setKeepAlive(true,10000);socket.setEncoding('utf8');socket.on('data',chunk=>{buffer+=chunk;if(buffer.length>MAX_LINE*2){socket.destroy();return;}let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);if(line.length>MAX_LINE){socket.destroy();return;}try{const m=JSON.parse(line);if(m&&typeof m==='object')onMessage(m);}catch{socket.destroy();return;}}if(buffer.length>MAX_LINE)socket.destroy();});socket.on('error',()=>{});}
function setupPayload(m){
 if(!m||typeof m!=='object')return null;
 if(['invite','answer'].includes(m.kind)&&typeof m.code==='string'&&m.code.length<=90000&&/^HFY1\.[a-zA-Z0-9_-]+$/.test(m.code))return {kind:m.kind,code:m.code};
 if(m.kind==='candidate'&&typeof m.from==='string'&&m.from.length<=64&&typeof m.generation==='string'&&m.generation.length<=64&&m.candidate&&typeof m.candidate.candidate==='string'&&m.candidate.candidate.length<=2048)return {kind:'candidate',from:m.from,generation:m.generation,candidate:{candidate:m.candidate.candidate,sdpMid:typeof m.candidate.sdpMid==='string'?m.candidate.sdpMid.slice(0,64):null,sdpMLineIndex:Number.isInteger(m.candidate.sdpMLineIndex)?m.candidate.sdpMLineIndex:null,usernameFragment:typeof m.candidate.usernameFragment==='string'?m.candidate.usernameFragment.slice(0,256):undefined}};
 if(m.kind==='reject')return {kind:'reject',message:'当前无法加入，请稍后重试。'};
 return null;
}
async function createSignalingServer({host='0.0.0.0',port=DEFAULT_PORT,tlsOptions}={}){
 if(!tlsOptions)throw Error('TLS certificate required');
 const rooms=new Map(),sockets=new Set(),budgets=new Map(),metrics={acceptedConnections:0,exchanges:0,rejectedMessages:0};
 const fail=(p,message)=>send(p.socket,{type:'error',message});
 const remove=p=>{if(!p.room)return;const room=p.room;p.room=null;room.peers.delete(p.id);if(p.id===room.hostId){rooms.delete(room.code);for(const other of room.peers.values()){other.room=null;send(other.socket,{type:'host-left'});}room.peers.clear();}else{const hostPeer=room.peers.get(room.hostId);if(hostPeer)send(hostPeer.socket,{type:'peer-left',id:p.id});}};
 const server=tls.createServer({...tlsOptions,minVersion:'TLSv1.2'},socket=>{
  sockets.add(socket);metrics.acceptedConnections++;const p={socket,id:randomUUID(),room:null,lastSeen:Date.now(),window:0,count:0};let welcomed=false;
  const handshake=setTimeout(()=>socket.destroy(),8000);handshake.unref();
  socket.on('close',()=>{clearTimeout(handshake);sockets.delete(socket);remove(p);});
  listen(socket,m=>{
   p.lastSeen=Date.now();if(m.type==='ping'){send(socket,{type:'pong'});return;}
   if(!welcomed){
    if(m.protocol!==SIGNAL_PROTOCOL||![25,26,27,28,29,30,31,32,33,34,35,GAME_PROTOCOL].includes(m.gameProtocol)){fail(p,'联机版本不一致，请使用 v1.0.0。');return;}
    const address=socket.remoteAddress||'unknown',budget=budgets.get(address)||{start:Date.now(),attempts:0};if(Date.now()-budget.start>60000){budget.start=Date.now();budget.attempts=0;}budgets.set(address,budget);if(++budget.attempts>40){fail(p,'尝试过于频繁，请稍后重试。');socket.end();return;}
    let room;if(m.type==='create'){
     if(rooms.size>=100){fail(p,'当前房间较多，请稍后重试。');return;}let code;do{code=String(randomInt(100000,1000000));}while(rooms.has(code));room={code,hostId:p.id,gameProtocol:m.gameProtocol,peers:new Map(),open:true};rooms.set(code,room);
    }else if(m.type==='join'){
     room=rooms.get(String(m.code));if(!room){fail(p,'房间不存在，请检查六位房间号。');return;}if(room.gameProtocol!==m.gameProtocol){fail(p,'房间游戏版本不同，请所有玩家更新到 v1.0.0。');return;}if(!room.open){fail(p,'对局已开始，请等待房主返回选人。');return;}if(room.peers.size>=5){fail(p,'房间已满，最多 5 人。');return;}
    }else{metrics.rejectedMessages++;socket.destroy();return;}
    welcomed=true;clearTimeout(handshake);p.room=room;room.peers.set(p.id,p);send(socket,{type:'welcome',id:p.id,code:room.code,hostId:room.hostId});if(p.id!==room.hostId)send(room.peers.get(room.hostId).socket,{type:'peer-joined',id:p.id});return;
   }
   const room=p.room;if(!room){fail(p,'房主已关闭房间口令，已建立的 P2P 对局不受影响。');return;}
   if(m.type==='availability'&&p.id===room.hostId){room.open=m.open===true;return;}
   if(m.type==='remove'&&p.id===room.hostId){const other=room.peers.get(m.id);if(other&&other!==p){send(other.socket,{type:'error',message:'连接未完成，请重新输入房间号加入。'});other.socket.end();remove(other);}return;}
   if(m.type==='leave'){remove(p);socket.end();return;}
   if(m.type!=='exchange'){metrics.rejectedMessages++;fail(p,'该服务仅交换连接信息，不接收对局数据。');return;}
   if(Date.now()-p.window>1000){p.window=Date.now();p.count=0;}if(++p.count>80){socket.destroy();return;}
   const to=room.peers.get(m.to),data=setupPayload(m.data);if(!to||to===p||p.id!==room.hostId&&to.id!==room.hostId||!data||data.kind==='invite'&&p.id!==room.hostId||data.kind==='answer'&&p.id===room.hostId){metrics.rejectedMessages++;return;}
   metrics.exchanges++;send(to.socket,{type:'exchange',from:p.id,data});
  });
  const timer=setInterval(()=>{if(Date.now()-p.lastSeen>45000)socket.destroy();},10000);timer.unref();socket.once('close',()=>clearInterval(timer));
 });
 server.on('tlsClientError',()=>{});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>{server.removeListener('error',reject);resolve();});});
 const janitor=setInterval(()=>{for(const [ip,b] of budgets)if(Date.now()-b.start>120000)budgets.delete(ip);},60000);janitor.unref();
 return {port:server.address().port,stats:()=>({...metrics,rooms:rooms.size,sockets:sockets.size}),close:async()=>{clearInterval(janitor);for(const s of sockets)s.destroy();await new Promise(r=>server.close(r));}};
}
function connectSignaling({create=false,code='',host=DEFAULT_HOST,port=DEFAULT_PORT,ca=fs.readFileSync(path.join(__dirname,'signal-cert.pem'))}={},onEvent=()=>{}){
 if(!host)return Promise.reject(Error('未配置房间号服务，请使用管理员提供的运行配置，或使用手动直连。'));
 return new Promise((resolve,reject)=>{
  let opened=false,closed=false;const socket=tls.connect({host,port,ca,rejectUnauthorized:true,minVersion:'TLSv1.2'}),timer=setTimeout(()=>{reject(Error('房间口令服务连接超时，请检查网络，或使用手动直连。'));socket.destroy();},8000);
  const heartbeat=setInterval(()=>send(socket,{type:'ping'}),12000);heartbeat.unref();
  const client={send:m=>{if(m?.type==='exchange'){const data=setupPayload(m.data);if(data&&typeof m.to==='string'&&m.to.length<=64)send(socket,{type:'exchange',to:m.to,data});}else if(m?.type==='availability')send(socket,{type:'availability',open:m.open===true});else if(m?.type==='remove'&&typeof m.id==='string'&&m.id.length<=64)send(socket,{type:'remove',id:m.id});},close:()=>{closed=true;send(socket,{type:'leave'});socket.end();setTimeout(()=>socket.destroy(),300).unref();}};
  socket.once('secureConnect',()=>send(socket,{type:create?'create':'join',protocol:SIGNAL_PROTOCOL,gameProtocol:GAME_PROTOCOL,code:String(code)}));
  listen(socket,m=>{if(!opened){if(m.type==='error'){clearTimeout(timer);reject(Error(m.message));client.close();return;}if(m.type==='welcome'){opened=true;clearTimeout(timer);client.id=m.id;client.code=m.code;client.hostId=m.hostId;resolve(client);return;}}if(m.type!=='pong')onEvent(m);});
  socket.once('error',()=>{if(!opened){clearTimeout(timer);reject(Error('无法连接房间口令服务，请检查网络，或使用手动直连。'));}});
  socket.once('close',()=>{clearTimeout(timer);clearInterval(heartbeat);if(!opened)reject(Error('房间口令服务连接已关闭。'));else if(!closed)onEvent({type:'closed',message:'房间口令服务已断开，已建立的 P2P 对局可继续。'});});
 });
}
module.exports={createSignalingServer,connectSignaling,SIGNAL_PROTOCOL,GAME_PROTOCOL,setupPayload};
if(require.main===module){const tlsOptions={key:fs.readFileSync(process.env.HEFEI_TLS_KEY),cert:fs.readFileSync(process.env.HEFEI_TLS_CERT)};createSignalingServer({port:Number(process.argv[2]||DEFAULT_PORT),tlsOptions}).then(s=>{console.log('P2P setup only listening on '+s.port);let ending=false;const close=async()=>{if(ending)return;ending=true;await s.close();process.exit(0);};process.on('SIGTERM',close);process.on('SIGINT',close);}).catch(e=>{console.error(e.message);process.exit(1);});}

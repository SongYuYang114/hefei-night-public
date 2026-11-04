// TCP room relay: hosts simulate the match; guests send controls, never positions.
const net=require('node:net');
const tls=require('node:tls'),fs=require('node:fs'),path=require('node:path');
const os=require('node:os'),zlib=require('node:zlib');
const {randomUUID,randomInt}=require('node:crypto');
const {performance}=require('node:perf_hooks');
const {LatestStreams}=require('./net-stream.cjs');
const {createStunServer}=require('./stun.cjs');
const PROTOCOL=23,DEFAULT_PORT=29804;
const pendingSnapshots=new WeakMap();
function encode(socket,message){const json=JSON.stringify(message);if(socket.hefeiCompression&&message.type==='snapshot'&&Buffer.byteLength(json)>900)return JSON.stringify({type:'compressed',data:zlib.deflateRawSync(json,{level:1}).toString('base64')})+'\n';return json+'\n';}
function send(socket,message){
 if(socket.destroyed)return;
 if(socket.writableLength>=2*1024*1024){socket.destroy();return;}
 if(socket.hefeiLatest){socket.latestStreams.barrier(message.type);if(socket.latestStreams.send(message))return;}
 if(message.type==='snapshot'&&socket.writableLength>64*1024){
  const waiting=pendingSnapshots.has(socket);pendingSnapshots.set(socket,message);
  if(!waiting)socket.once('drain',()=>{const latest=pendingSnapshots.get(socket);pendingSnapshots.delete(socket);if(latest)send(socket,latest);});return;
 }
 if(message.type!=='snapshot'&&pendingSnapshots.has(socket)){const latest=pendingSnapshots.get(socket);pendingSnapshots.delete(socket);socket.write(encode(socket,latest));}
 socket.write(encode(socket,message));
}
function readLines(socket,receive){
 let buffer='';socket.setEncoding('utf8');socket.setNoDelay(true);socket.setKeepAlive(true,10000);
 socket.latestStreams=new LatestStreams(frame=>{if(!socket.destroyed)socket.write(JSON.stringify(frame)+'\n');});socket.once('close',()=>socket.latestStreams.close());
 socket.on('data',chunk=>{buffer+=chunk;
  let end;while((end=buffer.indexOf('\n'))>=0){if(end>256*1024){socket.destroy();return;}const line=buffer.slice(0,end);buffer=buffer.slice(end+1);try{let message=JSON.parse(line);if(message?.type==='compressed'){if(!socket.hefeiCompression||typeof message.data!=='string')throw Error('Invalid compressed frame');message=JSON.parse(zlib.inflateRawSync(Buffer.from(message.data,'base64'),{maxOutputLength:256*1024}).toString('utf8'));}if(socket.hefeiLatest&&socket.latestStreams.receive(message,receive))continue;receive(message);}catch(e){if(process.env.HEFEI_NET_LOG)console.log('Frame rejected:',e.message);socket.destroy();return;}}
  if(buffer.length>256*1024)socket.destroy();
 });socket.on('error',()=>{});
}
function cleanControls(data){
 const keys={};for(const k of ['w','a','s','d','shift','f','q',' '])keys[k]=data?.keys?.[k]===true;
 return {keys,fPress:Number.isSafeInteger(data?.fPress)&&data.fPress>=0&&data.fPress<=1e9?data.fPress:0,jumpPress:Number.isSafeInteger(data?.jumpPress)&&data.jumpPress>=0&&data.jumpPress<=1e9?data.jumpPress:0,yaw:Number.isFinite(data?.yaw)?Math.max(-1e6,Math.min(1e6,data.yaw)):0,
  touch:{x:Number.isFinite(data?.touch?.x)?Math.max(-1,Math.min(1,data.touch.x)):0,z:Number.isFinite(data?.touch?.z)?Math.max(-1,Math.min(1,data.touch.z)):0}};
}
function cleanInput(data){
 const input=cleanControls(data);
 input.serial=Number.isSafeInteger(data?.serial)&&data.serial>=0?data.serial:0;input.seq=Number.isSafeInteger(data?.seq)&&data.seq>=0?data.seq:0;
 if(Array.isArray(data?.commands))input.commands=data.commands.slice(0,12).filter(c=>c&&Number.isSafeInteger(c.seq)&&c.seq>0&&Number.isFinite(c.dt)&&c.dt>0&&c.dt<=.04).map(c=>({seq:c.seq,dt:c.dt,...cleanControls(c)}));
 return input;
}
function parseAddress(address){
 const match=/^(tls:\/\/)?([a-zA-Z0-9.-]+)(?::([0-9]{1,5}))?$/.exec(String(address||'').trim());
 if(!match)throw Error('请输入服务器 IP 或域名，格式如 192.168.1.10:29804');
 const port=Number(match[3]||DEFAULT_PORT);if(port<1||port>65535)throw Error('端口必须是 1–65535');
 return {host:match[2],port,secure:!!match[1]||match[2]==='43.153.216.60'};
}
async function createRoomServer({port=DEFAULT_PORT,host='0.0.0.0',tlsOptions=null}={}){
 const rooms=new Map(),sockets=new Set();let stun=null;
 const roster=room=>({type:'room',protocol:room.protocol,code:room.code,hostId:room.hostId,phase:room.phase,p2p:room.protocol>=23?{stun:!!stun}:undefined,players:[...room.peers.values()].map(p=>({id:p.id,name:p.name,slot:p.slot,character:p.character,ready:p.ready}))});
 const broadcast=(room,message)=>room.peers.forEach(p=>send(p.socket,message));
 const updateRoom=room=>broadcast(room,roster(room));
 const accept=socket=>{
  if(process.env.HEFEI_NET_LOG)console.log('Connection',new Date().toISOString());
  let logged=false;socket.on('data',chunk=>{if(process.env.HEFEI_NET_LOG&&!logged){logged=true;console.log('First packet bytes',Buffer.byteLength(chunk));}});
  sockets.add(socket);const peer={id:randomUUID(),socket,name:'玩家',slot:0,ready:false,room:null,lastInput:0,lastAction:0};
  const handshake=setTimeout(()=>socket.destroy(),7000);
  readLines(socket,m=>{
   if(!m||typeof m.type!=='string')return;if(peer.room&&m.type==='ping'&&Number.isSafeInteger(m.id)){send(socket,{type:'pong',id:m.id});return;}
   if(!peer.room){
    if(![2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,PROTOCOL].includes(m.protocol)){send(socket,{type:'error',message:'联机版本不一致，请使用相同新版游戏。'});return;}
    let room;
    if(m.type==='create'){
     if(rooms.size>=100){send(socket,{type:'error',message:'服务器房间已满'});return;}
     let code;do{code=String(randomInt(100000,1000000));}while(rooms.has(code));
     room={code,protocol:m.protocol,hostId:peer.id,peers:new Map(),phase:'lobby',match:0};rooms.set(code,room);
    }else if(m.type==='join'){
     room=rooms.get(String(m.code));if(!room){send(socket,{type:'error',message:'房间不存在，请检查房间号。'});return;}
     if(room.protocol!==m.protocol){send(socket,{type:'error',message:'房间游戏版本不一致，请和房主使用相同新版游戏。'});return;}
     if(room.phase==='playing'){send(socket,{type:'error',message:'对局已开始，请等待下一局。'});return;}
     if(room.peers.size>=5){send(socket,{type:'error',message:'房间已满（最多 5 人）'});return;}
    }else return;
    socket.hefeiCompression=m.protocol>=12;socket.hefeiLatest=m.protocol>=22;clearTimeout(handshake);peer.name=String(m.name||'玩家').replace(/[\r\n]/g,'').slice(0,16);
    const wanted=Number.isInteger(m.slot)&&m.slot>=0&&m.slot<=4?m.slot:0;
    const taken=new Set([...room.peers.values()].map(p=>p.slot));peer.slot=!taken.has(wanted)?wanted:[0,1,2,3,4].find(n=>!taken.has(n));
    const usedCharacters=new Set([...room.peers.values()].filter(p=>p.slot!==4).map(p=>p.character));
    const desired=room.protocol>=3&&Number.isInteger(m.character)&&m.character>=0&&m.character<=(room.protocol>=9?5:4)?m.character:peer.slot;
    peer.character=peer.slot===4?null:!usedCharacters.has(desired)?desired:Array.from({length:room.protocol>=9?6:5},(_,id)=>id).find(id=>!usedCharacters.has(id));
    peer.room=room;room.peers.set(peer.id,peer);send(socket,{type:'welcome',id:peer.id,code:room.code});updateRoom(room);return;
   }
   const room=peer.room,isHost=peer.id===room.hostId;
   if(room.protocol>=23&&['input','control','action','snapshot','feedback'].includes(m.type)&&m.match!==room.match)return;
   if(m.type==='signal'&&room.protocol>=23){
    const target=room.peers.get(m.to),s=m.signal,now=Date.now();if(!target||target===peer||(!isHost&&target.id!==room.hostId)||!s||typeof s!=='object')return;
    if(now-(peer.signalWindow||0)>1000){peer.signalWindow=now;peer.signals=0;}if((peer.signals=(peer.signals||0)+1)>100)return;
    let signal;if(['offer','answer'].includes(s.kind)&&typeof s.sdp==='string'&&s.sdp.length<=32768&&typeof s.generation==='string'&&s.generation.length<=64)signal={kind:s.kind,sdp:s.sdp,generation:s.generation};
    else if(s.kind==='candidate'&&typeof s.generation==='string'&&s.generation.length<=64&&s.candidate&&typeof s.candidate.candidate==='string'&&s.candidate.candidate.length<=2048)signal={kind:'candidate',generation:s.generation,candidate:{candidate:s.candidate.candidate,sdpMid:typeof s.candidate.sdpMid==='string'?s.candidate.sdpMid.slice(0,64):null,sdpMLineIndex:Number.isInteger(s.candidate.sdpMLineIndex)?s.candidate.sdpMLineIndex:null,usernameFragment:typeof s.candidate.usernameFragment==='string'?s.candidate.usernameFragment.slice(0,256):undefined}};
    else if(s.kind==='action-ack'&&typeof s.actionId==='string'&&s.actionId.length<=96)signal={kind:'action-ack',actionId:s.actionId};
    else if(s.kind==='restart')signal={kind:'restart'};
    if(signal)send(target.socket,{type:'signal',from:peer.id,signal});return;
   }
   if(m.type==='select'&&room.phase!=='playing'){
    if(!Number.isInteger(m.slot)||m.slot<0||m.slot>4)return;
    if(room.protocol===2){
     if([...room.peers.values()].some(p=>p!==peer&&p.slot===m.slot)){send(socket,{type:'error',message:'该角色已有人选择，请选其他角色。'});return;}
     peer.slot=m.slot;peer.character=m.slot===4?null:m.slot;
    }else if(m.slot===4){
     if([...room.peers.values()].some(p=>p!==peer&&p.slot===4)){send(socket,{type:'error',message:'追杀者已有人选择，请选其他角色。'});return;}
     peer.slot=4;peer.character=null;
    }else{
     const character=m.character??m.slot;if(!Number.isInteger(character)||character<0||character>(room.protocol>=9?5:4))return;
     if([...room.peers.values()].some(p=>p!==peer&&p.slot!==4&&p.character===character)){send(socket,{type:'error',message:'该角色已有人选择，请选其他角色。'});return;}
     const occupied=new Set([...room.peers.values()].filter(p=>p!==peer).map(p=>p.slot));
     const slot=peer.slot!==4?peer.slot:!occupied.has(m.slot)?m.slot:[0,1,2,3].find(n=>!occupied.has(n));
     if(slot===undefined){send(socket,{type:'error',message:'逃生者阵营已满'});return;}
     peer.slot=slot;peer.character=character;
    }
    peer.ready=false;updateRoom(room);
   }else if(m.type==='ready'&&room.phase!=='playing'){peer.ready=m.ready===true;updateRoom(room);
   }else if(m.type==='start'&&isHost&&room.phase!=='playing'){
    if([...room.peers.values()].some(p=>p!==peer&&!p.ready)){send(socket,{type:'error',message:'请等待其他玩家准备。'});return;}
    room.phase='playing';room.match++;updateRoom(room);broadcast(room,{type:'start',match:room.match,spawnSeed:randomInt(0,0x100000000),difficulty:['easy','normal','hard'].includes(m.difficulty)?m.difficulty:'normal'});
   }else if(m.type==='control'&&room.protocol>=22&&room.phase==='playing'&&!isHost){
    const now=Date.now();if(now-(peer.lastControl||0)<8)return;peer.lastControl=now;
    send(room.peers.get(room.hostId).socket,{type:'control',id:peer.id,slot:peer.slot,input:cleanInput(m.input),match:room.match});
   }else if(m.type==='input'&&room.phase==='playing'&&!isHost){
    const now=Date.now();if(now-peer.lastInput<12&&!Array.isArray(m.input?.commands))return;peer.lastInput=now;
    send(room.peers.get(room.hostId).socket,{type:'input',id:peer.id,slot:peer.slot,input:cleanInput(m.input),match:room.match});
   }else if(m.type==='action'&&room.phase==='playing'&&!isHost&&(['skill','attack'].includes(m.action)||room.protocol>=4&&m.action==='item')){
    const now=Date.now();if(now-peer.lastAction<100)return;peer.lastAction=now;
    send(room.peers.get(room.hostId).socket,{type:'action',id:peer.id,slot:peer.slot,action:m.action,match:room.match,actionId:room.protocol>=23&&typeof m.actionId==='string'&&m.actionId.length<=96?m.actionId:undefined});
   }else if(m.type==='snapshot'&&isHost&&room.phase==='playing'){
    if(!m.state||!Array.isArray(m.state.survivors)||m.state.survivors.length!==4)return;
    room.peers.forEach(p=>{if(p!==peer&&!(room.protocol>=23&&Array.isArray(m.recipients)&&!m.recipients.includes(p.id))){const state=room.protocol>=8?{...m.state,mailisu:p.slot===4?m.state.mailisu||[]:[],mines:(m.state.mines||[]).filter(mine=>p.slot!==4&&Number.isInteger(mine.ownerSlot)&&mine.ownerSlot===p.slot)}:m.state;send(p.socket,{type:'snapshot',state,match:room.match});}});
   }else if(m.type==='feedback'&&isHost){const target=room.peers.get(m.id);if(target)send(target.socket,{type:'feedback',message:String(m.message||'').slice(0,150)});
   }else if(m.type==='result'&&isHost&&room.phase==='playing'){
    room.phase='result';broadcast(room,{type:'result',result:m.result});updateRoom(room);
   }else if(m.type==='lobby'&&isHost){room.phase='lobby';room.peers.forEach(p=>p.ready=false);broadcast(room,{type:'lobby'});updateRoom(room);}
  });
  socket.on('close',()=>{clearTimeout(handshake);sockets.delete(socket);const room=peer.room;if(!room)return;room.peers.delete(peer.id);
   if(peer.id===room.hostId){broadcast(room,{type:'closed',message:'房主已离开，房间关闭。'});room.peers.forEach(p=>p.socket.end());rooms.delete(room.code);}
   else{broadcast(room,{type:'left',slot:peer.slot,id:peer.id});updateRoom(room);}
  });
 };
 const server=tlsOptions?tls.createServer(tlsOptions,accept):net.createServer(accept);
 if(process.env.HEFEI_NET_LOG){server.on('connection',()=>console.log('TCP accept',new Date().toISOString()));server.on('tlsClientError',e=>console.log('TLS handshake error',e.code||e.message));}
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
 try{stun=await createStunServer({port:server.address().port,host});}catch(e){if(process.env.HEFEI_NET_LOG)console.log('STUN unavailable:',e.code||e.message);}
 return {server,rooms,port:server.address().port,stunPort:stun?.port,close:async()=>{if(stun)await stun.close();await new Promise(resolve=>{sockets.forEach(s=>s.destroy());server.close(resolve);});}};
}
async function connectRoom({address,name,slot,character,code,create=false,protocol=PROTOCOL},onEvent){
 const target=parseAddress(address);
 const ca=target.host==='43.153.216.60'?fs.readFileSync(path.join(__dirname,'server-cert.pem')):undefined;
 const socket=target.secure?tls.connect({host:target.host,port:target.port,ca,rejectUnauthorized:true}):net.createConnection({host:target.host,port:target.port});
 socket.hefeiCompression=protocol>=12;socket.hefeiLatest=protocol>=22;let pingTimer,relayRtt=null,pingId=0,match=0;const pingSent=new Map();
 const result=await new Promise((resolve,reject)=>{
  let connected=false;const timer=setTimeout(()=>{socket.destroy();reject(Error('连接超时。请检查服务器地址、TCP 端口和防火墙。'));},8000);
  socket.once(target.secure?'secureConnect':'connect',()=>send(socket,{type:create?'create':'join',protocol,name,slot,character,code}));
  socket.once('error',e=>{clearTimeout(timer);reject(Error('无法连接服务器：'+e.message));});
  readLines(socket,m=>{if(m.type==='start')match=m.match;if(m.type==='pong'){const sent=pingSent.get(m.id);if(sent!==undefined){relayRtt=performance.now()-sent;pingSent.delete(m.id);onEvent({type:'connection-stats',relayRtt,streams:socket.latestStreams.stats()});}return;}if(m.type==='welcome'){connected=true;clearTimeout(timer);resolve({id:m.id,code:m.code});}
   else if(!connected&&m.type==='error'){clearTimeout(timer);socket.destroy();reject(Error(m.message));}
   onEvent(m);
  });
  socket.on('close',()=>{clearTimeout(timer);clearInterval(pingTimer);pingSent.clear();if(!connected)reject(Error('服务器连接已关闭'));else onEvent({type:'disconnected'});});
 });
 const ping=()=>{if(socket.destroyed)return;const id=++pingId;pingSent.set(id,performance.now());if(pingSent.size>30)pingSent.delete(pingSent.keys().next().value);send(socket,{type:'ping',id});};pingTimer=setInterval(ping,1000);pingTimer.unref();ping();
 return {...result,send:m=>send(socket,protocol>=23?{...m,match:m.match??match}:m),stats:()=>({bytesRead:socket.bytesRead,bytesWritten:socket.bytesWritten,buffered:socket.writableLength,relayRtt,streams:socket.latestStreams.stats()}),close:()=>socket.destroy()};
}
function addresses(){return Object.values(os.networkInterfaces()).flat().filter(x=>x&&x.family==='IPv4'&&!x.internal).map(x=>x.address);}
module.exports={createRoomServer,connectRoom,cleanInput,parseAddress,addresses,DEFAULT_PORT,PROTOCOL};
if(require.main===module){const port=Number(process.argv[2]||DEFAULT_PORT),tlsOptions=process.env.HEFEI_TLS_KEY&&process.env.HEFEI_TLS_CERT?{key:fs.readFileSync(process.env.HEFEI_TLS_KEY),cert:fs.readFileSync(process.env.HEFEI_TLS_CERT)}:null;createRoomServer({port,tlsOptions}).then(()=>console.log(`合肥惊魂夜房间服务器已启动，${tlsOptions?'TLS':'TCP'} ${port}。按 Ctrl+C 停止。`)).catch(e=>{console.error(e.message);process.exit(1);});}

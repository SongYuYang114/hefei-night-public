// Minimal IPv4 STUN binding service (RFC 8489). No TURN allocations or proxying.
const dgram=require('node:dgram');
const COOKIE=0x2112a442;
function bindingResponse(data,address,port){
 if(data.length<20||data.length>1024||data.readUInt16BE(0)!==1||data.readUInt32BE(4)!==COOKIE||data.readUInt16BE(2)!==data.length-20||data.length%4)return null;
 const ip=address.split('.').map(Number);if(ip.length!==4||ip.some(n=>!Number.isInteger(n)||n<0||n>255))return null;
 const result=Buffer.alloc(32);result.writeUInt16BE(0x101,0);result.writeUInt16BE(12,2);result.writeUInt32BE(COOKIE,4);data.copy(result,8,8,20);
 result.writeUInt16BE(0x20,20);result.writeUInt16BE(8,22);result[25]=1;result.writeUInt16BE(port^(COOKIE>>>16),26);
 for(let i=0;i<4;i++)result[28+i]=ip[i]^data[4+i];return result;
}
async function createStunServer({port,host='0.0.0.0'}={}){
 const socket=dgram.createSocket('udp4'),rates=new Map();let window=0,total=0;
 socket.on('message',(data,remote)=>{const second=Math.floor(Date.now()/1000);if(second!==window){rates.clear();window=second;total=0;}if(++total>500)return;const n=(rates.get(remote.address)||0)+1;rates.set(remote.address,n);if(n>30)return;const response=bindingResponse(data,remote.address,remote.port);if(response)socket.send(response,remote.port,remote.address,()=>{});});socket.on('error',()=>{});
 await new Promise((resolve,reject)=>{socket.once('error',reject);socket.bind(port,host,()=>{socket.removeListener('error',reject);resolve();});});
 return {port:socket.address().port,close:()=>new Promise(resolve=>socket.close(resolve))};
}
module.exports={bindingResponse,createStunServer};

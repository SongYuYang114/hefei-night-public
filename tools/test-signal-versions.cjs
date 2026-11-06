const tls=require('node:tls'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const sockets=[],root=path.resolve(__dirname,'..');
function connect(gameProtocol,code){return new Promise((resolve,reject)=>{
 const socket=tls.connect({host:'43.153.216.60',port:29805,ca:fs.readFileSync(path.join(root,'signal-cert.pem')),rejectUnauthorized:true});sockets.push(socket);let buffer='';const timer=setTimeout(()=>{socket.destroy();reject(Error('Timeout'));},8000);
 socket.on('error',e=>{clearTimeout(timer);reject(e);});socket.once('secureConnect',()=>socket.write(JSON.stringify({type:code?'join':'create',protocol:1,gameProtocol,code})+'\n'));
 socket.on('data',data=>{buffer+=data.toString();const end=buffer.indexOf('\n');if(end<0)return;clearTimeout(timer);resolve(JSON.parse(buffer.slice(0,end)));});
});}
(async()=>{let report;try{
 const current=await connect(36);assert.equal(current.type,'welcome');for(const oldProtocol of [25,27,28,29,30,31,32,33,34,35]){const old=await connect(oldProtocol);assert.equal(old.type,'welcome');assert.equal((await connect(oldProtocol,old.code)).type,'welcome');for(const [protocol,code] of [[36,old.code]]){const mixed=await connect(protocol,code);assert.equal(mixed.type,'error');assert(mixed.message.includes('版本不同'));}}assert.equal((await connect(36,current.code)).type,'welcome');
 report={passed:true,version:require('../package.json').version,protocol:36,publicTLS:true,legacyProtocols25and27and28and29and30and31Supported:true,protocol36Supported:true,mixedProtocolRoomsRejected:true};
 }catch(e){report={passed:false,error:e.stack};}finally{sockets.forEach(s=>s.destroy());}
 fs.writeFileSync(path.join(root,'../signal-version-result.json'),JSON.stringify(report,null,2));console.log(report);process.exitCode=report.passed?0:1;
})();

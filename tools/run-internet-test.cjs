const fs=require('node:fs'),path=require('node:path');
const log=path.resolve(__dirname,'../../internet-test-bootstrap.log');
fs.appendFileSync(log,'entry\n');
process.on('uncaughtException',e=>{fs.appendFileSync(log,e.stack+'\n');process.exit(1);});
process.on('unhandledRejection',e=>{fs.appendFileSync(log,String(e?.stack||e)+'\n');process.exit(1);});
try{require('./test-p2p-internet.cjs');}catch(e){fs.appendFileSync(log,e.stack+'\n');process.exit(1);}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {candidateSummary,collectCandidates,connectionDiagnosis,DIRECT_ICE_SERVERS} from '../dist/direct-connect.mjs';
const candidate=(address,type='host')=>`a=candidate:1 1 udp 1 ${address} 50000 typ ${type}\r\n`;
const sample=candidate('192.168.2.1')+candidate('198.18.0.1')+candidate('100.64.0.1')+candidate('240e:1234::1')+candidate('fdfe:1234::1')+candidate('203.0.113.1','srflx');
const summary=candidateSummary(sample);assert.deepEqual(summary,{host:5,srflx:1,relay:0,publicIPv4:0,publicIPv6:1,virtual:1,total:6});assert(!JSON.stringify(summary).includes('192.168'));
assert(DIRECT_ICE_SERVERS.length>=2&&DIRECT_ICE_SERVERS.every(s=>s.urls.startsWith('stun:')));
class FakePeer extends EventTarget{constructor(){super();this.iceGatheringState='gathering';this.connectionState='new';this.localDescription={sdp:candidate('192.168.1.1')};}}
const slow=new FakePeer();setTimeout(()=>{slow.localDescription.sdp+=candidate('203.0.113.2','srflx');slow.iceGatheringState='complete';slow.dispatchEvent(new Event('icegatheringstatechange'));},70);const collected=await collectCandidates(slow,200);assert(collected.complete&&collected.srflx===1,'late public route must be included');
const timed=await collectCandidates(new FakePeer(),10);assert.equal(timed.complete,false,'bounded gathering must report incompleteness');
const connection={direct:false,state:'connecting',ice:'checking',waitingMs:1000,waitingResponse:false,local:summary,remote:summary};
assert.equal(connectionDiagnosis([{...connection,state:'failed'}]).code,'ice-failed');assert(connectionDiagnosis([{...connection,state:'failed'}]).message.includes('VPN'));
assert.equal(connectionDiagnosis([{...connection,local:candidateSummary(candidate('192.168.1.1'))}]).code,'no-public-address');
assert.equal(connectionDiagnosis([{...connection,direct:true,state:'connected',ice:'connected'}]).code,'connected');
assert.equal(connectionDiagnosis([{...connection,waitingResponse:true}]).code,'waiting-response');
const report={passed:true,version:'1.25.0',protocol:28,multipleStunDiscoveryOnly:true,lateCandidatesCollected:true,boundedGatheringReported:true,vpnHintWithoutIP:true,connectionFailuresExplained:true};fs.writeFileSync(new URL('../../direct-connect-result.json',import.meta.url),JSON.stringify(report,null,2));console.log(report);

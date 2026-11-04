import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnVRPhantoms,vrPhantomState} from '../dist/vr-phantoms.mjs';
import {elbowTiming,beginVR,stepVR} from '../dist/vr-hunter.mjs';
import {createCat,stepCats} from '../dist/hakimi.mjs';
import {seededRandom} from '../dist/match-loot.mjs';
import {blocked,distance} from '../dist/core.mjs';
const h={hunterCharacter:1,state:'active',neckStacks:6,cooldown:0,stun:0};
assert.equal(elbowTiming(h).impact,3.3);assert(beginVR(h));assert.equal(h.neckStacks,6);
assert.deepEqual(elbowTiming(h),{impact:.3,duration:.8,cooldown:1.65,extra:0});
const walls=[{x:0,z:0,w:30,d:30}];
for(let seed=0;seed<50;seed++){
 const p=spawnVRPhantoms(h,walls,seededRandom(seed),20);assert.equal(p.length,3);assert.equal(new Set(p.map(p=>p.id)).size,3);
 for(const a of p){assert(!blocked(a.x,a.z,walls,.65));assert.equal(vrPhantomState(a).isVRPhantom,true);assert.equal(a.born,20);assert(a.id<0);}
 for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)assert(distance(p[i],p[j])>=4);
 assert.deepEqual(p,spawnVRPhantoms(h,walls,seededRandom(seed),20));
}
const old=spawnVRPhantoms(h,[],seededRandom(4));stepVR(h,15);assert.equal(h.neckStacks,7);assert.equal(elbowTiming(h).impact,3.8);assert.deepEqual(spawnVRPhantoms(h),[]);
h.cooldown=0;assert(beginVR(h));const fresh=spawnVRPhantoms(h,[],seededRandom(4));assert(fresh.every(p=>!old.some(o=>o.id===p.id)));assert.deepEqual(spawnVRPhantoms({...h,hunterCharacter:0}),[]);
for(const legendary of [false,true]){
 const c={...createCat(0,{x:0,z:14},()=>.5),legendary,cooldown:100,target:{x:0,z:14}},p={id:-1010,x:0,z:15,state:'active',isVRPhantom:true};
 const events=stepCats([c],[],.01,[p],[],()=>.5);assert.equal(c.phase,'warning');assert.equal(c.focusId,p.id);assert(events.some(e=>e.type==='hiss'));
 const more=stepCats([c],[],3,[p],[],()=>.5);assert(!more.some(e=>e.type==='scratch-hit'||e.type==='scratch-swing'||e.type==='stun'));assert.equal(c.phase,'roaming');assert(c.reactionCooldown>5);assert(!Object.hasOwn(p,'hp'));assert(!Object.hasOwn(p,'stun'));
 const hidden={...createCat(1,{x:0,z:14},()=>.5),legendary,cooldown:100,target:{x:0,z:14}};stepCats([hidden],[],.01,[{...p,z:20}],[{x:0,z:17,w:6,d:.5}],()=>.5);assert.equal(hidden.phase,'roaming');
}
const result={passed:true,version:JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url))).version,threePhantomsPerCast:true,fiftySeededMapsSafeAndSeparated:true,uniqueIdsAcrossCasts:true,noSpawnsOutsideVRForm:true,activeFormSuppressesSixNeckStacks:true,stacksPreservedAndReturnAfterForm:true,ordinaryAndLegendaryCatsHissAtPhantoms:true,wallsBlockCatReaction:true,phantomsCannotTakeDamageOrStun:true,phantomsAreNotPlayerSlots:true};
fs.writeFileSync(new URL('../../vr-phantoms-unit.json',import.meta.url),JSON.stringify(result,null,2));console.log(result);

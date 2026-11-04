import fs from 'node:fs';import assert from 'node:assert/strict';
import {createCat,stepCats,flattenCats,catCarTargets,catState} from '../dist/hakimi.mjs';
import {beginDrive,stepDrivenCar,launchDrivenCar} from '../dist/drive-car.mjs';
const driver=()=>({x:0,z:0,angle:0,state:'active',cooldown:0,stun:0});
const cat=(id,x,z)=>createCat(id,{x,z},()=>.5);
let a=driver();beginDrive(a);let cats=[cat(0,0,6),cat(1,3,6)],fights=[];
let result=stepDrivenCar(a,0,1,[],[],new Set(),[],catCarTargets(cats,fights));assert.deepEqual(result.catHits,[cats[0]],'sweep catches the cat even when the car ends four metres beyond it');assert(Math.abs(a.z-10)<1e-8);assert(a.driving&&a.drivePhase==='driving');
let flat=flattenCats(result.catHits,cats,fights);assert.equal(flat.cats.length,1);assert.equal(cats[0].phase,'flattened');assert.equal(cats[0].phaseTime,10);assert.equal(catState(cats[0]).phaseTime,10);assert.equal(catCarTargets(cats,fights).length,1);
const position={x:cats[0].x,z:cats[0].z};stepCats(cats,fights,9.99,[],[],()=>.5);assert.equal(cats[0].phase,'flattened');assert.deepEqual({x:cats[0].x,z:cats[0].z},position);const left=cats[0].phaseTime;assert.equal(flattenCats([cats[0]],cats,fights).cats.length,0);assert.equal(cats[0].phaseTime,left,'overlap does not refresh the timer');stepCats(cats,fights,.01,[],[],()=>.5);assert.equal(cats[0].phase,'roaming');stepCats(cats,fights,.25,[],[],()=>.5);assert(Math.hypot(cats[0].x-position.x,cats[0].z-position.z)>.5);
const wall=[{x:0,z:5,w:10,d:.5}];a=driver();beginDrive(a);cats=[cat(0,0,6),cat(1,0,-3)];result=stepDrivenCar(a,0,1,wall,[],new Set(),[],catCarTargets(cats,[]));assert(result.bounces>0);assert(!result.catHits.includes(cats[0]),'no collision through walls');assert(result.catHits.includes(cats[1]),'returning from a wall bounce also hits cats');
a=driver();beginDrive(a);a.driveWallBoost=true;cats=[cat(0,0,7)];assert.equal(stepDrivenCar(a,0,1,[],[],new Set(),[],catCarTargets(cats,[])).catHits.length,1,'15 m/s driving still catches cats');
a=driver();beginDrive(a);launchDrivenCar(a,()=>0);cats=[cat(0,0,0)];assert.equal(stepDrivenCar(a,0,.5,[],[],new Set(),[],catCarTargets(cats,[])).catHits.length,0,'airborne car does not flatten ground cats');a=driver();assert.equal(stepDrivenCar(a,0,1,[],[],new Set(),[],catCarTargets(cats,[])).catHits.length,0);
for(const phase of ['roaming','hissing','fighting','grooming']){
 cats=[cat(0,-1.9,8),cat(1,1.9,8)];fights=[];if(phase!=='roaming'){
  fights.push({id:'pair',catIds:[0,1],x:0,z:8,phase,phaseTime:3,windup:5,hitIds:[]});cats.forEach(c=>Object.assign(c,{phase,fightId:'pair',moving:false}));
 }
 if(phase==='fighting'){
  // The visible smoke cloud, rather than the invisible cats' old positions, is hit.
  a=driver();beginDrive(a);result=stepDrivenCar(a,0,.7,[],[],new Set(),[],catCarTargets(cats,fights));assert.equal(result.catHits.length,2);
 }
 flat=flattenCats([cats[0]],cats,fights);assert.equal(fights.length,0);assert.equal(cats[0].phase,'flattened');assert.equal(cats[1].phase,phase==='fighting'?'flattened':'roaming');
 if(phase!=='roaming')assert.equal(flat.departed.length,1);
 const actor={id:4,x:0,z:8,state:'active',hp:2,stun:0};stepCats(cats,fights,.1,[actor],[],()=>.5);assert.equal(actor.stun,0,'interrupted fight no longer stuns nearby players');assert.equal(fights.length,0);
}
const report={passed:true,version:JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url))).version,groundCarSweepsCats:true,wallBouncePathTested:true,noThroughWallHit:true,boostedCarNoTunneling:true,airborneAndInactiveDoNotFlatten:true,carContinuesDriving:true,flatFreezeReal10Seconds:true,recoversAndRoams:true,overlapDoesNotRefreshEveryFrame:true,roamingHissingFightingGroomingAllSupported:true,comicCloudHitFlattensBothCats:true,interruptedFightStopsStuns:true,remainingFlatTimeSerialized:true};fs.writeFileSync(new URL('../../cat-car-unit.json',import.meta.url),JSON.stringify(report,null,2));console.log(report);

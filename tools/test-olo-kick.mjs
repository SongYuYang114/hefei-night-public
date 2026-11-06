import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {context} from './test-restored.mjs';
import {canRescue} from '../dist/olo.mjs';
import {moveControlled,LocalPrediction} from '../dist/net-motion.mjs';
import {survivorSpeedMultiplier} from '../dist/survivor-skills.mjs';
import {createCat,stepCats,catState,catCarTargets} from '../dist/hakimi.mjs';
import {nearestKickCat,kickNearestCat,catKickHeight,CAT_KICK_SECONDS} from '../dist/cat-kick.mjs';
const actor=(id=6)=>({id:3,characterId:id,x:0,z:0,angle:0,state:'active',stun:0,kickTime:0,jumpTime:0,launchTime:0,shoeTime:0});
const input={keys:{s:true},yaw:0,touch:{x:0,z:0}};
for(const [id,speed]of [[6,7.4],[0,3.7]]){const a=actor(id);moveControlled(a,input,1,[]);assert(Math.abs(a.z-speed)<1e-8);const p=new LocalPrediction();p.reset(actor(id));for(let i=0;i<50;i++)p.push(input,.02,i*20);assert(Math.abs(p.actor.z-speed)<1e-8);assert.equal(survivorSpeedMultiplier(actor(id)),id===6?2:1);}
assert(!canRescue(actor()));assert(canRescue(actor(0)));
for(const legendary of [false,true]){
 const a=actor(),c={...createCat(legendary?5:0,{x:0,z:2},()=>.5),legendary};
 assert.equal(nearestKickCat(actor(0),[c]),null);const result=kickNearestCat(a,[c],[],[],()=>.18);assert.equal(result.cat,c);assert.equal(c.phase,'kicked');assert(a.kickTime>0);assert.equal(catCarTargets([c],[]).length,0);
 stepCats([c],[],CAT_KICK_SECONDS/2,[],[],()=>.5);assert(catKickHeight(c)>3);assert(c.z>8);assert.equal(kickNearestCat(actor(),[c],[],[],()=>.18),null);
 stepCats([c],[],CAT_KICK_SECONDS/2,[],[],()=>.5);assert.equal(c.phase,'roaming');assert.equal(catKickHeight(c),0);assert(c.z>15);assert.equal(c.legendary,legendary);
}
{const a=actor(),c=createCat(0,{x:0,z:2},()=>.5),walls=[{x:0,z:4,w:10,d:1}];kickNearestCat(a,[c],[],walls,()=>.18);stepCats([c],[],1.1,[],walls,()=>.5);assert(c.z<=3.02);assert.equal(nearestKickCat(actor(),[createCat(1,{x:0,z:6},()=>.5)],walls),null);}
for(const phase of ['hissing','fighting','grooming']){
 const pair=[createCat(0,{x:-1,z:2},()=>.5),createCat(1,{x:1,z:2},()=>.5)];pair.forEach(c=>Object.assign(c,{phase,fightId:'test',phaseTime:3}));const fights=[{id:'test',catIds:[0,1],phase,phaseTime:3,x:0,z:2,hitIds:[]}];
 const r=kickNearestCat(actor(),pair,fights,[],()=>.18);assert.equal(r.departed.length,1);assert.equal(fights.length,0);assert.equal(pair.filter(c=>c.phase==='kicked').length,1);assert.equal(pair.filter(c=>c.phase==='roaming').length,1);
}
{const c={...createCat(0,{x:0,z:2},()=>.5),phase:'flattened',phaseTime:10};kickNearestCat(actor(),[c],[],[],()=>.18);stepCats([c],[],1.1,[],[],()=>.5);assert.equal(c.phase,'flattened');assert(Math.abs(c.phaseTime-8.9)<.001);assert.equal(catState(c).kickVX,0);}
const integrated=vm.runInContext(`(()=>{
 role='survivor';$('survivor-choice').value='6';start(780);clearCats();clearKuchi();const a=current();Object.assign(a,{x:0,z:14});Object.assign(hunter,{x:32,z:32});capture(survivors[0]);
 const target=survivors[0];a.x=target.x+1.5;a.z=target.z;rescue(target,5,false,a);const noRescue=target.state==='captured'&&target.rescue===0;const noRescueTarget=nearestInteraction(a)?.type!=='rescue';
 rescue(target,5,false,survivors[1]);const ordinaryRescue=target.state==='active';
 Object.assign(a,{x:0,z:14,path:[],repath:0,destination:null});const before=a.z;follow(a,{x:a.x,z:a.z+10},3.65,.1);const aiDoubleSpeed=a.z-before>.72;
 back();return {noRescue,noRescueTarget,ordinaryRescue,aiDoubleSpeed};
})()`,context);for(const [k,v]of Object.entries(integrated))assert(v,k);
const result={passed:true,version:JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url))).version,protocol:36,baseSpeedMetersPerSecond:7.4,hostAndPredictionSpeedsMatch:true,ordinarySpeedUnchanged:true,kicksOrdinaryAndLegendaryCats:true,flightAndLanding:true,cannotKickAirborneCat:true,wallAndRangeChecks:true,interruptsAllFightPhases:true,flattenedCatTimerPreserved:true,...integrated};
fs.writeFileSync(new URL('../../olo-kick-unit.json',import.meta.url),JSON.stringify(result,null,2));console.log(result);

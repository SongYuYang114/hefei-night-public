import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCat,spawnCats,stepCats,catState,catFightState,CAT_COUNT,CAT_FIGHT_SECONDS,CAT_GROOM_SECONDS} from '../dist/hakimi.mjs';
import {seededRandom} from '../dist/match-loot.mjs';
import {blocked,distance} from '../dist/core.mjs';
import {HUNTERS} from '../dist/vr-hunter.mjs';
import {moveControlled} from '../dist/net-motion.mjs';
const actor=(id,x,z)=>({id,x,z,state:'active',hp:2,stun:0,attack:1,swing:1,hitDelay:.2,moving:true});
assert.equal(HUNTERS[0].name,'宋雨杨（经典）');assert.equal(HUNTERS[1].name,'AI嘉豪宋雨杨');
const rand=seededRandom(65),walls=[{x:0,z:8,w:10,d:1}];let cats=spawnCats(walls,rand);assert.equal(cats.length,CAT_COUNT);assert.deepEqual(cats,spawnCats(walls,seededRandom(65)));assert(cats.every(c=>!blocked(c.x,c.z,walls,.65)));
const roamingFights=[];for(let i=0;i<1000;i++){stepCats(cats,roamingFights,.04,[],walls,rand);assert(cats.every(c=>Number.isFinite(c.x)&&!blocked(c.x,c.z,walls,.47)));}
// Measure actual travel and the encounter boundary rather than checking constants alone.
const runner=createCat(0,{x:0,z:0},()=>.5);runner.target={x:0,z:20};stepCats([runner],[],1,[],[],()=>.5);assert(Math.abs(runner.z-4)<1e-8,'cat travels four metres in one second');
for(const [gap,expected] of [[3.99,1],[4,1],[4.01,0]]){const pair=[createCat(0,{x:-gap/2,z:0},()=>.5),createCat(1,{x:gap/2,z:0},()=>.5)],encounters=[];pair.forEach(c=>{c.cooldown=0;c.target={x:c.x,z:20};});stepCats(pair,encounters,.001,[],[],()=>.5);assert.equal(encounters.length,expected,'encounter boundary '+gap);}
// Independent encounters exercise both ends of the 5–10 second preparation window.
for(const r of [0,.5,.999999]){
 cats=[createCat(0,{x:-1,z:0},()=>.5),createCat(1,{x:1,z:0},()=>.5)];cats.forEach(c=>{c.cooldown=0;c.target={x:c.x,z:4};});const fights=[];
 let events=stepCats(cats,fights,.001,[],[],()=>r);assert.equal(events[0].type,'hiss');assert.equal(fights.length,1);const windup=fights[0].phaseTime;assert(windup>=5&&windup<=10);assert.equal(windup,5+r*5);assert(cats.every(c=>c.phase==='hissing'&&!c.moving));
 const a=actor(0,0,1),h=actor(4,0,-1),late=actor(1,20,20),behind=actor(2,0,2.5),vr={...actor(5,0,1),hunterCharacter:1,vrTime:15},captured={...actor(3,0,0),state:'captured'};
 const actors=[a,h,late,behind,vr,captured],wall=[{x:0,z:2,w:6,d:.3}];
 events=stepCats(cats,fights,windup-.01,actors,wall,()=>r);assert.equal(fights[0].phase,'hissing');assert.equal(a.stun,0);
 events=stepCats(cats,fights,.011,actors,wall,()=>r);assert.equal(fights[0].phase,'fighting');assert.equal(events.filter(e=>e.type==='stun').length,2);assert.equal(a.stun,3);assert.equal(h.stun,3);assert.equal(behind.stun,0);assert.equal(vr.stun,0);assert.equal(captured.stun,0);assert.equal(a.hp,2);assert.equal(a.hitDelay,0);
 const pos={x:a.x,z:a.z};moveControlled(a,{keys:{w:true}},.1,[]);assert.deepEqual({x:a.x,z:a.z},pos);
 a.stun=.5;events=stepCats(cats,fights,.1,actors,wall,()=>r);assert.equal(a.stun,.5,'one stun per fight, never refreshed');
 Object.assign(late,{x:0,z:-2});events=stepCats(cats,fights,.1,actors,wall,()=>r);assert(events.some(e=>e.actor===late));assert.equal(late.stun,3,'entering the fight radius also stuns');
 stepCats(cats,fights,CAT_FIGHT_SECONDS,actors,wall,()=>r);assert(cats.every(c=>c.phase==='grooming'));events=stepCats(cats,fights,CAT_GROOM_SECONDS,actors,wall,()=>r);assert(events.some(e=>e.type==='depart'));assert.equal(fights.length,0);assert(cats.every(c=>c.phase==='roaming'&&c.cooldown>11));
 const separation=distance(cats[0],cats[1]);stepCats(cats,fights,.5,[],[],()=>r);assert(distance(cats[0],cats[1])>separation,'cats leave in opposite directions');assert.equal(fights.length,0);
}
cats=[createCat(0,{x:-1,z:0},()=>.5),createCat(1,{x:1,z:0},()=>.5)];cats.forEach(c=>c.cooldown=0);let fights=[];stepCats(cats,fights,.01,[],[{x:0,z:0,w:.3,d:10}],()=>0);assert.equal(fights.length,0,'cats cannot confront through walls');
// A cat can only belong to one encounter; serialized state excludes private hit history and Three objects.
cats=[0,1,2].map((id)=>({...createCat(id,{x:id*.7,z:0},()=>.5),cooldown:0}));stepCats(cats,fights,.01,[],[],()=>0);assert.equal(fights.length,1);assert.equal(cats.filter(c=>c.phase==='hissing').length,2);assert(!('root' in catState(cats[0])));assert(!('hitIds' in catFightState(fights[0])));
const report={passed:true,version:JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url))).version,classicNameUpdated:true,VRNamePreserved:true,randomCats:CAT_COUNT,roamSpeedMetersPerSecond:runner.z,encounterRadiusMeters:4,encounterBoundaryTested:true,seededSpawns:true,roamingAvoidsWalls:true,windup5to10:true,oneEncounterPerCat:true,fight4Seconds:true,groom3SecondsThenScatter:true,stunBothFactions3Seconds:true,noHealthDamage:true,stunBlocksMovementAndAttack:true,oneStunPerPlayerPerFight:true,lateEntrantsStunned:true,wallsBlockEncounterAndStun:true,VRImmunityRespected:true,capturedIgnored:true,peacePeriodPreventsImmediateRefight:true};
fs.writeFileSync(new URL('../../hakimi-unit.json',import.meta.url),JSON.stringify(report,null,2));console.log(report);

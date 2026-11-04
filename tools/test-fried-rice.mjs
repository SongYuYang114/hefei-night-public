import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRedEye,redEyeSpawn,stepRedEye,redEyeTargets,SHOE_HOLD_SECONDS,RED_EYE_SPEED} from '../dist/red-eye.mjs';
import {rollChestLoot,FRIED_RICE,WEIRD_MUSHROOM} from '../dist/match-loot.mjs';
import {moveControlled,LocalPrediction} from '../dist/net-motion.mjs';
import {beginJump} from '../dist/jump.mjs';
import {beginDrive} from '../dist/drive-car.mjs';
import {useSurvivorSkill} from '../dist/survivor-skills.mjs';
import {advanceSelfHeal} from '../dist/self-heal.mjs';
import {blocked} from '../dist/core.mjs';
const actor=(id,characterId,x=0,z=0)=>({id,characterId,x,z,angle:0,state:'active',hp:2,stun:0,shoeTime:0,shoeNpcId:0,cooldown:0,jumpTime:0,jumpCooldown:0});
const hunter=actor(4,null,0,20),song=actor(0,3,0,30),wrongSlot=actor(3,2,0,1),owner=actor(2,2,0,0);
let npc=createRedEye(owner,{x:0,z:0},1);assert.deepEqual(redEyeTargets(npc,hunter,[song,wrongSlot]).map(a=>a.id),[4,0]);
const oldZ=npc.z;stepRedEye(npc,.1,hunter,[song,wrongSlot]);assert(Math.abs(npc.z-oldZ-RED_EYE_SPEED*.1)<1e-8);
assert(npc.invincible&&npc.active);npc.kuchiSlow=5;npc.stun=100;npc.hp=0;stepRedEye(npc,.1,hunter,[song]);assert(npc.z>3.99,'NPC ignores externally assigned damage/stun/slow fields');
Object.assign(hunter,{x:0,z:npc.z+.5,driving:true,drivePhase:'driving',healTime:4,craftTime:5,swing:.5,hitDelay:.2});
const events=stepRedEye(npc,.02,hunter,[song]);assert(events.some(e=>e.type==='caught'&&e.target===hunter));assert.equal(hunter.shoeTime,15);assert(!hunter.driving);assert.equal(hunter.hitDelay,0);assert.equal(hunter.healTime,0);assert.equal(hunter.craftTime,0);assert.equal(hunter.hp,2);
const position=[hunter.x,hunter.z];moveControlled(hunter,{keys:{w:true},touch:{},jumpPress:1},1,[],true);assert.deepEqual([hunter.x,hunter.z],position);assert(!beginJump(hunter));assert(!beginDrive(hunter));assert(!advanceSelfHeal({...hunter,hp:1},20,{held:true,stationary:true,noTarget:true}));assert(!useSurvivorSkill({...song,shoeTime:15},hunter).ok);
for(let i=0;i<749;i++)stepRedEye(npc,.02,hunter,[song]);assert(hunter.shoeTime>0&&hunter.shoeTime<.021,'not released before 15 seconds');stepRedEye(npc,.02,hunter,[song]);assert.equal(hunter.shoeTime,0);assert.equal(hunter.shoeNpcId,0);
let songCaught=false;for(let i=0;i<100;i++){const e=stepRedEye(npc,.02,hunter,[song,wrongSlot]);if(e.some(v=>v.type==='caught'&&v.target===song)){songCaught=true;break;}}assert(songCaught);assert.equal(wrongSlot.shoeTime,0);for(let i=0;i<751;i++)stepRedEye(npc,.02,hunter,[song,wrongSlot]);assert(!npc.active);assert.deepEqual(npc.caught,[4,0]);assert.equal(song.hp,2);
// A second NPC cannot steal an ongoing restraint or extend its timer.
const second=createRedEye(owner,{x:0,z:0},2);Object.assign(hunter,{x:0,z:0,shoeTime:10,shoeNpcId:77});assert(!redEyeTargets(second,hunter,[]).length);assert.equal(hunter.shoeTime,10);
// A Song who used the item is still a target; captured/escaped players are not.
const selfSong=actor(1,3);const self=createRedEye(selfSong,{x:0,z:0},3);assert(redEyeTargets(self,null,[selfSong]).includes(selfSong));selfSong.state='captured';assert(!redEyeTargets(self,null,[selfSong]).length);
// Route around a real obstacle, never through it.
const wall=[{x:0,z:5,w:6,d:1}],h2=actor(4,null,0,10);npc=createRedEye(owner,{x:0,z:0},4);let caught=false;for(let i=0;i<800;i++){const e=stepRedEye(npc,.02,h2,[],wall);assert(!blocked(npc.x,npc.z,wall,.47));if(e.some(v=>v.type==='caught')){caught=true;break;}}assert(caught);
assert(redEyeSpawn(owner,[]));assert.equal(redEyeSpawn(owner,[{x:0,z:0,w:20,d:20}]),null);
const counts={};for(let i=0;i<10000;i++){const item=rollChestLoot(()=>(i+.5)/10000);counts[item]=(counts[item]||0)+1;}assert.equal(counts[FRIED_RICE],1900);assert.equal(counts[WEIRD_MUSHROOM],500);
const prediction=new LocalPrediction();prediction.reset(actor(0,3));prediction.push({keys:{w:true},touch:{},jumpPress:0},.02,0);prediction.reconcile({...actor(0,3),shoeTime:15,shoeNpcId:1,inputAck:1},100);prediction.push({keys:{d:true},touch:{},jumpPress:2},.02,120);assert.deepEqual([prediction.pose(.02).x,prediction.pose(.02).z],[0,0]);
const report={passed:true,version:JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url))).version,speed:RED_EYE_SPEED,holdSeconds:SHOE_HOLD_SECONDS,targetByCharacterNotSlot:true,targetsCasterSong:true,ignoresOtherCharacters:true,invincibleAndControlImmune:true,drivingInterrupted:true,allActionsLocked:true,noHealthDamage:true,exact15SecondRelease:true,eachTargetOnceThenDeparts:true,noConcurrentGrabExtension:true,wallNavigation:true,failedSpawnDoesNotConsume:true,chestDropRate:counts[FRIED_RICE]/10000,predictionCannotMoveRestrainedActor:true};
fs.writeFileSync(new URL('../../fried-rice-unit.json',import.meta.url),JSON.stringify(report,null,2));console.log(report);

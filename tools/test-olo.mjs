import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {context} from './test-restored.mjs';
import {isOlo,canRepair,enforceOloPassive} from '../dist/olo.mjs';
import {immuneToNegative,laserCast} from '../dist/vr-hunter.mjs';
import {hit,outcome} from '../dist/core.mjs';
import {beginDrive,stepDrivenCar} from '../dist/drive-car.mjs';
import {createExhaust,stepExhaust} from '../dist/exhaust.mjs';
import {stepCurryMine} from '../dist/curry.mjs';
import {stepMailisu} from '../dist/kuchi.mjs';
import {createSeekerPig,explodeSeekerPig} from '../dist/seeker-pig.mjs';
import {createCat,stepCats} from '../dist/hakimi.mjs';
import {createRedEye,lockUnderShoe,redEyeTargets} from '../dist/red-eye.mjs';
import {teleportToTeammate} from '../dist/teleport.mjs';
import {useSurvivorSkill,SURVIVOR_SKILLS} from '../dist/survivor-skills.mjs';
import {DirectRoom,DIRECT_PROTOCOL} from '../dist/direct-room.mjs';

const actor=(id,characterId=id,x=0,z=0)=>({id,characterId,x,z,angle:0,state:'active',hp:2,stun:0,blind:0,slow:0,kuchiSlow:0,invincible:0,launchTime:0,jumpTime:0,shoeTime:0,cooldown:0});
const olo=()=>actor(2,6,0,2),normal=()=>actor(1,0,0,2),hunter=()=>({...actor(4,undefined,0,0),characterId:undefined,hunterCharacter:0});
assert.equal(DIRECT_PROTOCOL,36);assert.equal(SURVIVOR_SKILLS[6].name,'被鸽');assert(SURVIVOR_SKILLS[6].passive);
assert(!isOlo(actor(6,0)));assert(isOlo(olo()));assert(immuneToNegative(olo()));assert(!canRepair(olo()));assert(canRepair(normal()));
assert.equal(useSurvivorSkill(olo(),hunter()).reason,'passive');assert.equal(laserCast({...olo(),vrTime:15,laserCooldown:0},0,[normal()]),null);
assert.equal(hit(hunter(),[olo(),normal()],[]).characterId,0);
{const h=hunter(),a=olo(),n=normal();beginDrive(h);let hits=[];for(let i=0;i<15;i++)hits.push(...stepDrivenCar(h,0,.02,[],[a,n],new Set()).hits);assert(!hits.includes(a));assert(hits.includes(n));}
{const h={...hunter(),hunterCharacter:1,vrTime:15,laserCooldown:0};const a=olo(),n=normal();assert.deepEqual(laserCast(h,0,[a,n],[]).hits,[n]);}
{const a=olo(),n=normal(),owner=actor(0,2,0,0);const gas=createExhaust(owner);gas.angle=0;let hits=[];for(let i=0;i<40&&gas.active;i++)hits.push(...stepExhaust(gas,.02,[],[a,n]).hits);assert(!hits.includes(a));assert(hits.includes(n));}
{const a=olo(),mine={x:a.x,z:a.z,arm:0};assert.equal(stepCurryMine(mine,.1,[a],[],()=>.5),null);assert.equal(a.launchTime,0);const n=normal();assert.equal(stepCurryMine(mine,.1,[a,n],[],()=>.5),n);assert.equal(n.stun,3);}
{const a=olo(),traps=[{x:a.x,z:a.z}];assert.deepEqual(stepMailisu(traps,[a]),[]);assert.equal(traps.length,1);const n=normal();assert.deepEqual(stepMailisu(traps,[a,n]),[n]);assert.equal(n.kuchiSlow,5);}
{const a=olo(),n=normal(),p=createSeekerPig(actor(0,2),1);p.x=a.x;p.z=a.z;assert.deepEqual(explodeSeekerPig(p,[a,n],[]).hits,[n]);assert.equal(a.stun,0);assert.equal(n.stun,3);}
{const a=olo(),n=normal(),c={...createCat(5,{x:0,z:0},()=>.5),legendary:true};const events=stepCats([c],[],1.6,[a],[],()=>.5);assert(!events.some(e=>e.type==='scratch-hit'));assert.equal(a.stun,0);
 const f={id:9,x:0,z:2,phase:'fighting',phaseTime:4,catIds:[],hitIds:[]};stepCats([], [f],.1,[a,n],[],()=>.5);assert.equal(a.stun,0);assert.equal(n.stun,3);}
{const a=olo(),npc=createRedEye(normal(),{x:0,z:0},1);lockUnderShoe(a,npc);assert.equal(a.shoeTime,0);assert(!redEyeTargets(npc,hunter(),[a]).includes(a));}
{const a=olo(),obi=actor(0,5,0,-10),h=hunter();assert.equal(teleportToTeammate(obi,h,{survivors:[obi,a],random:()=>.8}).reason,'no-teammates');assert.equal(teleportToTeammate(a,h,{survivors:[obi,a]}).reason,'immune');assert.equal(a.z,2);
 const n=actor(1,0,20,20),result=teleportToTeammate(obi,h,{survivors:[obi,a,n],random:()=>.8});assert(result.ok);assert.equal(result.teammateSlot,n.id);assert.equal(a.z,2);}
{const a=olo(),others=[0,1,3].map(i=>({...actor(i),state:'captured'}));assert.equal(outcome([a,...others],null),'hunter');others[0].state='active';assert.equal(outcome([a,...others],null),null);assert.equal(outcome([a,...others.slice(0,2)].map(s=>({...s,state:'escaped'})),null),'survivor');}
{const a={...olo(),hp:1,stun:3,blind:5,slow:5,kuchiSlow:5,launchTime:1,launchVX:9,launchVZ:9,shoeTime:15,dash:2,legRush:3,invisible:5,reveal:3,invincible:6,cooldown:30};enforceOloPassive(a);for(const k of ['stun','blind','slow','kuchiSlow','launchTime','launchVX','launchVZ','shoeTime','dash','legRush','invisible','reveal','invincible','cooldown'])assert.equal(a[k],0,k);assert.equal(a.hp,2);}
const room=new DirectRoom();const peer=room.descriptor({slot:3,character:6},crypto.randomUUID());assert.equal(peer.character,6);room.close();

const integrated=vm.runInContext(`(()=>{
 role='survivor';$('survivor-choice').value='6';start(780);clearCats();clearKuchi();const a=current();Object.assign(a,{x:0,z:-12});Object.assign(hunter,{x:32,z:32});
 const damage=['elbow','car','laser','cat'].every(type=>!damageSurvivor(a,type)&&a.hp===2&&a.state==='active');capture(a);const noCapture=a.state==='active';
 const g=gens[3];g.progress=0;repair(g,32,false,a);const noRepair=g.progress===0;const noRepairTarget=nearestInteraction(a)?.type!=='repair';repair(g,32,false,survivors[0]);const othersRepair=g.progress>0;
 const before=gens.map(g=>g.progress);chests.forEach(c=>c.opened=true);testFreezeAI=false;for(let i=0;i<120;i++)survivorAIOriginal(a,.05);const aiNoRepair=gens.every((g,i)=>g.progress===before[i]);
 back();return {damage,noCapture,noRepair,noRepairTarget,othersRepair,aiNoRepair};
})()`,context);
for(const [k,v] of Object.entries(integrated))assert(v,k);
const report={passed:true,version:JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url))).version,protocol:36,
 identityUsesCharacterNotSlot:true,passiveCannotBeActivated:true,allDamageSourcesBlocked:true,stunBlindSlowKnockbackAndShoeImmune:true,
 trapsPreservedWhenOloWalksOver:true,noObiwanTeleportOrAnchor:true,otherCharactersStillAffected:true,ignoredInHunterCaptureVictory:true,
 originalThreeEscapeVictoryPreserved:true,P2PAllowsSeventhSurvivor:true,...integrated};
fs.writeFileSync(new URL('../../olo-unit.json',import.meta.url),JSON.stringify(report,null,2));console.log(report);

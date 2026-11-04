import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createCat,stepCats,catState,repelCarCats} from '../dist/hakimi.mjs';
const cat=()=>({...createCat(5,{x:0,z:14},()=>.5),legendary:true,target:{x:0,z:14}});
const actor=(id=0,z=16)=>({id,x:0,z,state:'active',hp:2,stun:0,invincible:0});
const tick=(c,a,dt=1.6,walls=[])=>stepCats([c],[],dt,[a],walls,()=>.5);
for(const id of [0,4,100]){
 const c=cat(),a=actor(id);tick(c,a,.01);assert.equal(c.phase,'scratching');assert.equal(c.focusId,id);
 const events=tick(c,a);assert.equal(events.filter(e=>e.type==='scratch-swing').length,3);assert.equal(events.filter(e=>e.type==='scratch-hit').length,1);
 assert.equal(a.hp,2,'HP goes through the game damage handler');assert.equal(a.stun,id===4?3:0);assert(c.scratchCooldown>7);assert.equal(c.phase,'roaming');
 assert.equal(tick(c,a,1).filter(e=>e.type==='scratch-hit').length,0);assert.equal(catState(c).scratchSerial,1);assert.equal(catState(c).scratchStep,3);
}
// Crossing from the distant warning into melee must not consume the attack.
{const c=cat(),a=actor(0,20);tick(c,a,.01);assert.equal(c.phase,'warning');a.z=16;tick(c,a,.01);assert.equal(c.phase,'scratching');assert.equal(tick(c,a).filter(e=>e.type==='scratch-hit').length,1);}
for(const change of [a=>a.z=20,a=>a.invisible=5,a=>a.state='captured',a=>a.invincible=5]){
 const c=cat(),a=actor();tick(c,a,.01);change(a);const events=tick(c,a);assert.equal(events.filter(e=>e.type==='scratch-swing').length,3);assert(!events.some(e=>e.type==='scratch-hit'));
}
{const c=cat(),a=actor();tick(c,a,.01);assert(!tick(c,a,1.6,[{x:0,z:15,w:5,d:.3}]).some(e=>e.type==='scratch-hit'));}
{const c=cat(),a={...actor(4),hunterCharacter:1,vrTime:15};tick(c,a,.01);assert(!tick(c,a).some(e=>e.type==='scratch-hit'));assert.equal(a.stun,0);}
{const c=cat(),a=actor();tick(c,a,.01);repelCarCats([c],[c],[]);assert.equal(c.phase,'recoil');assert(!tick(c,a,.6).some(e=>e.type==='scratch-hit'));assert.notEqual(c.phase,'flattened');}
// A missed first stroke can connect later, still only once for this combo.
{const c=cat(),a=actor();tick(c,a,.01);a.z=20;assert(!tick(c,a,.4).some(e=>e.type==='scratch-hit'));a.z=16;assert.equal(tick(c,a,1.2).filter(e=>e.type==='scratch-hit').length,1);}
const result={passed:true,version:JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url))).version,meleeRangeMeters:2.5,comboSeconds:1.5,swipes:3,oneEffectPerCombo:true,survivorsUseCentralDamageHandler:true,hunterStunSeconds:3,warningTransitionsToMelee:true,dodgingWallsInvisibilityAndInvincibilityRespected:true,VRImmunityRespected:true,carInterruptsComboAndStillRepels:true,synchronizedComboFields:true};
fs.writeFileSync(new URL('../../cat-combo-unit.json',import.meta.url),JSON.stringify(result,null,2));console.log(result);

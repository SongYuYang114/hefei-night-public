import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {context} from './test-restored.mjs';
import * as loot from '../dist/match-loot.mjs';
import {randomCatKick,kickNearestCat,catKickHeight} from '../dist/cat-kick.mjs';
import {createCat,stepCats,catState} from '../dist/hakimi.mjs';
import * as T from '../dist/vendor/three.module.js';
const actor=(id=6)=>({id:3,characterId:id,x:0,z:0,angle:0,state:'active',stun:0,kickTime:0});
for(const id of [0,6]){
 const a={...actor(id),item:'exhaust',itemQ:'exhaust'};
 for(let n=1;n<=6;n++){assert.equal(loot.recordDogKick(a,()=>0),n%3===0);assert.equal(a.dogRewards.length,Math.floor(n/3));assert.equal(loot.grantDogReward(a),null);}
 a.item=null;assert(loot.grantDogReward(a));assert.equal(a.dogRewards.length,1);assert.equal(loot.grantDogReward(a),null);
 a.item=null;a.state='captured';assert.equal(loot.grantDogReward(a),null);assert.equal(a.dogRewards.length,1);
 a.state='active';assert(loot.grantDogReward(a));assert.equal(a.dogRewards.length,0);
}
let legendary=0;for(let i=0;i<10000;i++){
 const rng=()=>i/10000,item=loot.rollActorLoot(actor(),rng);assert(!['egg','hotpot'].includes(item));if(item==='mushroom')legendary++;
}assert.equal(legendary,500);assert.equal(loot.rollActorLoot(actor(0),()=>0),'egg');assert.equal(loot.rollActorLoot(actor(0),()=>.4),'hotpot');
for(const forbidden of ['egg','hotpot']){const a=actor(),chest={x:0,z:0,progress:0,opened:false,loot:forbidden};assert(loot.advanceChest(a,chest,10,[],()=>.5));assert.equal(a.item,'yzm');}
const profile=randomCatKick(()=>1);assert(Math.abs(profile.height-320)<1e-8);assert(Math.abs(profile.seconds-6)<1e-8);assert.equal(profile.speed,240);
assert.equal(randomCatKick(()=>0).power,.5);assert.equal(randomCatKick(()=>.18).power,1);
for(let i=0;i<=1000;i++){const f=randomCatKick(()=>i/1000);assert(f.height>=1.6&&f.height<=320.001);assert(f.seconds>=1.1&&f.seconds<=6.001);assert(f.speed>0&&f.speed<=240);}
const cat=createCat(0,{x:0,z:2},()=>.5);let draws=0;kickNearestCat(actor(),[cat],[],[],()=>{draws++;return 1;});assert.equal(draws,1);
assert.equal(kickNearestCat(actor(),[cat],[],[],()=>{throw Error('invalid kick drew force');}),null);
const remote=JSON.parse(JSON.stringify(catState(cat)));assert.equal(remote.kickPower,cat.kickPower);assert.equal(remote.kickDuration,cat.kickDuration);assert.equal(remote.kickHeight,cat.kickHeight);
stepCats([cat],[],3,[],[],()=>.5);stepCats([remote],[],3,[],[],()=>.5);assert(catKickHeight(cat)>319);assert.equal(catKickHeight(cat),catKickHeight(remote));assert(Math.abs(cat.x)<40&&Math.abs(cat.z)<40);
stepCats([cat],[],3.001,[],[],()=>.5);assert.equal(cat.phase,'roaming');assert.equal(catKickHeight(cat),0);
const integrated=vm.runInContext(`(()=>{
 role='survivor';$('survivor-choice').value='6';start(781);clearCats();const a=current();Object.assign(a,{x:0,z:14,item:'exhaust',itemQ:'exhaust'});kuchi={x:0,z:16,phase:'squatting',phaseTime:3};
 performKuchiKick(a);const first=a.kuchiKicks===1;const rejected=!performKuchiKick(a)&&a.kuchiKicks===1;
 for(let i=0;i<2;i++){Object.assign(a,{kickTime:0});Object.assign(kuchi,{phase:'squatting',phaseTime:3});performKuchiKick(a);}
 const queued=a.kuchiKicks===3&&a.dogRewards.length===1&&a.item==='exhaust';a.item=null;deliverDogReward(a);const filtered=!!a.item&&!['egg','hotpot'].includes(a.item)&&!a.dogRewards.length;
 back();start(782);const reset=current().kuchiKicks===0&&current().dogRewards.length===0;back();return {first,rejected,queued,filtered,reset};
})()`,context);for(const [k,v]of Object.entries(integrated))assert(v,k);
let code=fs.readFileSync(new URL('../dist/generator-projection.mjs',import.meta.url),'utf8').replace("from 'three'",`from '${new URL('../dist/vendor/three.module.js',import.meta.url).href}'`);
const {createGeneratorProjection,updateGeneratorProjections}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const p=createGeneratorProjection(new T.Texture()),g={progress:0,projection:p},camera=new T.PerspectiveCamera();camera.rotation.set(.3,.5,0);assert(!p.root.visible);
updateGeneratorProjections([g],camera,1,'playing');assert(!p.root.visible);g.progress=1;updateGeneratorProjections([g],camera,2,'playing');assert(p.root.visible);assert(p.face.quaternion.equals(camera.quaternion));assert.equal(p.material.uniforms.time.value,2);
for(const mode of ['menu','result']){updateGeneratorProjections([g],camera,3,mode);assert(!p.root.visible);}
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),asset=fs.readFileSync(new URL('../dist/assets/generator-projection.jpg',import.meta.url));
assert.equal(hash(asset),hash(fs.readFileSync('C:/Users/Administrator/AppData/Local/Temp/codex-clipboard-58e6986b-8e9a-47d5-9041-e9f70fe806ce.jpg')));
const result={passed:true,version:JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url))).version,protocol:36,threeSuccessfulDogKicksGrantOneItem:true,fullInventoryQueuesRewards:true,oloChestAndRewardExcludeEggAndHealing:true,legendaryRatePreserved:true,randomKickMaxHeight:320,randomKickMaxDuration:6,randomForceHostSnapshot:true,extremeFlightStaysInsideMapAndLands:true,projectionOnlyAfterRepair:true,projectionBillboardsAndHidesAfterMatch:true,projectionRawAssetSHA256:hash(asset),...integrated};
fs.writeFileSync(new URL('../../dog-rewards-unit.json',import.meta.url),JSON.stringify(result,null,2));console.log(result);

import {HUNTER_WARNING_DISTANCE,LIMIT,blocked,distance,findPath} from './core.mjs?v=car-horizontal-1';
export const CHEST_COUNT=5,CHEST_SECONDS=10,EGG='egg',EXHAUST='exhaust',HOT_POT='hotpot',SELF_RESCUE='yzm',FRIED_RICE='friedrice',WEIRD_MUSHROOM='mushroom',LEGENDARY_DROP_RATE=.05,MEAL_SECONDS=0;
export const ITEMS={friedrice:{name:'蛋炒饭',hint:'无敌红眼女 · 追捕追杀者与宋玉莹 · 顶鞋底 15 秒'},mushroom:{name:'诡异香菇',rarity:'legendary',hint:'传奇 · 召唤同角色 AI 替身 · 受击一次消失'},egg:{name:'不可思议的蛋',hint:'重置技能冷却与次数'},exhaust:{name:'华莱！',hint:'尾气命中双方 · 失明 5 秒'},hotpot:{name:'火锅油条',hint:'脱离追杀者警告范围 · 瞬间回复一格生命'},yzm:{name:'yzm',hint:'被囚禁时按 E · 自救一次'}};
export const rollChestLoot=(rng=Math.random)=>{const n=Math.max(0,Math.min(1,rng()));return n>=1-LEGENDARY_DROP_RATE?WEIRD_MUSHROOM:[EGG,EXHAUST,HOT_POT,SELF_RESCUE,FRIED_RICE][Math.min(4,Math.floor(n/(1-LEGENDARY_DROP_RATE)*5))];};
export function cancelMeal(actor){actor.mealActive=false;actor.mealTime=0;}
export function consumeHotPot(actor,hunter){
 if(actor.state!=='active'||actor.stun>0||actor.item!==HOT_POT)return {ok:false,reason:'inactive'};
 if(actor.hp>=2)return {ok:false,reason:'full-health'};
 if(distance(actor,hunter)<HUNTER_WARNING_DISTANCE)return {ok:false,reason:'hunter-nearby'};
 actor.hp=Math.min(2,actor.hp+1);actor.item=null;cancelMeal(actor);actor.eating=1.2;return {ok:true};
}
export function consumeSelfRescue(actor){
 if(actor.state!=='captured'||actor.stun>0||actor.item!==SELF_RESCUE)return false;
 actor.item=null;return true;
}
export const CHEST_POSITIONS=Object.freeze([{x:-37.5,z:-37.5},{x:37.5,z:-37.5},{x:-37.5,z:37.5},{x:37.5,z:37.5},{x:3,z:-15}].map(p=>Object.freeze(p)));
export function seededRandom(seed){let state=seed>>>0;return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
// Rejection sampling over playable floor, including navigation connectivity.
export function randomFloorPoints(count,obstacles,rng=Math.random,reserved=[],accept=()=>true){
 const points=[];
 for(let tries=0;points.length<count&&tries<20000;tries++){
  const p={x:(rng()*2-1)*(LIMIT-2),z:(rng()*2-1)*(LIMIT-2)};
  if(!accept(p)||blocked(p.x,p.z,obstacles,.9)||blocked(Math.round(p.x),Math.round(p.z),obstacles,.65)||[...reserved,...points].some(q=>distance(p,q)<2))continue;
  if(distance(p,{x:0,z:0})>1&&!findPath(p,{x:0,z:0},obstacles).length)continue;
  points.push(p);
 }
 if(points.length!==count)throw Error('地图缺少可到达的空闲出生位置');
 return points;
}
export const HUNTER_SPAWN_DISTANCE=20;
export function randomMatchSpawns(obstacles,rng=Math.random,reserved=[]){
 for(let round=0;round<8;round++){
  const survivors=randomFloorPoints(4,obstacles,rng,reserved);
  try{const hunter=randomFloorPoints(1,obstacles,rng,[...reserved,...survivors],p=>survivors.every(s=>distance(p,s)>=HUNTER_SPAWN_DISTANCE))[0];return [...survivors,hunter];}catch(error){if(round===7)throw error;}
 }
}
export function advanceChest(actor,chest,dt,obstacles){
 if(actor.state!=='active'||actor.item||chest.opened||distance(actor,chest)>=2.4)return false;
 // Walls cannot be used to open a chest from the other side.
 const steps=Math.ceil(distance(actor,chest)/.2);
 for(let i=1;i<steps;i++)if(blocked(actor.x+(chest.x-actor.x)*i/steps,actor.z+(chest.z-actor.z)*i/steps,obstacles,.15))return false;
 chest.progress=Math.min(1,chest.progress+Math.max(0,dt)/CHEST_SECONDS);
 if(chest.progress<1)return false;
 chest.opened=true;actor.item=chest.loot||EGG;return true;
}
export function consumeEgg(actor){
 if(actor.state!=='active'||actor.item!==EGG)return false;
 actor.item=null;actor.cooldown=0;actor.skillUsed=false;return true;
}

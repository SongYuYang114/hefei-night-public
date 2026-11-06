import {blocked,distance,lineClear,findPath} from './core.mjs';

export function echoSpawnPoint(owner,obstacles,actors,mines=[]){
 for(const radius of [1.8,2.4,3.2])for(let i=0;i<24;i++){
  const angle=owner.angle+i*Math.PI/12,p={x:owner.x+Math.sin(angle)*radius,z:owner.z+Math.cos(angle)*radius};
  if(blocked(p.x,p.z,obstacles,.65)||blocked(Math.round(p.x),Math.round(p.z),obstacles,.6)||!lineClear(owner,p,obstacles)||actors.some(a=>a.state==='active'&&distance(a,p)<1.1)||mines.some(m=>distance(m,p)<1.2))continue;
  if(!findPath(p,owner,obstacles).length)continue;
  return p;
 }
 return null;
}
export function createEchoState(owner,point,id){
 return {id,isEcho:true,ownerSlot:owner.isEcho?owner.ownerSlot:owner.id,characterId:owner.characterId??owner.id,...point,angle:owner.angle,
  shoeTime:0,shoeNpcId:0,shoeX:0,shoeZ:0,shoeAngle:0,healTime:0,state:'active',hp:2,stamina:100,invincible:0,captures:0,prison:0,rescue:0,cooldown:0,dash:0,slow:0,reveal:0,
  path:[],repath:0,walk:0,moving:false,running:false,interacting:false,item:null,itemQ:null,kuchiKicks:0,dogRewards:[],kickTime:0,kickAck:0,kuchiSlow:0,
  jumpTime:0,jumpCooldown:0,jumpSerial:0,jumpAck:0,blind:0,stun:0,invisible:0,eating:0,legRush:0,skillUsed:false,
  launchTime:0,launchVX:0,launchVZ:0,mealActive:false,mealTime:0,craftTime:0,craftBlocked:false,curryReady:false,
  curryCraftWait:0,curryHold:0,curryRetreat:null,lootTarget:null,fleeTime:0,fleeTarget:null,destination:null,jumpThink:0};
}

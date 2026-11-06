import {lineClear,LIMIT} from './core.mjs';
import {isOlo} from './olo.mjs';
export const VR_SECONDS=15,VR_COOLDOWN=30,LASER_COOLDOWN=5,LASER_RANGE=32,LASER_RADIUS=.55;
export const VR_HUNTER_NAME='AI嘉豪宋雨杨';
export const isVRHunter=a=>a?.hunterCharacter===1;
export const immuneToNegative=a=>isOlo(a)||isVRHunter(a)&&a.vrTime>0&&a.state==='active';
export const HUNTERS=[
 {name:'宋雨杨（经典）',skill:'合肥车技',cooldown:10,portrait:'./assets/cover.png'},
 {name:VR_HUNTER_NAME,skill:'AI嘉豪来袭',cooldown:VR_COOLDOWN,portrait:'./assets/portraits/ai-jiahao.png',description:'戴上 VR 眼镜，进入 15 秒「豪情在天」自嗨摇摆，期间免疫眩晕、失明、减速、炸飞、强制传送和红眼女抓捕。形态期间颈椎病层数暂不影响肘击速度；开启时在场上随机生成 3 个自己的跳舞幻影，全员可见，附近哈基米会对幻影炸毛哈气，幻影随形态结束消失。仍可移动、肘击，按 Q 朝视角方向发射镭射眼，命中的求生者受到一次伤害，镭射眼冷却 5 秒，墙体会挡住镭射。技能冷却 30 秒，从开启时计时。结束时获得一层可叠加的颈椎病，每层使肘击前摇、后摇各增加 0.5 秒，持续至本局结束。平时不戴 VR 眼镜。'}
];
export function clearVRNegative(a){
 if(!immuneToNegative(a))return;
 Object.assign(a,{stun:0,blind:0,slow:0,kuchiSlow:0,launchTime:0,launchVX:0,launchVZ:0,shoeTime:0,shoeNpcId:0});
}
export function beginVR(a){
 if(!isVRHunter(a)||a.state!=='active'||a.vrTime>0||a.cooldown>0||a.stun>0||a.shoeTime>0||a.jumpTime>0)return false;
 Object.assign(a,{vrTime:VR_SECONDS,vrElapsed:0,laserCooldown:0,cooldown:VR_COOLDOWN,swing:0,hitDelay:0,attack:0,vrSerial:(a.vrSerial||0)+1});clearVRNegative(a);return true;
}
export function stepVR(a,dt){
 if(!isVRHunter(a))return false;a.laserCooldown=Math.max(0,(a.laserCooldown||0)-dt);
 if(!(a.vrTime>0))return false;clearVRNegative(a);const active=Math.min(dt,a.vrTime);a.vrElapsed=(a.vrElapsed||0)+active;a.vrTime=Math.max(0,a.vrTime-dt);
 if(a.vrTime<1e-7){a.vrTime=0;a.neckStacks=(a.neckStacks||0)+1;return true;}return false;
}
export function elbowTiming(a,baseCooldown=1.65){const extra=isVRHunter(a)&&!(a.vrTime>0)?Math.max(0,a.neckStacks||0)*.5:0;return {impact:.3+extra,duration:.8+extra*2,cooldown:baseCooldown+extra*2,extra};}
export function laserCast(a,angle,survivors,obstacles=[]){
 if(!isVRHunter(a)||!immuneToNegative(a)||a.laserCooldown>0)return null;
 const forward={x:Math.sin(angle),z:Math.cos(angle)},origin={x:a.x,z:a.z};let range=LASER_RANGE;
 for(let d=.1;d<=LASER_RANGE;d+=.1){const p={x:origin.x+forward.x*d,z:origin.z+forward.z*d};if(Math.abs(p.x)>LIMIT||Math.abs(p.z)>LIMIT||!lineClear(origin,p,obstacles)){range=Math.max(0,d-.1);break;}}
 const hits=survivors.filter(s=>{if(isOlo(s)||s.state!=='active'||s.invincible>0||s.launchTime>0)return false;const dx=s.x-origin.x,dz=s.z-origin.z,along=dx*forward.x+dz*forward.z,across=Math.abs(dx*forward.z-dz*forward.x);return along>=0&&along<=range&&across<=LASER_RADIUS&&lineClear(origin,s,obstacles);});
 a.laserCooldown=LASER_COOLDOWN;a.angle=angle;a.laserSerial=(a.laserSerial||0)+1;
 return {serial:a.laserSerial,x:a.x,z:a.z,angle,range,hits};
}

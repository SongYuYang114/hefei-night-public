import {immuneToNegative} from './vr-hunter.mjs';
import {HUNTER_WARNING_DISTANCE} from './core.mjs';
import {teleportToTeammate,TELEPORT_COOLDOWN} from './teleport.mjs';
export const SURVIVOR_SKILLS=[
 {name:'突然哑巴',icon:'◌',cooldown:30,description:'隐身 5 秒，甩开追杀者的追踪。隐身期间仍可能被盲打或汽车击中。'},
 {name:'这是男人？',icon:'✦',cooldown:60,description:'仅在出现“追杀者正在靠近”提示时可使用，让追杀者立即眩晕 3 秒，无法移动、肘击或使用技能。'},
 {name:'专业养猪',icon:'♟',cooldown:30,description:'向前扔出一只猪，以 7 米/秒追踪最近的其他活动角色（包括队友、追杀者和替身），接近后自爆，使 2.5 米内其他角色眩晕 3 秒，不扣血，不影响自己。猪踩到麦丽素减速 50%，持续 5 秒。被合肥车技碾压后汽车会腾空翻转，落地爆炸并使追杀者眩晕 5 秒。播放 Minecraft 爆炸音效。冷却 30 秒。'},
 {name:'香菇咖喱',icon:'♨',cooldown:0,craftSeconds:10,description:'原地长按 Q 制作 10 秒，松开、移动或受击会中断。完成后再次按 Q，在脚下埋下香菇咖喱炸弹；1.2 秒后生效，任何敌方或友方（包括自己）踩中都会被随机炸飞并眩晕 3 秒。炸弹仅自己可见。独立携带，不占 E 道具栏。'},
 {name:'脖子以下全是腿',icon:'↯',cooldown:30,description:'移动速度增加 300%（达到原速的 4 倍），持续 3 秒。冷却 30 秒，可重复释放。'},
 {name:'开！',icon:'↗',cooldown:TELEPORT_COOLDOWN,description:'找人开启一场腾讯会议，随机传送到一名仍在场的队友身边（包括被囚禁的队友），有 50% 概率也将追杀者传送到靠近提示边缘（约 11.5 米处）。冷却 40 秒；没有可传送的队友或安全落点时不消耗冷却。'}
];
export const characterIdOf=actor=>actor.characterId??actor.id;
export const survivorSpeedMultiplier=actor=>actor.state==='active'&&actor.legRush>0?4:1;
// The HUD warning and both skill restrictions use exactly the same boundary.
export function isHunterNearby(actor,hunter){
 return actor.state==='active'&&Math.hypot(actor.x-hunter.x,actor.z-hunter.z)<HUNTER_WARNING_DISTANCE;
}
export function useSurvivorSkill(actor,hunter,context={}){
 if(actor.state!=='active')return {ok:false,reason:'inactive'};
 if(actor.stun>0||actor.shoeTime>0)return {ok:false,reason:'stunned'};
 if(actor.cooldown>0)return {ok:false,reason:'cooldown'};
 const id=characterIdOf(actor),definition=SURVIVOR_SKILLS[id];
 if(!definition)return {ok:false,reason:'unknown'};
 if(definition.oncePerMatch&&actor.skillUsed)return {ok:false,reason:'already-used'};
 if(id===1&&!isHunterNearby(actor,hunter))return {ok:false,reason:'hunter-not-nearby'};
 if(id===5)return teleportToTeammate(actor,hunter,context);
 actor.cooldown=definition.cooldown;
 if(id===0){actor.invisible=5;hunter.memory=null;return {ok:true,type:'invisible'};}
 if(id===1){if(immuneToNegative(hunter))return {ok:true,type:'immune'};hunter.stun=3;hunter.swing=0;hunter.hitDelay=0;hunter.moving=false;return {ok:true,type:'stun'};}
 if(id===2)return {ok:true,type:'seeker-pig'};
 if(id===4){actor.skillUsed=false;actor.legRush=3;return {ok:true,type:'leg-rush'};}
 return {ok:true,type:actor.curryReady?'plant-curry':'craft-curry'};
}

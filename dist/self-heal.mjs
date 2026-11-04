export const SELF_HEAL_SECONDS=20;
export function cancelSelfHeal(actor){actor.healTime=0;}
export function advanceSelfHeal(actor,dt,{held=false,stationary=false,noTarget=false,usingSkill=false}={}){
 if(!held||!stationary||!noTarget||usingSkill||actor.state!=='active'||actor.hp>=2||actor.stun>0||actor.shoeTime>0||actor.kickTime>0||actor.jumpTime>0||actor.launchTime>0||actor.driving){cancelSelfHeal(actor);return false;}
 actor.moving=false;actor.interacting=true;actor.healTime=Math.min(SELF_HEAL_SECONDS,(actor.healTime||0)+Math.max(0,dt));
 if(actor.healTime<SELF_HEAL_SECONDS-1e-7)return false;
 actor.hp=Math.min(2,actor.hp+1);cancelSelfHeal(actor);return true;
}

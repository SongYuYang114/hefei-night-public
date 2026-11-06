// Identity is the selected character, never a room slot or NPC instance ID.
export const OLO_ID=6;
export const isOlo=actor=>actor?.characterId===OLO_ID;
export const canRepair=actor=>!isOlo(actor);
export const canRescue=actor=>!isOlo(actor);
export const oloSpeedMultiplier=actor=>isOlo(actor)?2:1;
export function enforceOloPassive(actor){
 if(!isOlo(actor))return;
 actor.hp=2;
 for(const key of ['stun','blind','slow','kuchiSlow','launchTime','launchVX','launchVZ','shoeTime','shoeNpcId','dash','legRush','invisible','reveal','invincible','eating','healTime','mealTime','craftTime','cooldown'])actor[key]=0;
 actor.mealActive=false;
}

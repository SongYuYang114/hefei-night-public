export const JUMP_SECONDS=.64,JUMP_HEIGHT=1.25,JUMP_COOLDOWN=.78;
export function beginJump(actor){
 if(actor.state!=='active'||actor.stun>0||actor.shoeTime>0||actor.kickTime>0||actor.driving||actor.launchTime>0||actor.jumpTime>0||actor.jumpCooldown>0)return false;
 actor.jumpTime=JUMP_SECONDS;actor.jumpCooldown=JUMP_COOLDOWN;actor.jumpSerial=(actor.jumpSerial||0)+1;return true;
}
export function consumeJumpInput(actor,input){
 const press=input.jumpPress||0;if(press<=(actor.jumpAck||0))return false;
 actor.jumpAck=press;return beginJump(actor);
}
export const jumpHeight=a=>a.jumpTime>0?4*JUMP_HEIGHT*(a.jumpTime/JUMP_SECONDS)*(1-a.jumpTime/JUMP_SECONDS):0;
export const jumpGrounded=a=>!(a.launchTime>0)&&jumpHeight(a)<.18;

// Own the browser pointer lock; game state owns when play is active.
export function createMouseCapture({canvas,document,isActive,turn,onUnlock,hint,fine=true,now=()=>performance.now()}){
 let pending=false,wasLocked=false,releaseRequested=false,escapeUntil=0;
 const locked=()=>document.pointerLockElement===canvas;
 const render=()=>{document.body.classList.toggle('mouse-gameplay',fine&&isActive());hint.classList.toggle('hidden',!fine||!isActive()||locked());};
 const release=()=>{if(locked()){releaseRequested=true;document.exitPointerLock();}render();};
 async function capture(){
  render();if(!fine||!isActive()||locked()||pending)return;
  pending=true;
  try{await canvas.requestPointerLock();if(!isActive()&&locked()){releaseRequested=true;document.exitPointerLock();}}catch{/* A trusted click on the hint can retry after focus/user-activation denial. */}
  finally{pending=false;render();}
 }
 document.addEventListener('pointerlockchange',()=>{
  const current=locked(),lost=wasLocked&&!current;wasLocked=current;
  if(!current){const deliberate=releaseRequested;releaseRequested=false;if(lost&&isActive()&&!deliberate){escapeUntil=now()+250;onUnlock();}else if(deliberate&&isActive())capture();}
  render();
 });
 document.addEventListener('mousemove',e=>{if(isActive()&&locked())turn(e.movementX||0,e.movementY||0);});
 hint.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'){e.preventDefault();capture();}});
 return {locked,capture,release,ignoreEscape:()=>now()<escapeUntil,sync(){if(isActive())capture();else release();}};
}

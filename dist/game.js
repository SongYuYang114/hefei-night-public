import {spawnVRPhantoms,vrPhantomState} from './vr-phantoms.mjs';
import {createVRPhantomVisual} from './vr-phantom-visual.mjs';
import {createLegendaryCatVisual} from './legendary-cat-rig.mjs';
import {spawnCats,spawnMatchCats,createCat,stepCats,catState,catFightState,catCarTargets,flattenCats,repelCarCats} from './hakimi.mjs';
import {createCatVisual,poseCatVisual,createCatFightVisual,poseCatFightVisual,disposeCatVisual} from './hakimi-visual.mjs';
import {HUNTERS,isVRHunter,immuneToNegative,beginVR,stepVR,clearVRNegative,elbowTiming,laserCast} from './vr-hunter.mjs';
import {createLaserVisual,poseLaserVisual} from './laser-visual.mjs';
import {RED_EYE_SPEED,SHOE_HOLD_SECONDS,redEyeActorId,redEyeSpawn,createRedEye,stepRedEye,releaseShoeHold,redEyeState} from './red-eye.mjs';
import {createRedEyeVisual,poseRedEyeVisual,disposeRedEyeVisual} from './red-eye-visual.mjs';
import {DirectRoom} from './direct-room.mjs';
import {EasyRoom} from './easy-room.mjs';
import {createSeekerPig,stepSeekerPig,explodeSeekerPig,seekerPigState,pigHeight} from './seeker-pig.mjs';
import {createPigVisual,posePigVisual,disposePigVisual} from './pig-visual.mjs';
import {createCameraOcclusion,orbitPosition,CAMERA_MIN_PITCH,CAMERA_MAX_PITCH,CAMERA_MIN_DISTANCE,CAMERA_MAX_DISTANCE} from './camera-view.mjs';
import {SELF_HEAL_SECONDS,cancelSelfHeal,advanceSelfHeal} from './self-heal.mjs';
import {echoSpawnPoint,createEchoState} from './echo.mjs';
import {createSelectionLobby} from './selection-lobby.mjs';
import {DRIVE_SECONDS,DRIVE_COOLDOWN,DRIVE_SPEED,CAR_AIR_SECONDS,CAR_CRASH_STUN,resetDrive,beginDrive,stepDrivenCar,driveSteer,driveSpeed,driveHeight,driveSpin} from './drive-car.mjs';
import {INPUT_STEP,moveControlled,LocalPrediction,MotionTrack,InputQueue,remoteFallback} from './net-motion.mjs';
import {CURRY_CRAFT_SECONDS,canSeeCurryMine,advanceCurryCraft,cancelCurryCraft,plantCurry,stepCurryMine,stepCurryFlight,curryFlightHeight} from './curry.mjs';
import {BLIND_SECONDS,createExhaust,stepExhaust} from './exhaust.mjs';
import {createMouseCapture} from './mouse-capture.mjs';
import {CHEST_COUNT,CHEST_POSITIONS,EGG,EXHAUST,HOT_POT,SELF_RESCUE,WEIRD_MUSHROOM,FRIED_RICE,MEAL_SECONDS,cancelMeal,consumeHotPot,consumeSelfRescue,ITEMS,rollChestLoot,seededRandom,randomFloorPoints,randomMatchSpawns,advanceChest,consumeEgg} from './match-loot.mjs';
import * as THREE from 'three';
import {GLTFLoader} from './vendor/GLTFLoader.js?v=2';
import {createHunterRig,ELBOW_DURATION,ELBOW_IMPACT} from './hunter-rig.mjs?v=car-horizontal-1';
import {createCarVisual,disposeCarVisual} from './car-visual.mjs';
import {createSurvivorRig,SURVIVOR_NAMES,SURVIVOR_ASSETS,SURVIVOR_ASSET_IDS} from './survivor-rig.mjs';
import {SURVIVOR_SKILLS,useSurvivorSkill,isHunterNearby,characterIdOf,survivorSpeedMultiplier} from './survivor-skills.mjs';
import {createCharacterPreview,cloneModel} from './character-preview.mjs';
import {LIMIT,REQUIRED,DURATION,repairDuration,distance,clamp,blocked,move,lineClear,findPath,hit,outcome,createCarRush,carBlocked,stepCarRush} from './core.mjs?v=car-horizontal-1';
import {createKuchi,stepKuchi,stepMailisu,kuchiSpeedFactor,kuchiState,KUCHI_SLOW_SECONDS,canSeeMailisu,canKickKuchi,kickKuchi,consumeKickInput,KUCHI_SQUAT_SECONDS} from './kuchi.mjs';
import {createKuchiRig} from './kuchi-rig.mjs';
import {beginJump,consumeJumpInput,jumpHeight} from './jump.mjs';
import {EXTRA_COVER} from './extra-cover.mjs';
const $=id=>document.getElementById(id),show=(id,v=true)=>$(id).classList.toggle('hidden',!v);
const keys={},obs=[],gens=[],gates=[],cages=[],survivors=[],effects=[],cars=[],pigs=[],redEyes=[],cats=[],catFights=[],chests=[],gases=[],mines=[],echoes=[];
const allSurvivors=()=>[...survivors,...echoes];let echoSerial=100;
const hunterLooks=new Map(),vrPhantoms=[];let laserVisual,vrHunterGltf;
let selectionLobby,characterPreview,mouseCapture,teleportCameraPending=false,kuchi=null,kuchiRig=null,jumpPress=0,fPress=0,mailisuId=0;
const mailisu=[],mailisuVisuals=new Map(),jumpSoundsSeen=new Map();
const syncMouse=()=>mouseCapture?.sync();
let renderer,scene,camera,hunter,mode='lobby',role='survivor',difficulty='normal',remaining=DURATION,elapsed=0,camYaw=0,camPitch=.31,playerIndex=0,toastTimer,interact=null,uiTime=0,pausedHelp=false,sound=true,audio=null,heartbeatTime=0,drag=null,touchMove={x:0,z:0},lastTime=0;
let cameraOcclusion,camDistance=7.4,pigSerial=0,redEyeSerial=0;
let initialSpawns=[],testFreezeAI=false,legendaryCatGltf=null;
let seed=2319;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const mat=(c,roughness=.85,metalness=0)=>new THREE.MeshStandardMaterial({color:c,roughness,metalness});
const stone=mat('#586765'),darkStone=mat('#32413f'),wood=mat('#4c4840'),iron=mat('#273c40',.42,.6),hedge=mat('#304b42'),leaf=mat('#294d46'),gold=mat('#a38b52',.4,.55),pale=mat('#bebcaf');
const glow=new THREE.MeshStandardMaterial({color:'#b8e5d5',emissive:'#86d8bc',emissiveIntensity:1.6,roughness:.3});
function mesh(geo,m,parent=scene,x=0,y=0,z=0){const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function box(x,y,z,w,h,d,m,parent=scene){return mesh(new THREE.BoxGeometry(w,h,d),m,parent,x,y,z);}
function cyl(x,y,z,r,h,m,parent=scene,rt=r,n=8){return mesh(new THREE.CylinderGeometry(rt,r,h,n),m,parent,x,y,z);}
function solid(x,z,w,d,h,m=stone){obs.push({x,z,w,d});return box(x,h/2,z,w,h,d,m);}
function lamp(x,z,height=3){cyl(x,height/2,z,.065,height,iron);box(x,height+.32,z,.52,.08,.52,iron);box(x,height-.32,z,.52,.08,.52,iron);box(x,height,z,.28,.4,.28,new THREE.MeshStandardMaterial({color:'#e6c581',emissive:'#e6af51',emissiveIntensity:2}));const light=new THREE.PointLight('#ffc77d',4,8,2);light.position.set(x,height,z);scene.add(light);}
function tree(x,z,scale=1){const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);cyl(0,2*scale,0,.22*scale,4*scale,wood,g,.14*scale);for(let i=0;i<3;i++){const b=cyl((i-1)*.7*scale,(3.3+i*.5)*scale,0,.09*scale,2.6*scale,wood,g,.04);b.rotation.z=(i-1)*.6;}for(let i=0;i<4;i++){const m=mesh(new THREE.IcosahedronGeometry((1.5+rand()*.5)*scale,1),leaf,g,(rand()-.5)*1.4*scale,(4+i*.65)*scale,(rand()-.5)*scale);m.scale.y=.65;}obs.push({x,z,w:.5*scale,d:.5*scale});}
function groundTexture(){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#4b6156';ctx.fillRect(0,0,256,256);for(let i=0;i<12000;i++){const v=rand()*50;ctx.fillStyle=`rgba(${60+v},${78+v},${68+v},.28)`;ctx.fillRect(rand()*256,rand()*256,rand()*3+1,rand()*3+1);}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(22,22);return t;}
function stonePath(x,z,w,d){const m=mat('#69776c');const o=box(x,.01,z,w,.07,d,m);o.castShadow=false;for(let i=0;i<d;i+=1.1){box(x,.058,z-d/2+i,w,.013,.035,darkStone);}for(let i=0;i<w;i+=1.5)box(x-w/2+i,.058,z,.025,.013,d,darkStone);}
function buildWorld(){
 scene=new THREE.Scene();scene.background=new THREE.Color('#263d47');scene.fog=new THREE.FogExp2('#31484c',.022);
 camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,150);
 renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;$('world').appendChild(renderer.domElement);
 scene.add(new THREE.HemisphereLight('#d3e5ef','#394c36',2.1));const moonlight=new THREE.DirectionalLight('#c9e7ed',2.7);moonlight.position.set(-14,30,17);moonlight.castShadow=true;moonlight.shadow.mapSize.set(2048,2048);Object.assign(moonlight.shadow.camera,{left:-45,right:45,top:45,bottom:-45,near:1,far:90});moonlight.shadow.bias=-.0008;scene.add(moonlight);
 const moon=mesh(new THREE.SphereGeometry(2.1,20,20),new THREE.MeshBasicMaterial({color:'#dfebda'}),scene,-20,29,-48);moon.castShadow=false;
 const ground=mesh(new THREE.PlaneGeometry(160,160),new THREE.MeshStandardMaterial({map:groundTexture(),roughness:1}));ground.rotation.x=-Math.PI/2;ground.castShadow=false;
 stonePath(0,9,5,35);stonePath(0,0,75,4);stonePath(-18,9,5,40);stonePath(18,-6,5,40);
 // Perimeter walls and a wrought-iron entrance on each side.
 for(let i=-40;i<=40;i+=4){box(i,1.3,-40,4,2.6,.7,darkStone);box(i,1.3,40,4,2.6,.7,darkStone);box(i,2.7,-40,4.1,.16,.9,stone);box(i,2.7,40,4.1,.16,.9,stone);}
 for(const x of [-40,40])for(let z=-38;z<=38;z+=4){const gz=x<0?8:-8;if(Math.abs(z-gz)<4)continue;box(x,1.3,z,.7,2.6,4,darkStone);box(x,2.7,z,.9,.16,4.1,stone);}
 // New outer maintenance yard and garden, linked to both chapel entrances.
 stonePath(0,-30,4,19);stonePath(0,33,74,4);stonePath(0,-33,74,4);stonePath(-33,-8,4,46);stonePath(33,7,4,46);
 for(const [x,z,w,d] of [[-29,-22,1.5,9],[-35,-4,6,1.5],[-30,22,1.5,9],[30,22,1.5,9],[35,17,5,1.5],[30,-23,1.5,9]]){solid(x,z,w,d,1.65,hedge);box(x,1.72,z,w,.12,d,leaf);}
 for(const [x,z,w,d] of [[-30,-7,2,2],[-35,8,3,1.5],[30,5,2,2],[34,-9,3,1.5],[-10,-31,7,1.2],[10,31,7,1.2]])solid(x,z,w,d,1.2,wood);
 for(const [x,z] of [[-35,-32],[-35,32],[35,-32],[35,32],[-20,-35],[20,-35],[-20,35],[20,35]])tree(x,z,.9);
 for(const [x,z] of [[-33,-14],[33,14],[-4,-31],[4,31]])lamp(x,z);
 for(const o of EXTRA_COVER){solid(o.x,o.z,o.w,o.d,o.h,o.kind==='hedge'?hedge:wood);box(o.x,o.h+.04,o.z,o.w+.08,.08,o.d+.08,o.kind==='hedge'?leaf:iron);}
 // Chapel: open entrance, pillars, pointed roof and rose window.
 for(const x of [-7,7])solid(x,-13,.7,13,5.3,darkStone);solid(-4.5,-19.3,5,.7,5.3,darkStone);solid(4.5,-19.3,5,.7,5.3,darkStone);box(0,4.65,-19.3,4,1.3,.9,stone);for(const x of [-2.25,2.25])box(x,2,-19.3,.5,4,.9,stone);stonePath(0,-21,3.4,6);lamp(-2.5,-21);lamp(2.5,-21);solid(-4.8,-6.7,4.4,.7,4.8);solid(4.8,-6.7,4.4,.7,4.8);
 for(const x of [-6.8,6.8])for(const z of [-7,-13,-19]){box(x,2.8,z,1,5.6,1,stone);box(x,5.6,z,1.4,.2,1.4,darkStone);}
 const roof=mesh(new THREE.ConeGeometry(10,5,4),mat('#344449'),scene,0,7.6,-13);roof.rotation.y=Math.PI/4;roof.scale.z=.92;
 const rose=mesh(new THREE.TorusGeometry(1.15,.13,8,32),gold,scene,0,5,-6.27);const pane=mesh(new THREE.CircleGeometry(1.08,32),new THREE.MeshStandardMaterial({color:'#799487',emissive:'#65958a',emissiveIntensity:.4,side:THREE.DoubleSide}),scene,0,5,-6.26);for(let i=0;i<6;i++){const bar=box(0,5,-6.2,.055,2.1,.05,gold);bar.rotation.z=i*Math.PI/6;}
 for(const x of [-4,4]){box(x,1.7,-6.2,.8,3.4,.8,darkStone);cyl(x,3.7,-6.2,.45,.9,stone,scene,0,4);}box(0,.06,-8,12,.08,10,mat('#53625b'));
 lamp(-3,-5.4);lamp(3,-5.4);lamp(-18,3);lamp(18,-3);lamp(-9,16);lamp(9,16);
 // Trimmed hedges form looping paths around cover.
 for(const [x,z,w,d] of [[-12,7,5,1.4],[-8,13,1.5,6],[10,5,5,1.5],[14,13,1.5,6],[-18,-10,1.6,8],[19,-17,7,1.4],[-16,19,8,1.5],[5,21,8,1.4],[-21,-21,6,1.5]]){solid(x,z,w,d,1.65,hedge);box(x,1.68,z,w+.12,.15,d+.12,leaf);}
 for(const [x,z] of [[-12,-2],[10,-12],[-21,13],[21,19]]){solid(x,z,2.1,1.4,1.2,wood);box(x,1.25,z,2.25,.12,1.5,mat('#72664c'));for(const dx of [-.7,.7])box(x+dx,.7,z, .06,1.25,1.55,iron);}
 for(const [x,z] of [[-23,-24],[-24,-15],[-24,23],[-8,24],[13,24],[24,23],[24,5],[24,-24],[-11,-23],[10,-24],[-15,-16]])tree(x,z,.9+rand()*.4);
 for(let i=0;i<22;i++){const x=rand()*48-24,z=rand()*48-24;if(blocked(x,z,obs,2)||Math.abs(x)<5||Math.abs(z)<4)continue;const m=mesh(new THREE.DodecahedronGeometry(.4+rand()*.35,0),stone,scene,x,.25,z);m.scale.y=.55;}
 // A small cemetery with rows of headstones.
 for(let i=0;i<7;i++){const x=10+(i%3)*3,z=-19+Math.floor(i/3)*3;solid(x,z,.9,.5,1.2,stone);mesh(new THREE.SphereGeometry(.44,10,6,0,Math.PI*2,0,Math.PI/2),stone,scene,x,1.2,z).scale.z=.5;box(x,1.25,z+.26,.06,.4,.02,darkStone);box(x,1.28,z+.26,.25,.05,.02,darkStone);}
 for(const [i,p] of [[0,[-17,14]],[1,[15,17]],[2,[-17,-15]],[3,[0,-14]],[4,[18,-14]],[5,[-33,-10]],[6,[33,10]]])createGenerator(...p,i);
 createGate(-38,8,'西侧门');createGate(38,-8,'东侧门');
 for(const [x,z] of [[-11,20],[12,-3],[-12,-22]])createCage(x,z);
 const pgeo=new THREE.BufferGeometry(),coords=[];for(let i=0;i<180;i++)coords.push(rand()*100-50,.3+rand()*5,rand()*100-50);pgeo.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));const dust=new THREE.Points(pgeo,new THREE.PointsMaterial({color:'#c2d2bb',size:.045,transparent:true,opacity:.5}));scene.add(dust);
}
function clearVRPhantoms(){for(const p of vrPhantoms)p.root.userData.dispose();vrPhantoms.length=0;}
function addVRPhantom(data){const p={...data,root:createVRPhantomVisual(vrHunterGltf)};vrPhantoms.push(p);scene.add(p.root);return p;}
function spawnDancePhantoms(){clearVRPhantoms();for(const p of spawnVRPhantoms(hunter,driveObstacles(),rand,elapsed))addVRPhantom(p);}
function syncVRPhantoms(data=[]){const ids=new Set(data.map(p=>p.id));for(let i=vrPhantoms.length-1;i>=0;i--)if(!ids.has(vrPhantoms[i].id)){vrPhantoms[i].root.userData.dispose();vrPhantoms.splice(i,1);}for(const copy of data){const p=vrPhantoms.find(p=>p.id===copy.id)||addVRPhantom(copy);Object.assign(p,copy);}}
function renderVRPhantoms(dt){const visible=['playing','paused'].includes(mode);for(const p of vrPhantoms){p.root.visible=visible;if(visible)p.root.userData.pose(p,elapsed,mode==='paused'?0:dt);}}
async function loadLegendaryCat(){legendaryCatGltf=await new GLTFLoader().loadAsync('./assets/legendary-orange-cat.glb');document.body.dataset.legendaryCatModel='loaded';}
function addCat(data){const cat={...data,root:data.legendary?createLegendaryCatVisual(legendaryCatGltf):createCatVisual(data.coat)};cats.push(cat);scene.add(cat.root);poseCatVisual(cat.root,cat);return cat;}
function clearCats(){for(const cat of cats){disposeCatVisual(cat.root);netGame.tracks.delete(cat);}for(const fight of catFights)if(fight.root)disposeCatVisual(fight.root);cats.length=catFights.length=0;}
function catSound(point,fighting=false){if(!sound||distance(point,current())>18)return;if(fighting){tone(125,.12,.035,'triangle');return;}audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*.4),audio.sampleRate),samples=buffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*(1-i/samples.length);const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();source.buffer=buffer;filter.type='highpass';filter.frequency.value=1600;gain.gain.value=.045*(1-distance(point,current())/18);source.connect(filter);filter.connect(gain);gain.connect(audio.destination);source.start();source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};}
function updateCats(dt){for(const event of stepCats(cats,catFights,dt,[hunter,...allSurvivors(),...vrPhantoms],driveObstacles(),rand)){
 if(event.type==='depart'){if(event.fight.root)disposeCatVisual(event.fight.root);}
 else if(event.type==='stun'){cancelSelfHeal(event.actor);cancelMeal(event.actor);cancelCurryCraft(event.actor);event.actor.path=[];netRecord('cat-stun',{slot:event.actor.id??4});if(event.actor===current())toast('哈基米们打起来了！眩晕 3 秒');}
 else if(event.type==='scratch-swing'){catSound(event.cat);netRecord('cat-sound',{x:event.cat.x,z:event.cat.z,fighting:false});}
 else if(event.type==='scratch-hit'){if(event.actor===hunter){cancelSelfHeal(hunter);cancelMeal(hunter);cancelCurryCraft(hunter);hunter.path=[];netRecord('cat-scratch-stun',{slot:4});if(hunter===current())toast('被传说橘猫三连挠中 · 眩晕 3 秒');}else damageSurvivor(event.actor,'cat');}
 else if(event.type==='hiss'||event.type==='fight'){catSound(event.fight,event.type==='fight');netRecord('cat-sound',{x:event.fight.x,z:event.fight.z,fighting:event.type==='fight'});}
}}
function renderCats(dt){const visible=['playing','paused'].includes(mode),delta=mode==='paused'?0:dt;
 for(const cat of cats){const track=netGame.playing&&!netIsHost()?netGame.tracks.get(cat)?.pose(dt,performance.now()):null;poseCatVisual(cat.root,track?{...cat,...track,phase:cat.phase}:cat,delta);cat.root.visible=visible&&cat.phase!=='fighting';}
 for(const fight of catFights){if(!fight.root){fight.root=createCatFightVisual();scene.add(fight.root);}poseCatFightVisual(fight.root,fight,delta,camera);fight.root.visible=visible&&fight.phase!=='grooming';}
}
function syncCats(state,received){const ids=new Set((state.cats||[]).map(c=>c.id));for(let i=cats.length-1;i>=0;i--)if(!ids.has(cats[i].id)){disposeCatVisual(cats[i].root);netGame.tracks.delete(cats[i]);cats.splice(i,1);}
 for(const data of state.cats||[]){const cat=cats.find(c=>c.id===data.id)||addCat(data);Object.assign(cat,data);let track=netGame.tracks.get(cat);if(!track){track=new MotionTrack();netGame.tracks.set(cat,track);}track.push(state.elapsed,{x:cat.x,z:cat.z,angle:cat.angle,moving:cat.moving,state:cat.phase,travel:cat.travel},received);}
 const fightIds=new Set((state.catFights||[]).map(f=>f.id));for(let i=catFights.length-1;i>=0;i--)if(!fightIds.has(catFights[i].id)){if(catFights[i].root)disposeCatVisual(catFights[i].root);catFights.splice(i,1);}for(const data of state.catFights||[]){let fight=catFights.find(f=>f.id===data.id);if(!fight){fight={...data};catFights.push(fight);}Object.assign(fight,data);}
}
function summonPig(actor){const pig=createSeekerPig(actor,++pigSerial);pig.root=createPigVisual();pigs.push(pig);scene.add(pig.root);posePigVisual(pig.root,pig);return pig;}
function clearPigs(){for(const pig of pigs)disposePigVisual(pig.root);pigs.length=0;}
function pigBlast(result){if(!result)return;ringEffect(result.x,result.z,'#f4ac8f',5);playExplosionSound(result);netRecord('pig-blast',{x:result.x,z:result.z,crushed:result.crushed});for(const a of result.hits){cancelSelfHeal(a);cancelMeal(a);cancelCurryCraft(a);}feed(result.crushed?'专业养猪 · 汽车碾压自爆猪，腾空翻转！':'专业养猪 · 自爆命中 '+result.hits.map(a=>a===hunter?HUNTERS[hunter.hunterCharacter||0].name:survivorName(a)).join('、')+' · 眩晕 3 秒');}
function updatePigs(dt){for(let i=pigs.length-1;i>=0;i--){const pig=pigs[i];pigBlast(stepSeekerPig(pig,dt,[hunter,...allSurvivors()],driveObstacles(),rand));if(!pig.active){disposePigVisual(pig.root);pigs.splice(i,1);}else posePigVisual(pig.root,pig);}}
function renderPigs(dt){for(const pig of pigs){let pose=pig;if(netGame.playing&&!netIsHost()){const track=netGame.tracks.get(pig)?.pose(dt,performance.now());if(track)pose={...pig,...track};}posePigVisual(pig.root,pose);}}
function summonRedEye(actor){const point=redEyeSpawn(actor,driveObstacles());if(!point)return false;const npc=createRedEye(actor,point,++redEyeSerial);npc.root=createRedEyeVisual();scene.add(npc.root);redEyes.push(npc);poseRedEyeVisual(npc.root,npc);ringEffect(npc.x,npc.z,'#f02c52',2);feed(`${survivorName(actor)}使用蛋炒饭 · 无敌红眼女现身`);tone(190,.25,.06,'triangle');return true;}
function clearRedEyes(){for(const npc of redEyes){if(npc.holdTarget!==null)releaseShoeHold([hunter,...allSurvivors()].find(a=>redEyeActorId(a)===npc.holdTarget),npc.id);disposeRedEyeVisual(npc.root);netGame.tracks.delete(npc);}redEyes.length=0;for(const actor of [hunter,...allSurvivors()])if(actor){actor.shoeTime=0;actor.shoeNpcId=0;actor.motion?.update?.(...(actor===hunter?[false,0,0,actor]:[actor,0]));}}
function updateRedEyes(dt){for(let i=redEyes.length-1;i>=0;i--){const npc=redEyes[i];for(const event of stepRedEye(npc,dt,hunter,allSurvivors(),driveObstacles()))if(event.type==='caught'){if(event.target===hunter)clearCars();cancelSelfHeal(event.target);cancelMeal(event.target);cancelCurryCraft(event.target);netRecord('red-eye-caught',{slot:redEyeActorId(event.target),npcId:npc.id});feed(`${event.target===hunter?'追杀者':survivorName(event.target)}被红眼女抓住 · 顶住鞋底 15 秒`);if(event.target===current())toast('被红眼女抓住 · 顶住鞋底 15 秒，暂时无法行动');}if(!npc.active){disposeRedEyeVisual(npc.root);netGame.tracks.delete(npc);redEyes.splice(i,1);}}}
function renderRedEyes(dt){for(const npc of redEyes){let pose=npc;if(npc.phase==='chasing'&&netGame.playing&&!netIsHost()){const tracked=netGame.tracks.get(npc)?.pose(dt,performance.now());if(tracked)pose={...npc,...tracked};}const victim=npc.phase==='holding'?[hunter,...allSurvivors()].find(a=>redEyeActorId(a)===npc.holdTarget):null,head=victim?.motion?.headTop?.();if(head)pose={...pose,x:head.x,z:head.z};poseRedEyeVisual(npc.root,pose,head?.y??1.9,elapsed);npc.root.visible=npc.active&&['playing','paused'].includes(mode);}}
function createChest(id){
 const root=new THREE.Group();scene.add(root);const brown=mat('#57402d'),brass=mat('#d8b66b',.35,.5);
 box(0,.32,0,1,.6,.72,brown,root);for(const x of [-.36,.36])box(x,.34,0,.09,.65,.76,brass,root);
 const lid=new THREE.Group();lid.position.set(0,.65,-.36);root.add(lid);box(0,.07,.36,1.06,.16,.8,brown,lid);for(const x of [-.36,.36])box(x,.08,.36,.09,.18,.82,brass,lid);box(0,.5,.38,.16,.2,.06,brass,root);
 const egg=mesh(new THREE.SphereGeometry(.2,16,12),new THREE.MeshStandardMaterial({color:'#f4dfb1',emissive:'#e1b95c',emissiveIntensity:1}),root,0,.91,0);egg.scale.set(1,1,1);
 const chest={id,x:0,z:0,progress:0,opened:false,root,lid,egg};root.visible=false;chests.push(chest);return chest;
}
function updateChestVisual(chest){chest.root.position.set(chest.x,0,chest.z);chest.lid.rotation.x=chest.opened?-1.8:-chest.progress*.25;chest.egg.visible=!chest.opened;}
function openChest(actor,chest,dt){const opened=advanceChest(actor,chest,dt,obs);updateChestVisual(chest);if(!opened)return;const item=ITEMS[actor.item];feed(`${survivorName(actor)}打开宝箱 · 获得${item.name}`);if(actor===current()||netGame.acting)toast(`获得【${item.name}】！按 E 使用 · ${item.hint}`);tone(820,.25,.06);}
function useItem(){
 if(mode!=='playing'||role!=='survivor'||netGame.menu&&!netGame.acting)return false;
 if(netGame.playing&&!netIsHost()){netSend({type:'action',action:'item'});return false;}
 return useActorItem(current(),true);
}
function useActorItem(actor,notify=false){cancelSelfHeal(actor);
 const message=t=>{if(notify)toast(t);};
 if(actor.shoeTime>0){message('顶住鞋底中，暂时无法使用道具');return false;}
 if(actor.stun>0){message('眩晕中，暂时无法使用道具');return false;}
 if(actor.item===SELF_RESCUE){if(!consumeSelfRescue(actor)){message('yzm 只能在被囚禁时使用');return false;}rescue(actor,4.01,true);message('yzm：自救成功！');updateHUD();return true;}
 if(actor.state!=='active'){message('当前状态无法使用道具');return false;}
 if(actor.mealActive){message('正在吃火锅油条 · 保持原地');return false;}
 if(actor.item===HOT_POT){const result=consumeHotPot(actor,hunter);if(!result.ok){message(result.reason==='full-health'?'生命已满，无需吃火锅油条':result.reason==='hunter-nearby'?'追杀者正在靠近，脱离警告范围后才能吃火锅油条':'当前状态无法进食');return false;}cancelCurryCraft(actor);feed(`${survivorName(actor)}吃下火锅油条 · 瞬间回复一格生命`);ringEffect(actor.x,actor.z,'#a7dfa7',1.2);message('火锅油条：已瞬间回复一格生命');updateHUD();return true;}
 if(actor.item===FRIED_RICE){if(!summonRedEye(actor)){message('附近没有安全位置，蛋炒饭未消耗');return false;}actor.item=null;cancelCurryCraft(actor);message('蛋炒饭：红眼女开始追捕追杀者和宋玉莹');updateHUD();return true;}
 if(actor.item===WEIRD_MUSHROOM){if(!summonEcho(actor)){message('附近没有安全位置，诡异香菇未消耗');return false;}actor.item=null;message('诡异香菇：AI 替身已出现，受击一次消失！');updateHUD();return true;}
 if(actor.item===EXHAUST){actor.item=null;summonExhaust(actor,notify);updateHUD();return true;}
 if(!consumeEgg(actor)){message('没有道具 · 靠近宝箱按住 F 开启');return false;}
 feed(`${survivorName(actor)}使用不可思议的蛋 · 技能冷却与次数已重置`);message('不可思议的蛋：技能冷却与使用次数已重置！');ringEffect(actor.x,actor.z,'#ffe5a1',2);tone(950,.3,.07);updateHUD();return true;
}
function stepSelfHeal(actor,dt,options){const healed=advanceSelfHeal(actor,dt,options);if(healed){feed(`${survivorName(actor)}完成自疗 · 回复一格生命`);ringEffect(actor.x,actor.z,'#a7dfa7',1.2);tone(650,.3,.05);}return healed;}
function createExhaustVisual(){const root=new THREE.Group(),geometry=new THREE.IcosahedronGeometry(1,1),material=new THREE.MeshStandardMaterial({color:'#a1aa55',emissive:'#414c1e',emissiveIntensity:.3,transparent:true,opacity:.55,depthWrite:false});for(let i=0;i<7;i++){const cloud=mesh(geometry,material,root,Math.sin(i*2)*.65,.9+Math.cos(i)*.25,-i*.48);cloud.scale.set(1+i*.05,.7+i*.04,.8);cloud.castShadow=false;}return root;}
function exhaustVisual(gas){gas.root.position.set(gas.x,0,gas.z);gas.root.rotation.y=gas.angle;const opacity=gas.active?.55:Math.max(0,gas.fade/.65)*.55;gas.root.children[0].material.opacity=opacity;gas.root.scale.setScalar(.75+Math.min(gas.travel,4)*.12);}
function disposeExhaust(gas){scene.remove(gas.root);gas.root.children[0].geometry.dispose();gas.root.children[0].material.dispose();}
function clearExhausts(){for(const gas of gases)disposeExhaust(gas);gases.length=0;}
function summonExhaust(actor,notify=true){const gas=createExhaust(actor);gas.root=createExhaustVisual();scene.add(gas.root);gases.push(gas);exhaustVisual(gas);feed(`${survivorName(actor)}使用华莱！ · 尾气会使友方和敌方失明`);if(notify)toast('华莱！向身后释放尾气 · 命中双方失明 5 秒');tone(80,.3,.06,'triangle');}
function updateExhausts(dt){for(let i=gases.length-1;i>=0;i--){const gas=gases[i];if(gas.active){const result=stepExhaust(gas,dt,obs,[hunter,...allSurvivors()]);for(const actor of result.hits){actor.blind=BLIND_SECONDS;if(actor===hunter)hunter.memory=null;if(actor===current())toast('被华莱！尾气命中 · 失明 5 秒');}}else gas.fade-=dt;exhaustVisual(gas);if(gas.fade<=0){disposeExhaust(gas);gases.splice(i,1);}}}
function addCurryMine(mine){
 mine.netId??=++netGame.carId;const root=new THREE.Group();mine.root=root;root.position.set(mine.x,0,mine.z);scene.add(root);root.visible=false;
 const sauce=new THREE.MeshStandardMaterial({color:'#a95723',emissive:'#ff9d37',emissiveIntensity:.15});
 cyl(0,.055,0,.36,.1,sauce,root,.43,20);const mushroom=mat('#efd1a3');
 for(const [x,z] of [[-.16,-.09],[.13,-.12],[0,.16]]){cyl(x,.14,z,.035,.14,mushroom,root);const cap=mesh(new THREE.SphereGeometry(.12,12,8),mushroom,root,x,.2,z);cap.scale.y=.45;}
 const rim=mesh(new THREE.TorusGeometry(.42,.025,6,24),mat('#ddc39b'),root,0,.1,0);rim.rotation.x=Math.PI/2;mines.push(mine);updateCurryMineVisibility();return mine;
}
function updateCurryMineVisibility(){const viewerSlot=role==='survivor'?playerIndex:4;for(const mine of mines)mine.root.visible=canSeeCurryMine(mine,viewerSlot);}
function disposeCurryMine(mine){scene.remove(mine.root);const geometries=new Set(),materials=new Set();mine.root.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);materials.add(o.material);}});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}
function clearCurryMines(){for(const mine of mines)disposeCurryMine(mine);mines.length=0;}
function updateCurryMines(dt){for(let i=mines.length-1;i>=0;i--){const mine=mines[i],victim=stepCurryMine(mine,dt,[hunter,...allSurvivors()],obs,rand);mine.root.children[0].material.emissiveIntensity=mine.arm>0?.15:.65;if(!victim)continue;cancelSelfHeal(victim);cancelMeal(victim);ringEffect(mine.x,mine.z,'#ffb66c',5);tone(65,.35,.09,'triangle');netRecord('curry-blast',{x:mine.x,z:mine.z});feed(victim===hunter&&victim.driving?'汽车踩中香菇咖喱 · 高空翻转，落地爆炸并眩晕 5 秒':`${victim===hunter?HUNTERS[hunter.hunterCharacter||0].name:survivorName(victim)}踩中香菇咖喱 · 炸飞并眩晕 3 秒`);disposeCurryMine(mine);mines.splice(i,1);}}
async function loadKuchi(){const gltf=await new GLTFLoader().loadAsync('./assets/kuchi.glb');kuchiRig=createKuchiRig(gltf);scene.add(kuchiRig.model);kuchiRig.model.visible=false;kuchiRig.stunEffect=createStunVisual();kuchiRig.stunEffect.name='KuchiStun';kuchiRig.stunEffect.position.y=1.05;kuchiRig.model.add(kuchiRig.stunEffect);}
function clearKuchi(){kuchi=null;mailisu.length=0;for(const root of mailisuVisuals.values())scene.remove(root);mailisuVisuals.clear();if(kuchiRig){kuchiRig.model.visible=false;kuchiRig.reset();}}
function startKuchi(random,blockers,reserved){const point=randomFloorPoints(1,blockers,random,reserved)[0];kuchi=createKuchi(point,random);if(kuchiRig){kuchiRig.reset();kuchiRig.model.visible=true;kuchiRig.model.position.set(point.x,0,point.z);}}
function updateKuchi(dt,previous){if(!kuchi)return;for(const trap of stepKuchi(kuchi,dt,driveObstacles(),rand))mailisu.push({...trap,netId:++mailisuId});for(const victim of stepMailisu(mailisu,[...allSurvivors(),...pigs.filter(p=>p.phase==='hunting')],obs,previous)){netRecord('mailisu-hit',{slot:victim.id});if(victim===current())toast('踩中麦丽素 · 移速降低 50%，持续 5 秒');}}
function renderKuchi(dt){if(!kuchiRig)return;kuchiRig.model.visible=!!kuchi&&['playing','paused'].includes(mode);if(!kuchi)return;let pose=kuchi;if(netGame.playing&&!netIsHost())pose=netGame.tracks.get(kuchi)?.pose(dt,performance.now())||kuchi;kuchiRig.model.position.set(pose.x,0,pose.z);kuchiRig.model.rotation.y=pose.angle;kuchiRig.update(pose,mode==='paused'?0:dt);kuchiRig.stunEffect.visible=pose.phase==='stunned';if(mode!=='paused')kuchiRig.stunEffect.rotation.y+=dt*3;}
const mailisuBall=new THREE.SphereGeometry(.095,8,6),mailisuChocolate=mat('#743c20'),mailisuMark=new THREE.MeshBasicMaterial({color:'#e1ad54',transparent:true,opacity:.65,side:THREE.DoubleSide}),mailisuCircle=new THREE.RingGeometry(.31,.35,24);
function renderMailisu(){
 const visible=canSeeMailisu(role==='hunter'?4:playerIndex)&&['playing','paused'].includes(mode),ids=new Set();
 if(visible)for(const trap of mailisu){trap.netId??=++mailisuId;ids.add(trap.netId);let root=mailisuVisuals.get(trap.netId);if(!root){root=new THREE.Group();for(let i=0;i<5;i++)mesh(mailisuBall,mailisuChocolate,root,Math.sin(i*2.4)*.12,.09,Math.cos(i*2.4)*.12);const circle=mesh(mailisuCircle,mailisuMark,root,0,.025,0);circle.rotation.x=-Math.PI/2;circle.castShadow=false;scene.add(root);mailisuVisuals.set(trap.netId,root);}root.position.set(trap.x,0,trap.z);}
 for(const [id,root] of mailisuVisuals)if(!ids.has(id)){scene.remove(root);mailisuVisuals.delete(id);}
}
function performKuchiKick(actor){if(!kickKuchi(actor,kuchi,obs))return false;cancelSelfHeal(actor);cancelMeal(actor);cancelCurryCraft(actor);feed(`${survivorName(actor)}踢腿打断库奇 · 库奇眩晕 10 秒`);netRecord('kuchi-kick',{slot:actor.id});tone(95,.14,.07,'triangle');return true;}
function handleKuchiKickInput(actor){if(fPress<=(actor.kickAck||0))return false;actor.kickAck=fPress;return role==='survivor'&&performKuchiKick(actor);}
function updateBlindOverlay(){const p=hunter&&current(),active=!!p&&['playing','paused'].includes(mode)&&!['escaped','eliminated'].includes(p.state)&&p.blind>0;show('blind-overlay',active);if(active)$('blind-seconds').textContent=`${p.blind.toFixed(1)} 秒`;$('blind-overlay').setAttribute('aria-hidden',String(!active));}
function createGenerator(x,z,id){const root=new THREE.Group();root.position.set(x,0,z);scene.add(root);box(0,.35,0,1.3,.7,1,iron,root);box(0,.95,0,1.05,.7,.85,darkStone,root);const crystal=mesh(new THREE.OctahedronGeometry(.44),glow.clone(),root,0,1.6,0);for(const sx of [-.5,.5])cyl(sx,.9,0,.065,1.8,gold,root);const ring=mesh(new THREE.TorusGeometry(.57,.05,6,24),gold,root,0,1.6,0);ring.rotation.x=Math.PI/2;gens.push({id,x,z,progress:0,root,crystal,ring});}
function createGate(x,z,name){const root=new THREE.Group();root.position.set(x,0,z);root.rotation.y=Math.PI/2;scene.add(root);for(const dx of [-2.4,2.4]){box(dx,2.2,0,.8,4.4,.8,stone,root);cyl(dx,4.8,0,.7,1,gold,root,0,4);}box(0,4.2,0,5.6,.35,.85,stone,root);const bars=new THREE.Group();root.add(bars);for(let i=-2;i<=2;i+=.4)cyl(i,2,0,.04,4,iron,bars,.035,5);box(0,1,0,4.5,.05,.08,gold,bars);box(0,3,0,4.5,.05,.08,gold,bars);const portal=mesh(new THREE.PlaneGeometry(4.3,4),new THREE.MeshBasicMaterial({color:'#9cf1cb',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}),root,0,2,0);gates.push({x,z,name,progress:0,root,bars,portal});lamp(x+(x<0?1:-1),z-3,3);}
function createCage(x,z){const root=new THREE.Group();root.position.set(x,0,z);scene.add(root);cyl(0,.1,0,1,.2,darkStone,root,1,12);for(let i=0;i<8;i++){const a=i*Math.PI/4;cyl(Math.sin(a)*.9,1.3,Math.cos(a)*.9,.038,2.6,iron,root);}const top=cyl(0,2.7,0,1.04,.25,gold,root,.4,8);cages.push({x,z,root,top});}
function makeSurvivor(index,roster=true){const group=new THREE.Group();scene.add(group);const coat=mat('#a47878'),boots=mat('#273836'),skin=mat('#ded3ba');box(0,1.05,0,.58,.75,.36,coat,group);const body=mesh(new THREE.ConeGeometry(.44,.62,6),coat,group,0,.78,0);body.rotation.y=Math.PI/6;mesh(new THREE.SphereGeometry(.23,12,10),skin,group,0,1.67,0);const cap=mesh(new THREE.SphereGeometry(.25,10,8,0,Math.PI*2,0,Math.PI/2),mat('#394948'),group,0,1.7,0);box(0,1.75,.14,.6,.06,.3,boots,group);for(const x of [-.085,.085])box(x,1.7,.212,.048,.055,.025,boots,group);const limbs=[];for(const s of [-1,1]){const arm=new THREE.Group();arm.position.set(s*.38,1.32,0);group.add(arm);box(0,-.28,0,.15,.58,.2,coat,arm);mesh(new THREE.SphereGeometry(.095,8,6),skin,arm,0,-.6,0);const leg=new THREE.Group();leg.position.set(s*.16,.64,0);group.add(leg);box(0,-.3,0,.19,.6,.2,boots,leg);box(0,-.59,.06,.21,.1,.35,boots,leg);limbs.push(arm,leg);}const glowRing=mesh(new THREE.RingGeometry(.51,.55,32),new THREE.MeshBasicMaterial({color:'#91d0be',transparent:true,opacity:.6,side:THREE.DoubleSide}),group,0,.015,0);glowRing.rotation.x=-Math.PI/2;const a={id:index,x:0,z:0,angle:0,group,body,limbs,ring:glowRing,state:'active',hp:2,stamina:100,invincible:0,captures:0,prison:0,rescue:0,cooldown:0,dash:0,slow:0,reveal:0,path:[],repath:0,walk:0,moving:false};if(roster)survivors.push(a);return a;}
const characterGltfs=new Map(),characterPreviews=new Map();
function createEchoActor(data){
 const actor=makeSurvivor(data.id,false);Object.assign(actor,data);
 if(characterGltfs.has(actor.characterId)){
  const geometries=new Set(),materials=new Set();
  for(const child of [...actor.group.children])if(child!==actor.ring){child.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});actor.group.remove(child);}
  for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
  actor.looks=new Map();setActorCharacter(actor,actor.characterId);actor.stunEffect=createStunVisual();actor.group.add(actor.stunEffect);
 }
 actor.ring.material.color.set('#d3a0ee');
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=48;const ctx=canvas.getContext('2d');ctx.fillStyle='#14212dcc';ctx.fillRect(0,0,256,48);ctx.fillStyle='#f5d7ff';ctx.font='24px Microsoft YaHei';ctx.textAlign='center';ctx.fillText('诡异香菇 · AI 替身',128,33);
 const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false}));label.position.y=2.25;label.scale.set(1.65,.28,1);actor.group.add(label);actor.echoLabel=label;
 actor.group.position.set(actor.x,0,actor.z);echoes.push(actor);return actor;
}
function removeEcho(actor){
 const index=echoes.indexOf(actor);if(index<0)return;echoes.splice(index,1);actor.state='eliminated';actor.group.visible=false;scene.remove(actor.group);netGame.tracks.delete(actor);jumpSoundsSeen.delete(actor);
 const voice=eatingVoices.get(actor);if(voice){for(const source of voice.sources){try{source.stop();}catch{}}eatingVoices.delete(actor);}
 const sharedGeometry=new Set();actor.model?.traverse(o=>{if(o.isMesh)sharedGeometry.add(o.geometry);});
 const geometries=new Set(),materials=new Set();actor.group.traverse(o=>{if(o.isMesh||o.isSprite){if(o.isMesh&&o.geometry&&!sharedGeometry.has(o.geometry))geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
 actor.echoLabel?.material.map.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
}
function clearEchoes(){for(const e of [...echoes])removeEcho(e);}
function summonEcho(owner){
 const blockers=[...obs,...gens.map(g=>({...g,w:1.5,d:1.2})),...cages.map(c=>({...c,w:2,d:2})),...chests.map(c=>({...c,w:1.1,d:.8}))];
 const point=echoSpawnPoint(owner,blockers,[hunter,...allSurvivors()],mines);if(!point)return false;
 const echo=createEchoActor(createEchoState(owner,point,++echoSerial));ringEffect(echo.x,echo.z,'#d5a6ef',3);tone(740,.35,.07);feed(`${survivorName(owner)}使用传奇诡异香菇 · AI 替身出现`);return echo;
}
function survivorName(actor){return SURVIVOR_NAMES[characterIdOf(actor)]+(actor.isEcho?'的替身':'');}
function setActorCharacter(actor,id){
 actor.characterId=id;if(!actor.looks)return;
 let look=actor.looks.get(id);
 if(!look){const source=characterGltfs.get(id);if(!source)throw Error('角色模型未载入');const motion=createSurvivorRig({scene:cloneModel(source.scene),animations:source.animations});look={model:motion.model,motion,limbs:[],food:createFoodVisual()};actor.looks.set(id,look);}
 if(actor.model)actor.group.remove(actor.model);if(actor.food)actor.group.remove(actor.food);
 actor.model=look.model;actor.motion=look.motion;actor.limbs=look.limbs;actor.food=look.food;actor.group.add(look.model);if(look.food)actor.group.add(look.food);actor.motion?.reset();
}
function configureMatchCharacters(){
 setHunterCharacter(netGame.room?.players.find(p=>p.slot===4)?.hunterCharacter??Number($('hunter-choice').value));
 const choices=new Map();
 if(netGame.room){for(const peer of netGame.room.players)if(peer.slot!==4)choices.set(peer.slot,peer.character??peer.slot);}
 else if(role==='survivor')choices.set(playerIndex,Math.max(0,Math.min(SURVIVOR_NAMES.length-1,Number($('survivor-choice').value)||0)));
 const used=new Set(choices.values());
 for(let slot=0;slot<4;slot++){let id=choices.get(slot);if(id===undefined){id=!used.has(slot)?slot:SURVIVOR_ASSET_IDS.find(c=>!used.has(c));used.add(id);}setActorCharacter(survivors[slot],id);}
}

async function loadSurvivorModels(){
 const assets=await Promise.all(SURVIVOR_ASSETS.map(url=>new GLTFLoader().loadAsync(url)));
 assets.forEach((gltf,index)=>characterGltfs.set(SURVIVOR_ASSET_IDS[index],gltf));
 for(const actor of survivors){const model=new THREE.Group();for(const child of [...actor.group.children])if(child!==actor.ring){actor.group.remove(child);model.add(child);}actor.looks=new Map();actor.model=model;actor.group.add(model);const stunEffect=createStunVisual();actor.stunEffect=stunEffect;actor.group.add(stunEffect);}
 for(const [id,gltf] of characterGltfs){const motion=createSurvivorRig({scene:cloneModel(gltf.scene),animations:gltf.animations});characterPreviews.set(id,{model:motion.model,motion});}
 survivors.forEach((actor,index)=>setActorCharacter(actor,index));document.body.dataset.survivorModels=String(assets.length);
}
function setHunterCharacter(id){id=id===1?1:0;const look=hunterLooks.get(id);if(!look)throw Error('追杀者模型未载入');if(hunter.model)hunter.group.remove(hunter.model);hunter.hunterCharacter=id;hunter.model=look.model;hunter.motion=look.motion;hunter.group.add(look.model);hunter.motion.reset();}
async function makeHunter(){
 const assets=await Promise.all(['./assets/hunter-rigged.glb','./assets/hunter-ai-jiahao.glb'].map(url=>new GLTFLoader().loadAsync(url)));
 vrHunterGltf=assets[1];assets.forEach((gltf,id)=>{const motion=createHunterRig({scene:cloneModel(gltf.scene),animations:gltf.animations},{vr:id===1});motion.reset();hunterLooks.set(id,{model:motion.model,motion});});
 const group=new THREE.Group();scene.add(group);const ring=mesh(new THREE.RingGeometry(.68,.74,40),new THREE.MeshBasicMaterial({color:'#df8469',transparent:true,opacity:.55,side:THREE.DoubleSide}),group,0,.015,0);ring.rotation.x=-Math.PI/2;
 const light=new THREE.PointLight('#ffdba5',1.3,5);light.position.set(0,2.4,1.4);group.add(light);const stunEffect=createStunVisual();group.add(stunEffect);
 hunter={hunterCharacter:0,stunEffect,stun:0,x:9,z:12,angle:0,group,ring,attack:0,swing:0,hitDelay:0,strikeAngle:0,cooldown:0,pulse:0,path:[],repath:0,walk:0,moving:false,state:'active',vrTime:0,vrElapsed:0,laserCooldown:0,neckStacks:0,laserTime:0};setHunterCharacter(0);group.position.set(9,0,12);laserVisual=createLaserVisual();scene.add(laserVisual);document.body.dataset.hunterModels='2';
}
function updateLobbyCharacter(){
 const index=Math.max(0,Math.min(SURVIVOR_NAMES.length-1,parseInt($('survivor-choice').value,10)||0)),actor=role==='hunter'?hunter:characterPreviews.get(index)||survivors[Math.min(index,3)];if(!actor)return;
 const hunterIndex=Number($('hunter-choice').value)||0;if(role==='hunter'&&hunter.hunterCharacter!==hunterIndex)setHunterCharacter(hunterIndex);const name=role==='hunter'?HUNTERS[hunterIndex].name:SURVIVOR_NAMES[index],definition=role==='hunter'?(hunterIndex===1?{...HUNTERS[1],name:HUNTERS[1].skill}:{name:'合肥车技',description:'被动【库奇】：开局随机出现一只库奇，以 20 米/秒游荡；游荡 5 秒后蹲下制作 3 秒，留下仅追杀者可见的麦丽素。求生者可靠近按 F 踢腿打断制作，使库奇眩晕 10 秒，求生者踩中后减速 50% 持续 5 秒。亲自驾驶汽车冲撞求生者，基础车速 10 米/秒，撞墙反弹后 +5 米/秒（不叠加），持续 5 秒，A / D 转向，无法刹车，撞墙自动反弹。冷却 10 秒；驾驶时踩中香菇咖喱会高高炸飞、空中翻转，落地爆炸并眩晕 5 秒。',cooldown:DRIVE_COOLDOWN}):SURVIVOR_SKILLS[index];
 $('selection-title').textContent=name;$('selection-skill').textContent=definition.name;$('selection-description').textContent=definition.description;$('selection-cooldown').textContent=definition.craftSeconds?'Q · 原地长按制作 10 秒 · 再按埋置':definition.oncePerMatch?'Q · 每局 1 次 · 持续 3 秒':`Q · 冷却 ${definition.cooldown} 秒`;
 $('selection-portrait').alt=name+'立绘';if(!new URLSearchParams(location.search).has('export-portraits'))$('selection-portrait').src=role==='hunter'?HUNTERS[hunterIndex].portrait:`./assets/portraits/${['baige','2980','zhulian','songyuying','longleg','obiwan'][index]}.png`;
 characterPreview?.setModel(actor.model||actor.group,actor.motion?.actions.Idle.getClip(),role==='hunter'&&hunterIndex===0&&kuchiRig?{model:kuchiRig.model,clip:kuchiRig.actions.Idle.getClip()}:null);$('model-view').setAttribute('aria-label',role==='hunter'?'追杀者与库奇 3D 模型，拖动旋转查看':'角色 3D 模型，拖动旋转查看');
 selectionLobby?.update({role,index,hunterIndex,room:netGame.room,id:netGame.id,ready:!!characterPreview});
}
export function renderCharacterPortrait(index){role=index===6?'hunter':'survivor';if(index===6)$('hunter-choice').value='1';else $('survivor-choice').value=String(index);updateLobbyCharacter();return characterPreview.portrait();}
function createFoodVisual(){const root=new THREE.Group();root.position.set(0,1.22,.4);root.visible=false;box(0,0,0,.3,.03,.23,mat('#4c2e20'),root);box(0,.025,0,.25,.018,.18,mat('#d59b51'),root);for(let i=0;i<4;i++)box((i-1.5)*.055,.04,0,.015,.012,.15,mat(i%2?'#bc6f3a':'#e2bd69'),root);return root;}
function createStunVisual(){const root=new THREE.Group();root.position.y=2.65;root.visible=false;for(let i=0;i<3;i++){const star=mesh(new THREE.OctahedronGeometry(.09),new THREE.MeshBasicMaterial({color:'#f1d68d'}),root,Math.cos(i*Math.PI*2/3)*.38,0,Math.sin(i*Math.PI*2/3)*.38);star.castShadow=false;}return root;}
const stealthMaterials=new WeakMap();
function applyStealthVisual(actor){const invisible=actor.invisible>0&&actor.state==='active';actor.group.visible=!['escaped','eliminated'].includes(actor.state)&&!(invisible&&role==='hunter');
 if(actor.model)actor.model.traverse(o=>{if(!o.isMesh)return;for(const material of Array.isArray(o.material)?o.material:[o.material]){if(!stealthMaterials.has(material))stealthMaterials.set(material,{opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite});const base=stealthMaterials.get(material),opacity=invisible?.23:base.opacity,transparent=invisible||base.transparent;if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}material.opacity=opacity;material.depthWrite=invisible?false:base.depthWrite;}o.castShadow=!invisible;});
 actor.ring.material.opacity=invisible?.15:actor.reveal>0?.9:.5;if(actor.food)actor.food.visible=(actor.eating>0||actor.mealActive)&&actor.state==='active';
}
function survivorSkill(actor,notify=false){cancelSelfHeal(actor);cancelMeal(actor);const result=useSurvivorSkill(actor,hunter,{survivors:allSurvivors(),obstacles:obs,fixtures:[...gens.map(g=>({...g,w:1.5,d:1.2})),...cages.map(c=>({...c,w:2,d:2})),...chests.map(c=>({...c,w:1.1,d:.8}))],random:rand});if(!result.ok){if(notify)toast(result.reason==='no-teammates'?'没有仍在场的队友，无法使用【开！】。':result.reason==='no-safe-landing'?'队友附近没有安全落点，技能未消耗。':result.reason==='already-used'?'【脖子以下全是腿】本局已经使用过了。':result.reason==='hunter-not-nearby'?'出现“追杀者正在靠近”提示时才能使用【这是男人？】。':result.reason==='cooldown'?`技能还需 ${Math.ceil(actor.cooldown)} 秒冷却`:'当前状态无法使用技能');return false;}
 if(result.type==='teleport'){showTeleport(result);netRecord('teleport',result);feed(`欧比旺使用开！ · 传送至${survivorName(allSurvivors().find(s=>s.id===result.teammateSlot))}身边${result.hunterTo?'，追杀者也来了！':''}`);if(notify)toast(result.hunterTo?'开！传送成功，但追杀者也被带到了附近！':'开！已传送到队友身边。');updateHUD();return true;}
 if(result.type==='plant-curry'){const mine=plantCurry(actor);if(mine){addCurryMine(mine);feed(`${survivorName(actor)}埋下香菇咖喱炸弹`);if(notify)toast('香菇咖喱已埋下 · 1.2 秒后生效，小心自己和队友踩中！');updateHUD();return true;}}
 if(result.type==='craft-curry'){if(notify)toast('原地长按 Q 10 秒制作香菇咖喱 · 松开、移动或受击会中断');return true;}
 const definition=SURVIVOR_SKILLS[characterIdOf(actor)];feed(`${survivorName(actor)} · ${definition.name}`);
 if(result.type==='invisible'){tone(440,.15,.04);applyStealthVisual(actor);if(notify)toast('突然哑巴：隐身 5 秒，追杀者无法看见你。');}
 else if(result.type==='immune'){ringEffect(hunter.x,hunter.z,'#e65bd1',2);if(notify)toast('追杀者正在豪情在天 · 免疫眩晕');}
 else if(result.type==='stun'){ringEffect(hunter.x,hunter.z,'#e6cd80',2);tone(900,.25,.08);if(notify)toast('这是男人？：追杀者眩晕 3 秒！');}
 else if(result.type==='seeker-pig'){summonPig(actor);if(notify)toast('专业养猪：已向前扔出自爆猪，会追踪最近的其他角色！');}
 else if(result.type==='leg-rush'){ringEffect(actor.x,actor.z,'#f2d286',3);tone(760,.3,.07);if(notify)toast('脖子以下全是腿：移速增加 300%，持续 3 秒！冷却 30 秒，可重复释放。');}
 updateHUD();return true;
}
function showTeleport(result){
 for(const point of [result.from,result.to,result.hunterFrom,result.hunterTo])if(point)ringEffect(point.x,point.z,'#a5c5ff',3);
 tone(580,.3,.07,'triangle');const viewerSlot=netGame.room?netGame.room.players.find(p=>p.id===netGame.id)?.slot:role==='hunter'?4:playerIndex;
 if(viewerSlot===result.slot||viewerSlot===4&&result.hunterTo)teleportCameraPending=true;
}
function current(){return role==='hunter'?hunter:survivors[playerIndex];}
function toast(message){if(netGame.acting){netSend({type:'feedback',id:netGame.acting,message});return;}$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3000);}
function feed(message){netRecord('feed',{message});const e=document.createElement('div');e.className='feed-entry';e.textContent=message;$('feed').prepend(e);while($('feed').children.length>4)$('feed').lastChild.remove();setTimeout(()=>e.remove(),7000);}
function tone(freq=300,duration=.12,volume=.1,type='sine'){if(!sound)return;audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}
function ringEffect(x,z,color,radius=4){const mesh3=mesh(new THREE.RingGeometry(.9,1,48),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.75,side:THREE.DoubleSide,depthWrite:false}),scene,x,.045,z);mesh3.rotation.x=-Math.PI/2;effects.push({mesh:mesh3,t:0,radius});}
function start(spawnSeed){testFreezeAI=false;clearCats();clearVRPhantoms();drag=null;if(!netGame.room){$('again').textContent='再入夜雾';$('back').textContent='返回大厅';$('pause').innerHTML='暂停 <kbd>Esc</kbd>';document.querySelector('#pause-modal h2').textContent='黑夜暂歇';document.querySelector('#pause-modal p').textContent='对局已暂停，深呼吸，再继续。';}if(typeof window!=='undefined'){unlockHurtAudio();unlockEatingAudio();unlockJumpAudio();unlockExplosionAudio();}clearRedEyes();clearPigs();cameraOcclusion?.reset();clearEchoes();clearCars();clearExhausts();clearCurryMines();clearKuchi();jumpSoundsSeen.clear();jumpPress=0;fPress=0;difficulty=$('difficulty').value;remaining=DURATION;elapsed=0;playerIndex=role==='survivor'?Math.max(0,Math.min(3,parseInt($('survivor-choice').value,10)||0)):0;if(netGame.room){const own=netGame.room.players.find(p=>p.id===netGame.id);playerIndex=own?.slot===4?0:own?.slot??playerIndex;}configureMatchCharacters();teleportCameraPending=false;camYaw=0;camPitch=.31;camDistance=7.4;mode='playing';$('feed').replaceChildren();for(const k of Object.keys(keys))delete keys[k];touchMove={x:0,z:0};
 const spawnRandom=Number.isInteger(spawnSeed)?seededRandom(spawnSeed):Math.random;const spawnBlockers=[...obs,...gens.map(g=>({...g,w:1.5,d:1.2})),...cages.map(c=>({...c,w:2,d:2})),...gates.map(g=>({...g,w:1.8,d:4}))];const points=randomMatchSpawns(spawnBlockers,spawnRandom,CHEST_POSITIONS);initialSpawns=points.map(p=>({x:p.x,z:p.z}));const spawns=points.slice(0,4);while(chests.length<CHEST_COUNT)createChest(chests.length);chests.forEach((c,i)=>{Object.assign(c,{...CHEST_POSITIONS[i],opened:false,progress:0,loot:rollChestLoot(spawnRandom)});c.root.visible=true;updateChestVisual(c);});survivors.forEach((s,i)=>{Object.assign(s,{x:spawns[i].x,z:spawns[i].z,angle:spawnRandom()*Math.PI*2,item:null,healTime:0,kickTime:0,kickAck:0,jumpTime:0,jumpCooldown:0,jumpSerial:0,jumpAck:0,kuchiSlow:0,inputAck:0,inputClock:0,inputLead:0,shoeTime:0,shoeNpcId:0,shoeX:0,shoeZ:0,shoeAngle:0,mealActive:false,mealTime:0,lootTarget:null,curryCraftWait:0,curryHold:0,curryRetreat:null,blind:0,stun:0,launchTime:0,launchVX:0,launchVZ:0,craftTime:0,craftBlocked:false,curryReady:false,state:'active',hp:2,stamina:100,invincible:0,captures:0,prison:0,rescue:0,cooldown:0,dash:0,invisible:0,eating:0,legRush:0,skillUsed:false,slow:0,reveal:0,path:[],repath:0,walk:0,moving:false,fleeTime:0,fleeTarget:null,destination:null});s.motion?.reset();s.interacting=false;s.running=false;applyStealthVisual(s);s.group.visible=true;s.ring.material.color.set(i===playerIndex&&role==='survivor'?'#d5b77c':'#91d0be');});
 hunter.motion?.reset();Object.assign(hunter,{...points[4],vrTime:0,vrElapsed:0,vrSerial:0,laserTime:0,laserSerial:0,laserCooldown:0,neckStacks:0,elbowDuration:.8,elbowImpact:.3,jumpTime:0,jumpCooldown:0,jumpSerial:0,jumpAck:0,inputAck:0,inputClock:0,inputLead:0,shoeTime:0,shoeNpcId:0,shoeX:0,shoeZ:0,shoeAngle:0,blind:0,launchTime:0,launchVX:0,launchVZ:0,angle:spawnRandom()*Math.PI*2,attack:0,swing:0,hitDelay:0,strikeAngle:Math.PI,stun:0,cooldown:0,pulse:0,path:[],repath:0,walk:0,memory:null,patrol:null,destination:null});gens.forEach(g=>{g.progress=0;g.crystal.material.emissive.set('#86d8bc');});gates.forEach(g=>{g.progress=0;g.bars.position.y=0;g.portal.material.opacity=0;});
 if(!isVRHunter(hunter))startKuchi(spawnRandom,spawnBlockers,[...points,...CHEST_POSITIONS]);
 for(const cat of spawnMatchCats(driveObstacles(),spawnRandom))addCat(cat);
 for(const id of ['lobby','scene-note','lobby-footer','character-showcase','result-modal','pause-modal','help-modal'])show(id,false);show('hud');show('net-status',!!netGame.playing);document.body.classList.add('playing');$('gen-icons').innerHTML='<i class="gen-icon"></i>'.repeat(REQUIRED);$('skill-name').textContent=role==='hunter'?(isVRHunter(hunter)?hunter.vrTime>0?'镭射眼':'AI嘉豪来袭':'合肥车技'):SURVIVOR_SKILLS[characterIdOf(current())].name;$('player-icon').textContent=role==='hunter'?'♜':'◇';$('mobile-attack').style.display=role==='hunter'?'block':'none';document.querySelector('.control-guide').innerHTML=role==='hunter'?'<span><kbd>W A S D</kbd> 移动</span><span><kbd>鼠标左键</kbd> 横向肘击</span><span><kbd>Q</kbd> '+(isVRHunter(hunter)?'AI嘉豪来袭 / 镭射眼':'合肥车技')+'</span><span><kbd>空格</kbd> 跳跃</span><span>移动鼠标 / <kbd>← →</kbd> 视角</span>':'<span><kbd>W A S D</kbd> 移动</span><span><kbd>F</kbd> 交互 / 宝箱</span><span><kbd>E</kbd> 道具</span><span><kbd>空格</kbd> 跳跃</span><span>移动鼠标 / <kbd>← →</kbd> 视角</span>';toast(role==='hunter'?(isVRHunter(hunter)?'左键肘击；Q 戴上 VR，15 秒内再次按 Q 发射镭射眼，冷却 5 秒。':'阻止逃生者！左键横向肘击，Q 上车，A / D 转向，5 秒内无法刹车。'):'寻找金色装置，靠近后按住 F 修复。');camera.position.set(current().x,6,current().z+9);updateHUD();syncMouse();}
function setRole(r){role=r;show('character-options',r==='survivor');$('survivor-role').classList.toggle('active',r==='survivor');$('hunter-role').classList.toggle('active',r==='hunter');$('survivor-role').setAttribute('aria-pressed',String(r==='survivor'));$('hunter-role').setAttribute('aria-pressed',String(r==='hunter'));updateLobbyCharacter();}
function back(){clearCats();stopVRVisuals();clearRedEyes();clearPigs();cameraOcclusion?.reset();clearEchoes();clearKuchi();clearCurryMines();clearExhausts();show('blind-overlay',false);chests.forEach(c=>c.root.visible=false);if(netGame.playing){leaveMultiplayer();return;}clearCars();clearTimeout(toastTimer);$('toast').classList.remove('show');mode='lobby';show('net-status',false);document.body.classList.remove('playing');for(const id of ['hud','pause-modal','result-modal','help-modal'])show(id,false);for(const id of ['lobby','scene-note','lobby-footer','character-showcase'])show(id);$('vignette').classList.remove('danger');survivors.forEach(s=>{s.invisible=0;s.eating=0;applyStealthVisual(s);s.group.visible=false;s.motion?.reset();});hunter.motion?.reset();Object.assign(hunter,{x:9,z:12,angle:0,swing:0,hitDelay:0,moving:false});hunter.group.position.set(9,0,12);hunter.group.rotation.y=0;hunter.stun=0;if(hunter.stunEffect)hunter.stunEffect.visible=false;updateLobbyCharacter();syncMouse();}
function pause(){drag=null;if(netGame.playing){netGame.menu=!netGame.menu;for(const k of Object.keys(keys))keys[k]=false;touchMove={x:0,z:0};show('pause-modal',netGame.menu);syncMouse();document.querySelector('#pause-modal h2').textContent='联机菜单';document.querySelector('#pause-modal p').textContent='联机对局继续进行，其他玩家不受菜单影响。';return;}if(mode==='playing'){mode='paused';for(const k of Object.keys(keys))keys[k]=false;touchMove={x:0,z:0};show('pause-modal');}else if(mode==='paused'){mode='playing';show('pause-modal',false);}syncMouse();}
function restoreDriverModel(){if(!hunter?.model)return;hunter.model.position.set(0,0,0);if(hunter.model.userData.driveScale)hunter.model.scale.copy(hunter.model.userData.driveScale);if(hunter.ring)hunter.ring.visible=true;hunter.group.rotation.x=0;hunter.group.rotation.z=0;}
function clearCars(){for(const car of cars)disposeCarVisual(car.root);cars.length=0;if(hunter){resetDrive(hunter);restoreDriverModel();}}
function driveObstacles(){return [...obs,...gens.map(g=>({x:g.x,z:g.z,w:1.3,d:1.0})),...cages.map(c=>({x:c.x,z:c.z,w:1.8,d:1.8}))];}
function summonCar(actor){
 if(actor.driving||actor.cooldown>0||actor.stun>0)return false;const blockers=driveObstacles();
 if(carBlocked(actor,blockers)){toast('前方空间不足 · 请到开阔处发动汽车');return false;}
 if(!beginDrive(actor))return false;
 const car={driven:true,driverSlot:4,x:actor.x,z:actor.z,angle:actor.angle,phase:'driving',travel:0,active:true,fade:.35,hitIds:new Set(),blockers,root:createCarVisual()};cars.push(car);scene.add(car.root);
 tone(110,1.2,.13,'triangle');ringEffect(car.x,car.z,'#e6b67b',2);netRecord('drive-start',{angle:actor.angle});
 if(role==='hunter'&&!netGame.acting){camYaw=actor.angle-Math.PI;toast('【合肥车技】已上车 · A / D 转向，无法刹车，持续 5 秒');}
 feed('合肥车技 · 追杀者亲自驾驶！');return true;
}
function carExplosion(x,z){ringEffect(x,z,'#ff9b44',7);const fire=mesh(new THREE.SphereGeometry(.9,16,12),new THREE.MeshBasicMaterial({color:'#ffb35a',transparent:true,opacity:.8,depthWrite:false}),scene,x,1,z);effects.push({mesh:fire,t:0,radius:5});tone(55,.65,.18,'sawtooth');}
function updateCars(dt){
 for(let i=cars.length-1;i>=0;i--){const car=cars[i];
  if(car.active){const result=stepDrivenCar(hunter,hunter.driveSteer||0,dt,car.blockers,allSurvivors(),car.hitIds,pigs,catCarTargets(cats,catFights));const defended=repelCarCats(result.legendaryHits,cats,catFights,car.blockers,rand);for(const fight of defended.departed)if(fight.root)disposeCatVisual(fight.root);if(defended.cats.length){feed('传说橘猫顶飞了汽车！空中翻转，落地爆炸并眩晕 5 秒');tone(140,.2,.08,'triangle');}const flat=flattenCats(result.catHits,cats,catFights,car.blockers,rand);for(const fight of flat.departed)if(fight.root)disposeCatVisual(fight.root);if(flat.cats.length){feed(`合肥车技 · ${flat.cats.length} 只哈基米被压成平面，10 秒后恢复`);tone(100,.12,.06,'triangle');}for(const pig of result.crushed||[])pigBlast(explodeSeekerPig(pig,[hunter,...allSurvivors()],car.blockers,rand,hunter));for(const s of result.hits)damageSurvivor(s,'car');Object.assign(car,{x:hunter.x,z:hunter.z,angle:hunter.angle,phase:hunter.drivePhase,travel:hunter.driveTravel,timeLeft:hunter.driveTime,airTime:hunter.driveAirTime});
   if(result.bounces&&!(car.bounceSound>0)){ringEffect(car.x,car.z,'#e6b67b',1.5);tone(80,.12,.06);car.bounceSound=.12;}car.bounceSound=Math.max(0,(car.bounceSound||0)-dt);
   if(result.landed){car.active=false;carExplosion(car.x,car.z);netRecord('car-explosion',{x:car.x,z:car.z,stun:CAR_CRASH_STUN});feed('汽车落地爆炸 · 追杀者眩晕 5 秒');}
   else if(result.ended){car.active=false;feed('合肥车技结束 · 已下车');}
  }else{car.fade-=dt;car.root.position.set(car.x,0,car.z);car.root.rotation.set(0,car.angle,0);car.root.scale.setScalar(Math.max(.02,car.fade/.35));if(car.fade<=0){disposeCarVisual(car.root);cars.splice(i,1);}}
 }
}
function applyDriverPose(a,pose=a){
 if(a!==hunter)return;const driving=!!a.driving;if(a.model){if(!a.model.userData.driveScale)a.model.userData.driveScale=a.model.scale.clone();if(driving){a.model.scale.copy(a.model.userData.driveScale).multiplyScalar(.78);a.model.position.set(.35,-.45,-.2);}else{a.model.scale.copy(a.model.userData.driveScale);a.model.position.set(0,0,0);}}
 if(a.ring)a.ring.visible=!driving;
 a.group.position.y+=driveHeight(pose);const spin=driveSpin(pose);a.group.rotation.x=spin*.5;a.group.rotation.z=spin;a.group.rotation.y=pose.angle+spin;
}
function renderCarVisuals(dt){for(const car of cars){if(!car.driven||!car.active)continue;car.root.position.copy(hunter.group.position);car.root.rotation.copy(hunter.group.rotation);car.root.scale.setScalar(1);if(car.root.userData.trail)car.root.userData.trail.visible=hunter.drivePhase==='driving';if(hunter.drivePhase==='driving')for(const wheel of car.root.userData.wheels)wheel.rotateY(driveSpeed(hunter)*dt/.36);}}

function vrSkill(angle=camYaw+Math.PI){if(hunter.vrTime>0){const shot=laserCast(hunter,angle,allSurvivors(),obs);if(!shot){if(role==='hunter')toast(`镭射眼还需 ${Math.ceil(hunter.laserCooldown)} 秒冷却`);return false;}Object.assign(hunter,{laserTime:.35,laserX:shot.x,laserZ:shot.z,laserAngle:shot.angle,laserRange:shot.range});for(const target of shot.hits)damageSurvivor(target,'laser');tone(1100,.18,.07,'sawtooth');return true;}if(!beginVR(hunter)){if(role==='hunter')toast(hunter.cooldown>0?`AI嘉豪来袭还需 ${Math.ceil(hunter.cooldown)} 秒冷却`:'当前状态无法佩戴 VR');return false;}spawnDancePhantoms();feed('AI嘉豪来袭 · 豪情在天！颈椎病暂不生效，3 个跳舞幻影现身，持续 15 秒');return true;}
function skill(){if(mode!=='playing'||netGame.menu&&!netGame.acting)return;if(netGame.playing&&!netIsHost()){netSend({type:'action',action:'skill'});return;}const actor=current();if(actor.shoeTime>0){toast('顶住鞋底中，暂时无法使用技能');return;}if(actor.state!=='active')return;if(role==='survivor'){survivorSkill(actor,true);return;}if(isVRHunter(hunter)){vrSkill();return;}if(hunter.jumpTime>0){toast('落地后才能发动合肥车技');return;}if(hunter.driving){toast('驾驶中无法停止 · 5 秒结束后自动下车');return;}if(hunter.stun>0){toast('眩晕中，暂时无法使用技能');return;}if(actor.cooldown>0){toast(`技能还需 ${Math.ceil(actor.cooldown)} 秒冷却`);return;}summonCar(actor);}

function attack(fromAI=false){if(netGame.playing&&!netIsHost()){if(role==='hunter'&&!netGame.menu)netSend({type:'action',action:'attack'});return;}if(netGame.menu&&!netGame.acting&&fromAI!==true)return;if(mode!=='playing'||hunter.shoeTime>0||hunter.attack>0||hunter.stun>0||hunter.driving)return;const timing=elbowTiming(hunter,role==='hunter'?1.65:2.25);hunter.attack=timing.cooldown;hunter.swing=timing.duration;hunter.hitDelay=timing.impact;hunter.elbowDuration=timing.duration;hunter.elbowImpact=timing.impact;hunter.strikeAngle=hunter.angle;hunter.group.rotation.y=hunter.angle;hunter.motion?.strike();tone(150,.15,.08,'sawtooth');}
function damageSurvivor(s,source='elbow'){
 if(s.state!=='active'||s.invincible>0)return false;
 if(s.isEcho){playHurtSound(s);netRecord('echo-pop',{x:s.x,z:s.z});ringEffect(s.x,s.z,'#eac273',2);feed(`${survivorName(s)}被击中 · 替身消失`);removeEcho(s);return true;}
 cancelSelfHeal(s);cancelMeal(s);cancelCurryCraft(s);s.hp--;netRecord('hurt',{slot:s.id});playHurtSound(s);s.invincible=3.5;s.stamina=Math.max(s.stamina,40);s.dash=1.3;ringEffect(s.x,s.z,'#e29b86',2);tone(90,.3,.12);
 if(source==='cat')feed(`${survivorName(s)}被传说橘猫三连挠中 · 1 次伤害`);if(source==='laser')feed(`${survivorName(s)}被镭射眼击中 · 1 次伤害`);if(source==='car')feed(`${survivorName(s)}被汽车撞中 · 1 次伤害`);
 if(s.hp<=0)capture(s);else{if(source!=='car')feed(`${survivorName(s)}受伤了`);if(s===current())toast(source==='cat'?'被传说橘猫挠中了！整套三连造成一次伤害。':source==='car'?'被汽车撞中了！受伤后请尽快离开冲刺路径。':'你受伤了！快利用掩体甩开追杀者。');}return true;
}
function resolveElbowHit(){if(hunter.stun>0||hunter.shoeTime>0)return;ringEffect(hunter.x+Math.sin(hunter.angle),hunter.z+Math.cos(hunter.angle),'#df8469',1.3);const s=hit(hunter,allSurvivors(),obs);if(s)damageSurvivor(s);else if(role==='hunter')toast('横向肘击未命中 · 靠近并面向目标');}

function capture(s){if(s.isEcho){removeEcho(s);return;}cancelSelfHeal(s);cancelMeal(s);s.lootTarget=null;cancelCurryCraft(s);s.launchTime=0;s.shoeTime=0;s.shoeNpcId=0;s.stun=0;s.legRush=0;s.kickTime=0;s.kuchiSlow=0;s.jumpTime=0;s.invisible=0;s.eating=0;s.captures++;s.hp=1;s.dash=0;const available=cages.filter(c=>!survivors.some(p=>p.state==='captured'&&p.cage===c));const cage=(available.length?available:cages).slice().sort((a,b)=>distance(a,s)-distance(b,s))[0];s.state='captured';s.prison=0;s.rescue=0;s.cage=cage;s.x=cage.x;s.z=cage.z;s.path=[];feed(`一名逃生者被囚禁 · 可前往救援`);if(s===current())toast('你被囚禁了，等待队友救援。');}
function repair(g,dt,ai=false){if(g.progress>=1)return;const seconds=repairDuration(difficulty,ai);g.progress=Math.min(1,g.progress+dt/seconds);if(g.progress>=1){g.crystal.material.emissive.set('#ffc76b');feed(`共鸣装置 ${g.id+1} 已修复`);tone(600,.4,.08);ringEffect(g.x,g.z,'#d5b77c',4);if(gens.filter(p=>p.progress>=1).length===REQUIRED){feed('逃生门已通电 · 开门逃离！');toast(role==='hunter'?'逃生门已通电，立即拦截！':'逃生门已通电！前往两侧大门，按住 F 开启。');}}}
function rescue(s,dt,self=false){s.rescue=Math.min(1,s.rescue+dt/4);if(s.rescue>=1){s.state='active';s.hp=1;s.invincible=6;s.dash=2;s.x+=1.5;s.path=[];s.repath=0;feed(self?`${survivorName(s)}使用 yzm · 自救成功`:'救援成功 · 逃生者重获自由');tone(480,.3,.06);}}
function openGate(g,dt){if(g.progress>=1)return;g.progress=Math.min(1,g.progress+dt/7);if(g.progress>=1){feed(`${g.name}已打开`);tone(520,.6,.08);}}
function escape(s){if(s.isEcho){feed(`${survivorName(s)}已离开庄园`);removeEcho(s);return;}cancelSelfHeal(s);cancelMeal(s);s.state='escaped';s.group.visible=false;feed(`${survivorName(s)}成功逃脱`);if(s===current())toast('你已逃脱！按 Tab 观战仍在庄园的队友。');tone(800,.3,.07);}
function nearestInteraction(p,viewerRole=role){if(viewerRole==='hunter'||p.state!=='active')return null;if(canKickKuchi(p,kuchi,obs))return {type:'kuchi-kick',target:kuchi};const captive=survivors.find(s=>s.state==='captured'&&distance(s,p)<2.4&&lineClear(s,p,obs));if(captive)return {type:'rescue',target:captive};const chest=chests.filter(c=>!c.opened&&distance(c,p)<2.4&&lineClear(c,p,obs)).sort((a,b)=>distance(p,a)-distance(p,b))[0];if(chest&&!p.item)return {type:'chest',target:chest};const gen=gens.filter(g=>g.progress<1&&distance(g,p)<2.4&&lineClear(g,p,obs)).sort((a,b)=>distance(p,a)-distance(p,b))[0];if(gen&&gens.filter(g=>g.progress>=1).length<REQUIRED)return {type:'repair',target:gen};const g=gates.find(g=>distance(g,p)<3&&lineClear(g,p,obs));if(g)return {type:gens.filter(g=>g.progress>=1).length>=REQUIRED?'gate':'locked',target:g};return chest?{type:'chest-full',target:chest}:null;}
function playerUpdate(dt){const p=current();if(p.shoeTime>0){p.jumpAck=Math.max(p.jumpAck||0,jumpPress);p.kickAck=Math.max(p.kickAck||0,fPress);p.moving=false;p.interacting=false;p.running=false;cancelSelfHeal(p);cancelMeal(p);cancelCurryCraft(p);return;}handleKuchiKickInput(p);const jumped=consumeJumpInput(p,{jumpPress});if(jumped){cancelSelfHeal(p);cancelMeal(p);cancelCurryCraft(p);}p.moving=false;p.interacting=false;p.running=false;if(netGame.menu&&!netGame.acting){if(p.driving)p.driveSteer=0;cancelSelfHeal(p);cancelMeal(p);cancelCurryCraft(p);return;}if(role==='hunter'&&p.driving){if(keys.arrowleft)camYaw+=dt*1.7;if(keys.arrowright)camYaw-=dt*1.7;p.driveSteer=p.stun>0?0:driveSteer({keys,touch:touchMove});return;}if(p.state!=='active'||p.stun>0||p.kickTime>0){cancelSelfHeal(p);cancelMeal(p);cancelCurryCraft(p);return;}if(keys.arrowleft)camYaw+=dt*1.7;if(keys.arrowright)camYaw-=dt*1.7;
 let dx=(keys.d||keys.arrowd?1:0)-(keys.a?1:0)+touchMove.x,dz=(keys.s?1:0)-(keys.w?1:0)+touchMove.z;
 const n=Math.hypot(dx,dz);if(role==='survivor'&&characterIdOf(p)===3){const completed=advanceCurryCraft(p,!!keys.q,n<.1&&!keys.f&&!(p.jumpTime>0),dt);if(completed){feed(`${survivorName(p)}制作完成 · 获得香菇咖喱`);if(p===current()||netGame.acting)toast('香菇咖喱已做好！松开后再次按 Q 在脚下埋置');tone(880,.3,.06);}if(p.craftTime>0){interact=null;return;}}moveControlled(p,{keys,yaw:camYaw,touch:touchMove,jumpPress},dt,obs,role==='hunter');

 interact=nearestInteraction(p);if(role==='survivor')stepSelfHeal(p,dt,{held:!!keys.f,stationary:n<.1,noTarget:!interact,usingSkill:!!keys.q});if(!(p.jumpTime>0)&&keys.f&&interact&&!['locked','chest-full'].includes(interact.type)&&n<.1){p.interacting=true;if(interact.type==='kuchi-kick'){/* Fresh F press is consumed before movement; holding F cannot auto-kick. */}else if(interact.type==='chest')openChest(p,interact.target,dt);else if(interact.type==='repair')repair(interact.target,dt);else if(interact.type==='rescue')rescue(interact.target,dt);else openGate(interact.target,dt);}
 
}
function follow(a,target,speed,dt){if(a!==hunter)speed*=survivorSpeedMultiplier(a)*kuchiSpeedFactor(a);const blockers=[...obs,...mines.filter(m=>m.ownerSlot===a.id&&m.arm<=0).map(m=>({x:m.x,z:m.z,w:.9,d:.9}))];a.repath-=dt;const changed=!a.destination||distance(target,a.destination)>2.5;if(a.repath<=0||changed){a.path=findPath(a,target,blockers);a.destination={x:target.x,z:target.z};a.repath=.8+rand()*.25;}let next=a.path[0];if(!next&&lineClear(a,target,blockers))next=target;if(!next){a.moving=false;return;}if(distance(a,next)<.45){a.path.shift();next=a.path[0]||target;}const d=distance(a,next);if(d<.15){a.moving=false;return;}const dx=(next.x-a.x)/d,dz=(next.z-a.z)/d;a.angle=Math.atan2(dx,dz);a.moving=move(a,dx*speed*dt,dz*speed*dt,blockers)>.001;}
function aiExhaustSafe(s){
 const d=distance(s,hunter);if(d<1||d>7||!lineClear(s,hunter,obs))return false;
 const fx=(hunter.x-s.x)/d,fz=(hunter.z-s.z)/d;
 return !allSurvivors().some(a=>a!==s&&a.state==='active'&&(()=>{const dx=a.x-s.x,dz=a.z-s.z,along=dx*fx+dz*fz;return along>.5&&along<8&&Math.abs(dx*fz-dz*fx)<1.9;})());
}
function aiOpenChest(s,dt){
 if(s.item)return false;
 let chest=chests.find(c=>c.id===s.lootTarget&&!c.opened);
 if(!chest){chest=chests.filter(c=>!c.opened&&distance(s,c)<14&&!allSurvivors().some(a=>a!==s&&a.state==='active'&&!a.item&&a.lootTarget===c.id)).sort((a,b)=>distance(s,a)-distance(s,b))[0];}
 if(!chest){s.lootTarget=null;return false;}s.lootTarget=chest.id;
 if(distance(s,chest)<2.2&&lineClear(s,chest,obs)){s.moving=false;s.interacting=true;openChest(s,chest,dt);if(chest.opened)s.lootTarget=null;return true;}
 const d=distance(s,chest),target={x:chest.x+(s.x-chest.x)/d*1.7,z:chest.z+(s.z-chest.z)/d*1.7};
 if(blocked(target.x,target.z,obs,.6)){s.lootTarget=null;return false;}follow(s,target,3.7,dt);return true;
}
function aiCurryRetreat(s){
 const own=mines.filter(m=>m.ownerSlot===s.id),near=own.slice().sort((a,b)=>distance(a,s)-distance(b,s))[0],away=near&&distance(near,s)<3.2?near:hunter;const angle=Math.atan2(s.x-away.x,s.z-away.z);
 for(let i=0;i<16;i++){const a=angle+i*Math.PI/8,p={x:s.x+Math.sin(a)*3.5,z:s.z+Math.cos(a)*3.5};if(!blocked(p.x,p.z,obs,.7)&&lineClear(s,p,obs)&&!mines.some(m=>m.ownerSlot===s.id&&distance(m,p)<3.3)){s.curryRetreat=p;s.repath=0;return;}}
 s.curryRetreat=null;
}
function survivorAI(s,dt){if(testFreezeAI)return;
 s.interacting=false;s.running=false;s.moving=false;
 if(s.state==='captured'&&s.item===SELF_RESCUE)useActorItem(s);
 if(s.state!=='active'||s.shoeTime>0||s.blind>0||s.stun>0||s.kickTime>0){cancelSelfHeal(s);cancelMeal(s);cancelCurryCraft(s);s.lootTarget=null;return;}
 if(canKickKuchi(s,kuchi,obs)&&performKuchiKick(s))return;
 const hd=distance(s,hunter),id=characterIdOf(s),visible=lineClear(s,hunter,obs);
 s.curryCraftWait=Math.max(0,(s.curryCraftWait||0)-dt);s.curryHold=s.curryReady?(s.curryHold||0)+dt:0;
 if(s.item===FRIED_RICE&&hd<18)useActorItem(s);
 if(s.item===WEIRD_MUSHROOM)useActorItem(s);
 if(s.isEcho){s.jumpThink=Math.max(0,(s.jumpThink||0)-dt);if(hd<9&&s.jumpThink<=0){s.jumpThink=2+rand()*2;beginJump(s);}}
 if(s.item===EGG&&(s.cooldown>1||s.skillUsed||id===3))useActorItem(s);
 if(s.item===EXHAUST&&aiExhaustSafe(s)){s.angle=Math.atan2(s.x-hunter.x,s.z-hunter.z);useActorItem(s);}
 if(id===3&&s.curryReady&&!mines.some(m=>m.ownerSlot===s.id&&distance(m,s)<3.2)&&(hd<14||s.curryHold>=4)){
  if(survivorSkill(s)){s.curryCraftWait=Math.max(s.curryCraftWait,8);aiCurryRetreat(s);}
 }
 if(id===5&&s.cooldown<=0&&hd<9&&survivorSkill(s))return;
 if(s.cooldown<=0&&(id===4&&hd<9||id===2&&hd<18||id===0&&hd<9||id===1&&isHunterNearby(s,hunter)&&hunter.stun<=0)){if(id===2)s.angle=Math.atan2(hunter.x-s.x,hunter.z-s.z);survivorSkill(s);}
 if((hd<(id===3?12:9)&&visible)||s.fleeTime>0){
  cancelSelfHeal(s);cancelMeal(s);if(s.craftTime>0){cancelCurryCraft(s);s.curryCraftWait=2;}s.lootTarget=null;
  s.fleeTime=hd<9?2:Math.max(0,(s.fleeTime||0)-dt);const dir=Math.atan2(s.x-hunter.x,s.z-hunter.z);
  if(!s.fleeTarget||s.repath<=0||distance(s,s.fleeTarget)<2){const candidates=[];for(let i=0;i<9;i++){const a=dir+(i-4)*.3,t={x:clamp(s.x+Math.sin(a)*9,-LIMIT+2,LIMIT-2),z:clamp(s.z+Math.cos(a)*9,-LIMIT+2,LIMIT-2)};if(!blocked(t.x,t.z,obs,.8))candidates.push(t);}s.fleeTarget=candidates.sort((a,b)=>distance(b,hunter)-distance(a,hunter))[0]||{x:0,z:0};}
  const running=s.stamina>5;s.running=running;s.stamina=clamp(s.stamina+(running?-19:12)*dt,0,100);follow(s,s.fleeTarget,(running?5.8:3.65)*(s.slow>0?.63:1),dt);return;
 }
 s.fleeTarget=null;s.stamina=Math.min(100,s.stamina+15*dt);
 const captive=allSurvivors().filter(p=>p.state==='captured'&&p!==s&&p.item!==SELF_RESCUE&&distance(p,hunter)>7).sort((a,b)=>distance(s,a)-distance(s,b))[0];
 const rescuers=allSurvivors().filter(p=>p.state==='active'&&p!==captive).sort((a,b)=>distance(a,captive||s)-distance(b,captive||s));
 if(captive&&rescuers[0]===s){cancelSelfHeal(s);cancelMeal(s);cancelCurryCraft(s);s.lootTarget=null;if(distance(s,captive)<2){s.interacting=true;rescue(captive,dt);}else follow(s,captive,3.8,dt);return;}
 if(id===3&&s.curryReady&&s.curryHold>=4&&!s.curryRetreat&&mines.some(m=>m.ownerSlot===s.id&&distance(m,s)<3.2))aiCurryRetreat(s);
 if(s.curryRetreat){if(distance(s,s.curryRetreat)>.5){cancelCurryCraft(s);follow(s,s.curryRetreat,3.8,dt);return;}s.curryRetreat=null;}
 if(s.item===HOT_POT&&s.hp<2&&hd>=12){if(useActorItem(s))return;}
 if(s.hp<2&&hd>=12&&!nearestInteraction(s,'survivor')){cancelCurryCraft(s);stepSelfHeal(s,dt,{held:true,stationary:true,noTarget:true});return;}cancelSelfHeal(s);
 if(gens.filter(g=>g.progress>=1).length<REQUIRED&&id===3&&!s.curryReady&&(hd>=12||hd>9&&!visible)&&(s.curryCraftWait<=0||s.craftTime>0)){
  s.lootTarget=null;if(!s.craftTime)advanceCurryCraft(s,false,true,0);
  if(advanceCurryCraft(s,true,true,dt)){s.curryCraftWait=12;s.curryHold=0;feed('宋玉莹制作完成 · 获得香菇咖喱');}return;
 }
 if(s.craftTime>0){cancelCurryCraft(s);s.curryCraftWait=2;}
 const workingGen=gens.some(g=>g.progress>0&&g.progress<1&&distance(s,g)<2.1);
 if(gens.filter(g=>g.progress>=1).length<REQUIRED&&hd>=12&&!workingGen&&aiOpenChest(s,dt))return;
 s.lootTarget=null;
 if(gens.filter(g=>g.progress>=1).length>=REQUIRED){const gate=gates.slice().sort((a,b)=>distance(s,a)-distance(s,b)+(distance(a,hunter)<7?15:0)-(distance(b,hunter)<7?15:0))[0];if(gate.progress>=1){follow(s,{x:gate.x+(gate.x<0?-.9:.9),z:gate.z},4.3,dt);if(distance(s,gate)<1.8)escape(s);}else if(distance(s,gate)<2.7){s.moving=false;s.interacting=true;openGate(gate,dt);}else follow(s,gate,4,dt);return;}
 const available=gens.filter(g=>g.progress<1).sort((a,b)=>distance(s,a)-distance(s,b));let gen=available[0];if(!gen)return;if(distance(gen,hunter)<9&&available.length>1)gen=available[1];if(distance(s,gen)<2){s.moving=false;s.interacting=true;repair(gen,dt,true);}else follow(s,gen,3.65,dt);


}
function hunterAI(dt){if(testFreezeAI)return;if(hunter.shoeTime>0){hunter.moving=false;return;}if(hunter.driving){if(hunter.blind>0){hunter.driveSteer=0;return;}const target=allSurvivors().filter(s=>s.state==='active'&&!(s.invisible>0)).sort((a,b)=>distance(a,hunter)-distance(b,hunter))[0];const angle=target?Math.atan2(target.x-hunter.x,target.z-hunter.z):hunter.angle;hunter.driveSteer=hunter.stun>0?0:clamp(Math.atan2(Math.sin(angle-hunter.angle),Math.cos(angle-hunter.angle))*1.5,-1,1);return;}if(hunter.stun>0||hunter.blind>0){hunter.moving=false;if(hunter.blind>0)hunter.memory=null;return;}const active=allSurvivors().filter(s=>s.state==='active'&&!(s.invisible>0)),visible=active.filter(s=>distance(s,hunter)<18&&lineClear(s,hunter,obs));let target=visible.sort((a,b)=>distance(hunter,a)-distance(hunter,b))[0];if(target)hunter.memory={x:target.x,z:target.z,t:5};else if(hunter.memory?.t>0){hunter.memory.t-=dt;target=hunter.memory;}else{if(!hunter.patrol||distance(hunter,hunter.patrol)<3)hunter.patrol=gens[Math.floor(rand()*gens.length)];target=hunter.patrol;}
 if(!target)return;if(isVRHunter(hunter)&&hunter.vrTime>0&&hunter.laserCooldown<=0&&visible[0]){vrSkill(Math.atan2(visible[0].x-hunter.x,visible[0].z-hunter.z));}const speed=difficulty==='easy'?4.05:difficulty==='hard'?5:4.5;follow(hunter,target,speed*(hunter.swing>0?.3:1),dt);if(visible.some(s=>distance(s,hunter)<1.8))attack(true);if(hunter.cooldown<=0&&hunter.swing<=0&&visible.some(s=>distance(s,hunter)>4&&distance(s,hunter)<18)){const aim=visible.find(s=>distance(s,hunter)>4);hunter.angle=Math.atan2(aim.x-hunter.x,aim.z-hunter.z);if(isVRHunter(hunter))vrSkill(hunter.angle);else summonCar(hunter);}}
function animateActor(a,dt){a.group.position.set(a.x,0,a.z);let delta=Math.atan2(Math.sin(a.angle-a.group.rotation.y),Math.cos(a.angle-a.group.rotation.y));a.group.rotation.y+=delta*Math.min(1,dt*12);if(a.moving)a.walk+=dt*10;const stride=a.moving?Math.sin(a.walk)*.48:0;if(a===hunter){a.group.rotation.y=a.angle;a.motion?.update(a.driving?false:a.moving,a.driving?0:a.swing,dt,a);if(a.stunEffect){a.stunEffect.visible=a.stun>0;a.stunEffect.rotation.y+=dt*3;}}else{if(a.motion)a.motion.update(a,dt);else{a.limbs[0].rotation.x=-stride*.7;a.limbs[1].rotation.x=stride;a.limbs[2].rotation.x=stride*.7;a.limbs[3].rotation.x=-stride;}a.group.position.y=a.moving?Math.abs(Math.sin(a.walk))*.045:0;applyStealthVisual(a);if(a.stunEffect){a.stunEffect.visible=a.stun>0;a.stunEffect.rotation.y+=dt*3;}}a.group.position.y+=curryFlightHeight(a)+jumpHeight(a);if(a===hunter)applyDriverPose(a);}
function update(dt){if(mode!=='playing')return;const previous=new Map([...allSurvivors(),...pigs].map(a=>[a,{x:a.x,z:a.z}]));elapsed+=dt;if(stepVR(hunter,dt)){clearVRPhantoms();feed(`豪情在天结束 · 颈椎病 ${hunter.neckStacks} 层，肘击前后摇各 +${(hunter.neckStacks*.5).toFixed(1)} 秒`);}for(const a of [hunter,...allSurvivors()]){for(const prop of ['laserTime','kickTime','kuchiSlow','jumpTime','jumpCooldown','blind','cooldown','invincible','dash','slow','reveal','attack','swing','pulse','invisible','eating','legRush','stun'])if(a[prop]>0)a[prop]=Math.max(0,a[prop]-dt);}
 playerUpdate(dt);if(netGame.playing&&netIsHost())updateNetworkActors(dt);else{for(const s of survivors)if(!(role==='survivor'&&s===current()))survivorAI(s,dt);if(role!=='hunter')hunterAI(dt);}
 for(const e of [...echoes])if(e.state==='active')survivorAI(e,dt);
 if(hunter.swing>0)hunter.angle=hunter.strikeAngle;if(hunter.hitDelay>0){hunter.hitDelay=Math.max(0,hunter.hitDelay-dt);if(hunter.hitDelay===0)resolveElbowHit();}
 for(const s of allSurvivors())if(s.state==='active'&&gates.some(g=>g.progress>=1&&distance(s,g)<1.6))escape(s);updatePigs(dt);updateCars(dt);updateExhausts(dt);updateCurryMines(dt);updateKuchi(dt,previous);for(const a of [hunter,...allSurvivors()])stepCurryFlight(a,dt,obs);updateRedEyes(dt);updateCats(dt);clearVRNegative(hunter);for(const s of allSurvivors())animateActor(s,dt);animateActor(hunter,dt);
 const danger=role==='survivor'&&isHunterNearby(current(),hunter);$('danger').style.opacity=danger?'1':'0';$('vignette').classList.toggle('danger',danger);heartbeatTime-=dt;if(danger&&heartbeatTime<=0){tone(58,.14,.09);heartbeatTime=clamp(distance(current(),hunter)/12,.3,1);}
 for(const g of gens){g.crystal.rotation.y+=dt*.8;g.crystal.position.y=1.6+Math.sin(elapsed*2+g.id)*.07;g.ring.rotation.z+=dt*.3;}for(const g of gates){g.bars.position.y=THREE.MathUtils.lerp(g.bars.position.y,g.progress>=1?4.5:0,dt*3);g.portal.material.opacity=g.progress>=1?.22:0;}
 uiTime-=dt;if(uiTime<=0){updateHUD();uiTime=.1;}const result=outcome(survivors,remaining);if(result)finish(result);}
function updateHUD(){const done=gens.filter(g=>g.progress>=1).length,p=current();$('timer').textContent='';

 $('objective-title').textContent=done>=REQUIRED?(role==='hunter'?'拦截逃生者':'开启逃生门'):(role==='hunter'?'阻止装置修复':'修复共鸣装置');$('objective-sub').textContent=done>=REQUIRED?'两侧大门已通电':`已完成 ${done} / ${REQUIRED} · 地图共 ${gens.length} 台`;$('gen-icons').querySelectorAll('i').forEach((e,i)=>e.classList.toggle('done',i<done));
 const names=survivors.map(survivorName);$('roster').innerHTML=survivors.map((s,i)=>`<div class="roster-item ${s.hp<2||s.state==='captured'?'hurt':''} ${['escaped','eliminated'].includes(s.state)?'gone':''}"><span class="num">0${i+1}</span><div><strong>${names[i]}${role==='survivor'&&i===playerIndex?' · 你':''}</strong><small>${s.state==='captured'?'被囚禁 · 等待救援':s.state==='escaped'?'已逃脱':s.state==='eliminated'?'已淘汰':s.hp===1?'受伤 · 再次受击将被囚禁':'正在寻找出路'}</small></div><span class="status">${s.state==='captured'?'⊠':s.state==='escaped'?'✓':s.state==='eliminated'?'×':s.hp===1?'♡':'◇'}</span></div>`).join('');
 $('player-name').textContent=role==='hunter'?HUNTERS[hunter.hunterCharacter||0].name+' · 你':`${names[playerIndex]} · 你`;$('player-status').textContent=isVRHunter(p)&&p.vrTime>0?`豪情在天 · 免疫负面 ${p.vrTime.toFixed(1)} 秒 · 颈椎病 ${p.neckStacks||0} 层暂不生效`:p.shoeTime>0?`顶住红眼女鞋底 · ${p.shoeTime.toFixed(1)} 秒`:p.state==='captured'?'被囚禁 · 等待队友救援':['escaped','eliminated'].includes(p.state)?(netGame.room?'等待联机对局结束':'按 Tab 观战队友'):p.mealActive?`吃火锅油条 · ${Math.max(0,MEAL_SECONDS-p.mealTime).toFixed(1)} 秒`:p.healTime>0?`自疗中 · ${p.healTime.toFixed(1)} / 20 秒`:p.driving&&p.drivePhase==='airborne'?'翻车腾空 · 落地爆炸':p.stun>0?`眩晕中 · ${p.stun.toFixed(1)} 秒`:role==='hunter'?(hunter.stun>0?`眩晕中 · ${hunter.stun.toFixed(1)} 秒`:p.driving?(p.drivePhase==='airborne'?'翻车腾空 · 落地将爆炸':`驾驶中 · ${driveSpeed(p)} 米/秒 · ${p.driveTime.toFixed(1)} 秒`):isVRHunter(p)?`颈椎病 ${p.neckStacks||0} 层 · 肘击前后摇各 +${((p.neckStacks||0)*.5).toFixed(1)} 秒`:'鼠标左键 · 横向肘击'):p.kuchiSlow>0?`麦丽素减速 50% · ${p.kuchiSlow.toFixed(1)} 秒`:p.legRush>0?`移速 +300% · ${p.legRush.toFixed(1)} 秒`:p.invisible>0?`隐身中 · ${p.invisible.toFixed(1)} 秒`:p.hp===1?'受伤 · 保持距离':'状态良好';show('resource-track',role==='hunter');$('stamina').style.width=role==='hunter'?`${100*(1-hunter.attack/1.65)}%`:`${p.stamina}%`;$('health').textContent=role==='hunter'?'':p.hp===2?'♥ ♥':'♥ ♡';$('skill-name').textContent=role==='hunter'?(isVRHunter(p)?p.vrTime>0?'镭射眼':'AI嘉豪来袭':'合肥车技'):SURVIVOR_SKILLS[characterIdOf(current())].name;$('skill-icon').textContent=role==='hunter'?(isVRHunter(p)?'◎':'ϟ'):SURVIVOR_SKILLS[characterIdOf(current())].icon;$('skill-button').disabled=p.state!=='active'||p.shoeTime>0||p.stun>0||!!p.driving;const near=role==='survivor'&&isHunterNearby(p,hunter),restricted=role==='survivor'&&characterIdOf(p)===1&&!near;$('skill-time').textContent=isVRHunter(p)&&p.vrTime>0?(p.laserCooldown>0?`镭射眼 ${Math.ceil(p.laserCooldown)} 秒冷却 · 剩余 ${p.vrTime.toFixed(1)} 秒`:`按 Q 发射 · 剩余 ${p.vrTime.toFixed(1)} 秒`):role==='hunter'&&p.driving?(p.drivePhase==='airborne'?'失控腾空 · 落地爆炸':'A / D 转向 · 无法刹车') :role==='survivor'&&characterIdOf(p)===3?(p.curryReady?'已获得香菇咖喱 · 按 Q 埋置':p.craftTime>0?`制作中 ${p.craftTime.toFixed(1)} / 10 秒`:'原地长按 Q · 制作 10 秒'):p.legRush>0?`移速 +300% · ${p.legRush.toFixed(1)} 秒`:p.skillUsed?'本局已使用':p.cooldown>0?`${Math.ceil(p.cooldown)} 秒冷却`:restricted?'等待追杀者靠近':'技能就绪';$('skill-button').style.opacity=p.skillUsed||(isVRHunter(p)&&p.vrTime>0?p.laserCooldown>0:p.cooldown>0)||restricted?'.55':'1';
 show('item-button',role==='survivor');$('item-name').textContent=ITEMS[p.item]?.name||'空道具栏';$('item-hint').textContent=p.item===HOT_POT&&isHunterNearby(p,hunter)?'追杀者靠近 · 暂时无法进食':ITEMS[p.item]?.hint||'按住 F 开宝箱获取';$('item-button').disabled=p.shoeTime>0||p.stun>0||p.item===HOT_POT&&isHunterNearby(p,hunter)||p.mealActive||!ITEMS[p.item]||(p.item===SELF_RESCUE?p.state!=='captured':p.state!=='active');$('item-button').classList.toggle('has-item',!!ITEMS[p.item]);$('item-button').classList.toggle('legendary-item',p.item===WEIRD_MUSHROOM);$('item-icon').className=p.item===FRIED_RICE?'rice-icon':p.item===WEIRD_MUSHROOM?'mushroom-icon':p.item===EXHAUST?'exhaust-icon':p.item===HOT_POT?'meal-icon':p.item===SELF_RESCUE?'rescue-icon':'egg-icon';$('item-icon').textContent=p.item===HOT_POT?'♨':p.item===SELF_RESCUE?'⚿':'';
 $('interaction-key').textContent='F';const i=nearestInteraction(p);show('interaction',!!i||p.state==='captured');if(p.state==='captured'){$('interaction-label').textContent='等待队友救援';$('interaction-fill').style.width=`${p.rescue*100}%`;$('interaction-detail').textContent=p.item===SELF_RESCUE?'持有 yzm · 按 E 即可自救':'队友靠近你后按住 F 可救援';}else if(i){let v=i.type==='kuchi-kick'?1-i.target.phaseTime/KUCHI_SQUAT_SECONDS:i.target.progress??i.target.rescue;$('interaction-label').textContent=i.type==='kuchi-kick'?'按 F · 踢腿打断库奇':i.type==='chest'?'按住 F · 开启宝箱':i.type==='chest-full'?'已携带道具 · 按 E 使用':i.type==='repair'?'按住 F · 修复共鸣':i.type==='rescue'?'按住 F · 救援队友':i.type==='locked'?'大门尚未通电':i.target.progress>=1?'穿过光幕逃离':'按住 F · 开启大门';$('interaction-fill').style.width=`${v*100}%`;$('interaction-detail').textContent=i.type==='kuchi-kick'?`制作还剩 ${i.target.phaseTime.toFixed(1)} 秒 · 踢腿使库奇眩晕 10 秒`:i.type==='chest'?'开启 10 秒 · 随机获得道具 · 5% 获得传奇诡异香菇':i.type==='chest-full'?'一次携带 1 个道具 · 宝箱尚未消耗':i.type==='locked'?'先修复 5 台共鸣装置':i.type==='rescue'?`救援进度 ${Math.round(v*100)}%`:`${Math.round(v*100)}% ${i.type==='repair'?'· 移动会中断修复':''}`;}
 if(p.craftTime>0){$('interaction-key').textContent='Q';show('interaction');$('interaction-label').textContent='长按 Q · 制作香菇咖喱';$('interaction-fill').style.width=`${p.craftTime/CURRY_CRAFT_SECONDS*100}%`;$('interaction-detail').textContent=`${p.craftTime.toFixed(1)} / 10 秒 · 松开、移动或受击会中断`;}

 if(role==='survivor'&&p.state==='active'&&p.hp<2&&!i&&p.stun<=0&&p.kickTime<=0&&!(p.jumpTime>0)&&!(p.craftTime>0)){$('interaction-key').textContent='F';show('interaction');$('interaction-label').textContent='长按 F · 自疗回复一格生命';$('interaction-fill').style.width=`${(p.healTime||0)/SELF_HEAL_SECONDS*100}%`;$('interaction-detail').textContent=`${(p.healTime||0).toFixed(1)} / 20 秒 · 松开、移动或受击会中断`;}
 drawMap();}
function drawMap(){const ctx=$('minimap').getContext('2d'),sz=196;ctx.clearRect(0,0,sz,sz);ctx.fillStyle='#0b2028';ctx.fillRect(0,0,sz,sz);const extent=LIMIT+2,width=extent*2,px=x=>(x+extent)/width*sz,pz=z=>(z+extent)/width*sz;ctx.strokeStyle='#52716d88';ctx.strokeRect(px(-40),pz(-40),px(40)-px(-40),pz(40)-pz(-40));ctx.fillStyle='#54716b77';for(const o of obs)ctx.fillRect(px(o.x-o.w/2),pz(o.z-o.d/2),o.w/width*sz,o.d/width*sz);ctx.font='10px sans-serif';for(const g of gens){ctx.fillStyle=g.progress>=1?'#94c4a1':'#d5b77c';ctx.fillText(g.progress>=1?'✓':'◆',px(g.x)-4,pz(g.z)+4);}for(const c of chests){if(c.opened)continue;ctx.fillStyle='#f1de9d';ctx.fillText('▣',px(c.x)-4,pz(c.z)+4);}for(const g of gates){ctx.fillStyle=g.progress>=1?'#a4eab5':'#93a7a2';ctx.fillRect(px(g.x)-2,pz(g.z)-7,4,14);}for(const s of allSurvivors()){if(s.state==='escaped'||s.state==='eliminated'||role==='hunter'&&s.invisible>0)continue;ctx.fillStyle=s.state==='captured'?'#db8a74':s.isEcho?'#d6a6ee':'#81c8bb';ctx.beginPath();ctx.arc(px(s.x),pz(s.z),s===current()?4:2.5,0,Math.PI*2);ctx.fill();if(s===current()){ctx.strokeStyle='#fff3cc';ctx.lineWidth=1;ctx.stroke();}}if(role==='hunter'||distance(current(),hunter)<15||hunter.pulse>0){ctx.fillStyle='#df8469';ctx.beginPath();ctx.arc(px(hunter.x),pz(hunter.z),3.5,0,Math.PI*2);ctx.fill();}const p=current();ctx.strokeStyle='#ddd7b5';ctx.beginPath();ctx.moveTo(px(p.x),pz(p.z));ctx.lineTo(px(p.x)-Math.sin(camYaw)*6,pz(p.z)-Math.cos(camYaw)*6);ctx.stroke();}
function stopVRVisuals(){clearVRPhantoms();if(hunter){hunter.vrTime=0;hunter.laserTime=0;hunter.motion?.update(false,0,0,hunter);}if(laserVisual)laserVisual.visible=false;}
function finish(result){clearCats();stopVRVisuals();clearRedEyes();if(netGame.playing&&netIsHost()){netSend({type:'snapshot',state:netSnapshot()});netSend({type:'result',result});netGame.playing=false;}clearRedEyes();clearPigs();cameraOcclusion?.reset();clearEchoes();clearCars();clearExhausts();clearCurryMines();clearKuchi();show('blind-overlay',false);mode='result';const escaped=survivors.filter(s=>s.state==='escaped').length,win=result===role;$('result-title').textContent=result==='draw'?'夜雾中的平局':win?'这场夜雾，属于你。':role==='survivor'?'夜雾吞没了出路。':'黎明带走了他们。';$('result-symbol').textContent=result==='hunter'?'♜':'◇';$('result-desc').textContent=result==='draw'?'两人成功逃脱。庄园与黎明，各留住一半。':result==='survivor'?'至少三名逃生者抵达黎明。逃生者阵营获胜。':(!survivors.some(s=>s.state==='active')?'所有仍在场的求生者均被囚禁。追杀者阵营获胜。':'逃脱人数不足两人。追杀者阵营获胜。');$('result-escaped').textContent=escaped;$('result-gens').textContent=gens.filter(g=>g.progress>=1).length;$('result-duration').textContent=`${Math.floor(elapsed/60)}:${String(Math.floor(elapsed%60)).padStart(2,'0')}`;show('result-modal');syncMouse();$('vignette').classList.remove('danger');tone(win?740:160,.7,.07);}
function updateCamera(dt,t){if(mode==='lobby'){cameraOcclusion?.reset();const target=new THREE.Vector3(7.1,1.35,10.9);camera.position.set(11.8+Math.sin(t*.12)*.15,2.65,16.8);camera.lookAt(target);}else{const p=netGame.playing&&!netIsHost()?(netGame.localPose||current()):current(),altitude=driveHeight(p)+curryFlightHeight(p)+jumpHeight(p)*.6,focus=new THREE.Vector3(p.x,1.4+altitude,p.z),desired=orbitPosition(focus,camYaw,camPitch,camDistance);if(teleportCameraPending){camera.position.copy(desired);teleportCameraPending=false;}camera.position.lerp(desired,1-Math.exp(-dt*12));camera.lookAt(focus);cameraOcclusion?.update(camera,focus,dt,['playing','paused'].includes(mode));}}
function frame(time){const t=time/1000,dt=Math.min(.1,t-(lastTime||t));lastTime=t;if(mode==='playing'&&(!netGame.playing||netIsHost())){let left=dt;while(left>1e-6&&mode==='playing'){const step=Math.min(.04,left);update(step);left-=step;}}netFrame(dt);if(hunter&&mode==='lobby'){hunter.motion.update(false,0,dt);characterPreview?.update(dt);}if(mode!=='paused'){for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.t+=dt;e.mesh.scale.setScalar(1+e.t*e.radius);e.mesh.material.opacity=.6*(1-e.t);if(e.t>=1){scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();effects.splice(i,1);}}}if(hunter){hunter.group.visible=mode!=='lobby';updateCamera(dt,t);}updateCurryMineVisibility();renderCarVisuals(dt);renderPigs(dt);renderRedEyes(dt);if(laserVisual)poseLaserVisual(laserVisual,hunter,['playing','paused'].includes(mode));$('laser-reticle').classList.toggle('hidden',!(mode==='playing'&&role==='hunter'&&hunter.vrTime>0));renderKuchi(dt);renderCats(dt);renderVRPhantoms(dt);renderMailisu();updateJumpAudio();if(netGame.quality>0&&t-netGame.shadowStamp>=.25){renderer.shadowMap.needsUpdate=true;netGame.shadowStamp=t;}renderer.render(scene,camera);updateBlindOverlay();updateEatingAudio(dt);requestAnimationFrame(frame);}
function initEvents(){
 $('hunter-choice').onchange=()=>{if(role==='hunter')updateLobbyCharacter();if(netGame.room)netSend({type:'select',slot:4,hunterCharacter:Number($('hunter-choice').value)});};
 $('survivor-choice').onchange=()=>{updateLobbyCharacter();if(netGame.room)netSend({type:'select',slot:Math.min(3,Number($('survivor-choice').value)),character:Number($('survivor-choice').value)});};
 $('start').onclick=requestStart;$('survivor-role').onclick=()=>{if($('survivor-choice').selectedOptions[0]?.disabled){const available=[...$('survivor-choice').options].find(o=>!o.disabled);if(!available)return;$('survivor-choice').value=available.value;}setRole('survivor');if(netGame.room)netSend({type:'select',slot:Math.min(3,Number($('survivor-choice').value)),character:Number($('survivor-choice').value)});};$('hunter-role').onclick=()=>{setRole('hunter');if(netGame.room)netSend({type:'select',slot:4,hunterCharacter:Number($('hunter-choice').value)});};$('again').onclick=requestStart;$('back').onclick=returnMultiplayerLobby;$('quit').onclick=back;$('resume').onclick=pause;$('pause').onclick=pause;$('brand').onclick=e=>{e.preventDefault();if(mode==='playing'&&(!netGame.playing||!netGame.menu))pause();};$('skill-button').onclick=()=>{if(role!=='survivor'||characterIdOf(current())!==3)skill();};const qButton=$('skill-button');qButton.addEventListener('pointerdown',e=>{if(role==='survivor'&&characterIdOf(current())===3){keys.q=true;if(current().curryReady)skill();qButton.setPointerCapture?.(e.pointerId);}});for(const event of ['pointerup','pointercancel','lostpointercapture'])qButton.addEventListener(event,()=>{keys.q=false;});$('item-button').onclick=useItem;
 $('howto').onclick=()=>{pausedHelp=false;show('help-modal');};$('pause-help').onclick=()=>{pausedHelp=true;show('pause-modal',false);show('help-modal');};$('close-help').onclick=()=>{show('help-modal',false);if(pausedHelp)show('pause-modal');};
 $('sound').onclick=()=>{sound=!sound;$('sound').querySelector('span').textContent=sound?'声音开':'声音关';$('sound').setAttribute('aria-label',sound?'关闭声音':'开启声音');$('sound').title=sound?'关闭声音':'开启声音';if(sound)tone(540,.1,.04);};$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('当前窗口不支持全屏，可在独立浏览器中打开。');}};
 document.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(k==='shift')return;if([' ','tab','arrowleft','arrowright','arrowup','arrowdown'].includes(k)&&mode!=='lobby')e.preventDefault();if(k==='escape'){e.preventDefault();if(e.repeat||mouseCapture?.ignoreEscape())return;if(!$('help-modal').classList.contains('hidden'))$('close-help').click();else pause();return;}if(k==='f'&&!e.repeat&&mode==='playing'&&!netGame.menu){fPress++;}if(k===' '&&!e.repeat&&mode==='playing'&&!netGame.menu){jumpPress++;}if(k==='q'&&!e.repeat)skill();if(k==='e'&&!e.repeat)useItem();if(k==='tab'&&!netGame.room&&mode==='playing'&&role==='survivor'&&['escaped','eliminated'].includes(current().state)){const index=survivors.findIndex((s,i)=>i!==playerIndex&&s.state==='active');if(index>=0){playerIndex=index;toast('已切换到仍在场的队友');}}keys[k]=true;});document.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
 window.addEventListener('blur',()=>{drag=null;for(const k of Object.keys(keys))keys[k]=false;touchMove={x:0,z:0};if(mode==='playing'&&(!netGame.playing||!netGame.menu))pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing'&&(!netGame.playing||!netGame.menu))pause();});
 const canvas=renderer.domElement;
 const canLook=()=>mode==='playing'&&!netGame.menu&&$('help-modal').classList.contains('hidden');
 const turnCamera=(dx,dy)=>{camYaw-=dx*.006;camPitch=clamp(camPitch+dy*.004,CAMERA_MIN_PITCH,CAMERA_MAX_PITCH);};
 canvas.addEventListener('wheel',e=>{if(!canLook())return;e.preventDefault();camDistance=clamp(camDistance+e.deltaY*.008,CAMERA_MIN_DISTANCE,CAMERA_MAX_DISTANCE);},{passive:false});
 mouseCapture=createMouseCapture({canvas,document,isActive:canLook,turn:turnCamera,onUnlock:pause,hint:$('mouse-capture'),fine:!window.matchMedia('(pointer:coarse)').matches});
 canvas.addEventListener('pointerdown',e=>{
  if(!canLook()||e.button!==0)return;
  if(e.pointerType==='mouse'){if(!mouseCapture.locked())mouseCapture.capture();else if(role==='hunter')attack();return;}
  drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,id:e.pointerId};canvas.setPointerCapture(e.pointerId);
 });
 canvas.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'||!canLook()||!drag||e.pointerId!==drag.id)return;turnCamera(e.clientX-drag.x,e.clientY-drag.y);drag.x=e.clientX;drag.y=e.clientY;});
 canvas.addEventListener('pointerup',e=>{if(e.pointerType!=='mouse'&&canLook()&&drag&&e.pointerId===drag.id&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<5&&role==='hunter')attack();drag=null;});
 canvas.addEventListener('pointercancel',()=>drag=null);canvas.addEventListener('contextmenu',e=>e.preventDefault());
 let joyId=null;$('joystick').addEventListener('pointerdown',e=>{joyId=e.pointerId;$('joystick').setPointerCapture(e.pointerId);joy(e);});$('joystick').addEventListener('pointermove',e=>{if(e.pointerId===joyId)joy(e);});function joy(e){const r=$('joystick').getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dz=e.clientY-r.top-r.height/2,n=Math.max(1,Math.hypot(dx,dz)/30);touchMove={x:dx/n/30,z:dz/n/30};$('stick').style.transform=`translate(${dx/n}px,${dz/n}px)`;}for(const ev of ['pointerup','pointercancel'])$('joystick').addEventListener(ev,()=>{joyId=null;touchMove={x:0,z:0};$('stick').style.transform='';});for(const [id,k] of [['mobile-action','f']]){$(id).addEventListener('pointerdown',e=>{e.preventDefault();$(id).setPointerCapture(e.pointerId);keys[k]=true;});for(const ev of ['pointerup','pointercancel'])$(id).addEventListener(ev,()=>keys[k]=false);}$('mobile-attack').onclick=attack;
 window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
}
const netGame={id:null,room:null,playing:false,menu:false,inputs:new Map(),eventId:0,events:[],seenEvent:0,sendTime:0,snapshotTime:0,acting:null,carId:0,connected:false,queues:new Map(),tracks:new Map(),prediction:null,localPose:null,inputAccumulator:0,receivedAt:0,lastSnapshot:-1,frameCount:0,frameTime:0,fps:60,fpsStamp:0,relayRtt:null,hostFps:null,streams:null,quality:0,slowWindows:0,controlKeys:'',controlSerial:0,shadowStamp:0};
const bridge=globalThis.multiplayer;let peerNetwork=null,roomDiscovery=null,netConnectAttempt=0;
function netIsHost(){return !!netGame.room&&netGame.room.hostId===netGame.id;}
function netSlot(){return role==='hunter'?4:playerIndex;}
function slotActor(slot){return slot===4?hunter:survivors[slot];}
function netRecord(type,data){if(!netGame.playing||!netIsHost())return;netGame.events.push({id:++netGame.eventId,type,...data});if(netGame.events.length>40)netGame.events.shift();}
function netSend(message){peerNetwork?.send(message);}
function renderRoom(){
 const room=netGame.room;if(!room)return;
 const own=room.players.find(p=>p.id===netGame.id);if(!own)return;
 $('room-code').textContent=room.code;$('room-status').textContent=`${room.players.length} / 5 人 · ${netIsHost()?'你是房主':'等待房主开始'} · 仅 P2P 直连 · 空位由 AI 补齐`;
 const unavailable=new Set(room.players.filter(p=>p.id!==netGame.id&&p.slot!==4).map(p=>p.character??p.slot));
 for(const option of $('survivor-choice').options)option.disabled=unavailable.has(Number(option.value));
 $('hunter-role').disabled=room.players.some(p=>p.id!==netGame.id&&p.slot===4)||room.phase==='playing';
 $('survivor-role').disabled=room.phase==='playing'||own.slot===4&&room.players.filter(p=>p.slot!==4).length>=4;$('survivor-choice').disabled=room.phase==='playing';
 const chosenHunter=room.players.find(p=>p.slot===4)?.hunterCharacter;if(chosenHunter!==undefined)$('hunter-choice').value=String(chosenHunter);role=own.slot===4?'hunter':'survivor';playerIndex=own.slot===4?0:own.slot;$('survivor-choice').value=String(own.character??playerIndex);setRole(role);updateLobbyCharacter();
 $('net-ready').textContent=own.ready?'取消准备':'我已准备';$('net-start').disabled=!netIsHost()||room.players.some(p=>p.id!==netGame.id&&!p.ready);
 $('net-ready').disabled=room.phase==='playing';updateDirectStatus();
}
async function connectMultiplayer(create,manual=false){
 if(!bridge||!peerNetwork){toast('请使用 Windows EXE 版本进行联机。');return;}
 const attempt=++netConnectAttempt;for(const id of ['net-create','net-join','net-manual-create','net-manual-join'])$(id).disabled=true;$('net-message').textContent=create?'正在创建房间…':'正在建立 P2P 直连…';
 try{
  const character=Number($('survivor-choice').value),chosen=role==='hunter'?4:Math.min(3,character),options={name:$('net-name').value||'玩家',slot:chosen,hunterCharacter:Number($('hunter-choice').value),character:chosen===4?null:character};
  if(manual)await roomDiscovery?.close();
  const result=manual?(create?peerNetwork.createHost(options):await peerNetwork.joinInvitation($('manual-code').value,options)):create?await roomDiscovery.create(options):await roomDiscovery.join($('net-code').value,options);
  if(attempt!==netConnectAttempt)return;
  netGame.connected=true;netGame.id=result.id;
  $('room-address').textContent=manual?'手动 P2P 直连':'把六位房间号发给朋友，输入即可加入';show('room-copy',!manual);
  $('net-message').textContent='';show('net-connect',false);show('net-room');show('net-modal',false);renderRoom();
  $('direct-output').value=manual&&!create?result.answer:'';$('direct-input').value='';if(manual)openDirectPanel();else show('direct-modal',false);
 }catch(e){if(attempt===netConnectAttempt){if(!peerNetwork.room&&netGame.room)await leaveMultiplayer();$('net-message').textContent=e.message;show('net-modal');}}
 finally{if(attempt===netConnectAttempt)for(const id of ['net-create','net-join','net-manual-create','net-manual-join'])$(id).disabled=false;}
}
function updateDirectStatus(){
 if(!netGame.room||!peerNetwork)return;
 const stats=peerNetwork.stats(),own=netGame.room.players.find(p=>p.id===netGame.id);
 $('room-status').textContent=`${netGame.room.players.length} / 5 人 · ${netIsHost()?'你是房主':'等待房主开始'} · 已直连 ${stats.direct}/${stats.total} · 无中继备用`;
 $('net-start').disabled=!netIsHost()||!peerNetwork.canStart();
 const diagnosis=stats.diagnosis;const stateKey=[netIsHost(),stats.direct,stats.total,stats.awaitingResponses,diagnosis.code].join(':');const busy=['direct-generate','direct-import','net-create','net-join'].some(id=>$(id).disabled);if(!busy&&$('direct-status').dataset.stateKey!==stateKey){$('direct-status').dataset.stateKey=stateKey;$('direct-status').textContent=diagnosis.code==='connected'?netIsHost()?`已连接 ${stats.direct} 位玩家，可返回选人等待准备。`:'已与房主建立 P2P 直连，可关闭此窗口并准备。':roomDiscovery?.active&&['idle','waiting-response'].includes(diagnosis.code)?roomDiscovery.connected?'房间已创建，分享六位房间号即可邀请朋友。':roomDiscovery.message:diagnosis.message;}
 $('direct-diagnostics').value=JSON.stringify({version:'1.24.0',time:new Date().toISOString(),role:netIsHost()?'host':'guest',phase:netGame.room.phase,online:navigator.onLine,noRelay:true,direct:stats.direct,pendingInvitations:stats.awaitingResponses,diagnosis,connections:stats.connections},null,2);
 if(own)$('net-ready').disabled=netGame.room.phase==='playing'||!netIsHost()&&(!stats.direct||!stats.admitted);
}
function openDirectPanel(){
 const host=netIsHost(),quick=roomDiscovery?.active;show('direct-modal');show('direct-manual-fields',!quick);$('direct-title').textContent=quick?'连接状态':'交换信息，直接连接';show('direct-host-controls',host);$('direct-output-label').textContent=host?'发给玩家的邀请信息（每人一份）':'请发给房主的回应信息';$('direct-help').textContent=host?'为每位玩家分别生成邀请。对方导入邀请后会生成回应，将回应粘贴到下方并导入。':'复制回应信息发给房主；房主导入后自动建立直连。无需填写服务器地址或六位房间号。';if(quick)$('direct-help').textContent=roomDiscovery.connected?'房间号 '+netGame.room.code+' · 已自动交换连接信息，对局采用 P2P 直连。':'房间号服务已断开，现有 P2P 对局仍可继续。';updateDirectStatus();
}
async function leaveMultiplayer(message){
 await roomDiscovery?.close();
 await peerNetwork?.leave();show('direct-modal',false);
 netGame.room=null;netGame.id=null;netGame.playing=false;netGame.connected=false;netGame.menu=false;netGame.inputs.clear();netGame.queues.clear();netGame.tracks.clear();netGame.prediction=null;netGame.localPose=null;
 back();show('net-room',false);show('net-connect');
 for(const option of $('survivor-choice').options)option.disabled=false;
 $('hunter-role').disabled=false;$('survivor-role').disabled=false;$('survivor-choice').disabled=false;updateLobbyCharacter();
 if(message)toast(message);
}
function returnMultiplayerLobby(){if(netGame.room){if(netIsHost())netSend({type:'lobby'});else toast('等待房主返回房间；也可按 Esc 退出联机。');}else back();}
function requestStart(){if(netGame.room){if(netIsHost())netSend({type:'start',difficulty:$('difficulty').value});else toast('准备后等待房主开始。');}else start();}
function initMultiplayer(){
 if(bridge){peerNetwork=new DirectRoom({deliver:message=>handleNetEvent(message,true),onStatus:updateDirectStatus});roomDiscovery=new EasyRoom({room:peerNetwork,bridge,onStatus:status=>{if($('net-create').disabled||$('net-join').disabled)$('net-message').textContent=status.message;else if(status.active&&!status.connected&&status.message)toast(status.message);}});}
 $('net-open').onclick=()=>{if(netGame.room){openDirectPanel();return;}show('net-connect');show('net-modal');};$('net-select').onclick=()=>show('net-modal',false);$('net-close').onclick=async()=>{if($('net-create').disabled||$('net-join').disabled){netConnectAttempt++;await leaveMultiplayer();for(const id of ['net-create','net-join','net-manual-create','net-manual-join'])$(id).disabled=false;}$('net-message').textContent='';show('net-modal',false);};
 $('net-create').onclick=()=>connectMultiplayer(true);$('net-join').onclick=()=>connectMultiplayer(false);
 $('net-manual-create').onclick=()=>connectMultiplayer(true,true);$('net-manual-join').onclick=()=>connectMultiplayer(false,true);
 $('room-copy').onclick=async()=>{const code=netGame.room?.code;if(!/^\d{6}$/.test(code||''))return;try{await navigator.clipboard.writeText(code);toast('房间号已复制，发给朋友即可。');}catch{toast('房间号：'+code);}};
 $('net-code').addEventListener('keydown',event=>{if(event.key==='Enter'&&!$('net-join').disabled){event.preventDefault();$('net-join').click();}});
 $('net-leave').onclick=()=>leaveMultiplayer('已退出房间。');$('net-ready').onclick=()=>{const own=netGame.room?.players.find(p=>p.id===netGame.id);netSend({type:'ready',ready:!own?.ready});};$('net-start').onclick=requestStart;
 $('direct-open').onclick=openDirectPanel;$('direct-close').onclick=()=>show('direct-modal',false);
 $('direct-generate').onclick=async()=>{const button=$('direct-generate');button.disabled=true;$('direct-status').textContent='正在收集直连地址并生成邀请…';try{$('direct-output').value=await peerNetwork.createInvitation();$('direct-status').textContent='邀请已生成，请发给一位玩家。对方返回回应后在下方导入。';}catch(e){$('direct-status').textContent=e.message;}finally{button.disabled=false;}};
 $('direct-import').onclick=async()=>{const button=$('direct-import');button.disabled=true;try{await peerNetwork.importResponse($('direct-input').value);$('direct-input').value='';$('direct-status').textContent='回应已导入，正在建立直连…';}catch(e){$('direct-status').textContent=e.message;}finally{button.disabled=false;}};
 $('direct-cancel').onclick=()=>{peerNetwork.cancelInvitations();$('direct-output').value='';updateDirectStatus();};
 $('direct-copy').onclick=async()=>{const field=$('direct-output');if(!field.value){toast('请先生成连接信息。');return;}try{await navigator.clipboard.writeText(field.value);toast('已复制，请发给对方。');}catch{field.focus();field.select();toast('已选中连接信息，请按 Ctrl+C 复制。');}};
 $('direct-copy-diagnostics').onclick=async()=>{const field=$('direct-diagnostics');try{await navigator.clipboard.writeText(field.value);toast('连接诊断已复制。');}catch{field.closest('details').open=true;field.focus();field.select();toast('已选中连接诊断，请按 Ctrl+C 复制。');}};
}
function handleNetEvent(message,direct=false){
  if(!direct&&peerNetwork?.observe(message))return;
  if(['input','control','action','snapshot'].includes(message.type)&&netGame.room?.protocol>=23&&message.match!==peerNetwork?.match)return;
  if(message.type==='welcome'){netGame.id=message.id;return;}if(message.type==='connection-stats'){netGame.relayRtt=message.relayRtt;netGame.streams=message.streams;return;}
  if(message.type==='room'){netGame.room=message;renderRoom();return;}
  if(message.type==='error'){toast(message.message);$('net-message').textContent=message.message;if(netGame.room)renderRoom();return;}
  if(message.type==='start'){
   netGame.playing=true;netGame.menu=false;netGame.inputs.clear();netGame.events=[];netGame.eventId=0;netGame.seenEvent=0;netGame.sendTime=0;netGame.snapshotTime=0;netGame.queues.clear();netGame.tracks.clear();netGame.prediction=null;netGame.localPose=null;netGame.inputAccumulator=0;netGame.controlKeys='';netGame.controlSerial=0;netGame.lastSnapshot=-1;netGame.fpsStamp=0;netGame.hostFps=null;netGame.receivedAt=performance.now();
   $('difficulty').value=message.difficulty;start(message.spawnSeed);show('net-modal',false);show('direct-modal',false);$('pause').innerHTML='菜单 <kbd>Esc</kbd>';$('again').textContent=netIsHost()?'再开一局':'等待房主再开一局';$('back').textContent='返回联机房间';return;
  }
  if(['input','control'].includes(message.type)&&netIsHost()){
   const previous=netGame.inputs.get(message.slot);if(message.input.serial&&previous?.serial>message.input.serial)return;
   netGame.inputs.set(message.slot,{...message.input,time:Date.now()});let queue=netGame.queues.get(message.slot);if(!queue){queue=new InputQueue();netGame.queues.set(message.slot,queue);}
   if(message.type==='control')queue.control(message.input.seq);else if(Array.isArray(message.input.commands))queue.receive(message.input.commands);
  }
  if(message.type==='action'&&netIsHost()&&netGame.playing){
   const peer=netGame.room.players.find(p=>p.id===message.id&&p.slot===message.slot);if(!peer)return;
   withRemoteActor(peer,()=>{if(message.action==='skill')skill();else if(message.action==='item')useItem();else if(peer.slot===4)attack();});
  }
  if(message.type==='snapshot'&&!netIsHost()&&netGame.playing)applyNetSnapshot(message.state);
  if(message.type==='feedback')toast(message.message);
  if(message.type==='result'&&!netIsHost()){netGame.playing=false;finish(message.result);}
  if(message.type==='lobby'){
   netGame.playing=false;netGame.menu=false;back();show('net-modal',false);show('net-connect',false);show('net-room');show('net-modal',false);renderRoom();
  }
  if(message.type==='left'){netGame.inputs.delete(message.slot);if(netGame.playing)feed('一名玩家断线，其角色已交给 AI。');}
  if((message.type==='closed'||message.type==='disconnected')&&netGame.connected)leaveMultiplayer(message.message||'P2P 直连已断开，已返回大厅。');
}
function withRemoteActor(peer,action,override){
 const saved={role,playerIndex,camYaw,interact,touchMove,jumpPress,fPress,keys:{...keys}};
 role=peer.slot===4?'hunter':'survivor';playerIndex=peer.slot===4?0:peer.slot;netGame.acting=peer.id;
 const input=override||netGame.inputs.get(peer.slot),valid=!!override||input&&Date.now()-input.time<600;
 for(const k of Object.keys(keys))delete keys[k];if(valid)Object.assign(keys,input.keys);
 touchMove=valid?input.touch:{x:0,z:0};camYaw=valid?input.yaw:0;jumpPress=valid?input.jumpPress||0:0;fPress=valid?input.fPress||0:0;
 try{action();}finally{role=saved.role;playerIndex=saved.playerIndex;camYaw=saved.camYaw;interact=saved.interact;touchMove=saved.touchMove;jumpPress=saved.jumpPress;fPress=saved.fPress;for(const k of Object.keys(keys))delete keys[k];Object.assign(keys,saved.keys);netGame.acting=null;}
}
function updateNetworkActors(dt){
 for(const peer of netGame.room.players){if(peer.id===netGame.id)continue;const queue=netGame.queues.get(peer.slot);if(queue){const actor=slotActor(peer.slot);const latest=netGame.inputs.get(peer.slot),age=Date.now()-(latest?.time||0),fresh=latest&&age<2500;const fallback=remoteFallback(latest,age);queue.advance(dt,(input,step)=>withRemoteActor(peer,()=>playerUpdate(step),input),fallback);if(!fresh&&!queue.queue.length)withRemoteActor(peer,()=>playerUpdate(dt),{keys:{},touch:{x:0,z:0},yaw:latest?.yaw||0});actor.inputAck=queue.ack;actor.inputClock=queue.clock;actor.inputLead=queue.speculativeTime;if(!queue.queue.length&&Date.now()-(netGame.inputs.get(peer.slot)?.time||0)>600)actor.moving=false;}else withRemoteActor(peer,()=>playerUpdate(dt));}
 const occupied=new Set(netGame.room.players.map(p=>p.slot));
 for(const actor of survivors)if(!occupied.has(actor.id))survivorAI(actor,dt);
 if(!occupied.has(4))hunterAI(dt);
}
const netActorFields=['hunterCharacter','vrTime','vrElapsed','vrSerial','laserCooldown','laserTime','laserSerial','laserX','laserZ','laserAngle','laserRange','neckStacks','elbowDuration','elbowImpact','shoeTime','shoeNpcId','shoeX','shoeZ','shoeAngle','healTime','kickTime','kickAck','kuchiSlow','jumpTime','jumpCooldown','jumpSerial','jumpAck','driving','drivePhase','driveTime','driveAirTime','driveAirTotal','driveVX','driveVZ','driveSteer','driveTravel','driveWallBoost','driveBounces','inputAck','inputClock','inputLead','mealActive','mealTime','craftTime','craftBlocked','curryReady','launchTime','launchVX','launchVZ','blind','item','characterId','legRush','skillUsed','x','z','angle','state','hp','stamina','invincible','captures','prison','rescue','cooldown','dash','invisible','eating','slow','reveal','moving','running','interacting','swing','attack','stun','hitDelay','strikeAngle','pulse'];
function netActorState(actor){const copy={};for(const key of netActorFields)if(actor[key]!==undefined)copy[key]=actor[key];return copy;}
function netSnapshot(){
 return {vrPhantoms:vrPhantoms.map(vrPhantomState),cats:cats.map(catState),catFights:catFights.map(catFightState),redEyes:redEyes.filter(n=>n.active).map(redEyeState),pigs:pigs.filter(p=>p.active).map(seekerPigState),timeLimit:null,remaining,elapsed,hostFps:netGame.fps,kuchi:kuchiState(kuchi),mailisu:mailisu.map(m=>({id:m.netId??(m.netId=++mailisuId),x:m.x,z:m.z})),chests:chests.map(c=>({id:c.id,x:c.x,z:c.z,progress:c.progress,opened:c.opened,loot:c.loot})),hunter:netActorState(hunter),survivors:survivors.map(netActorState),echoes:echoes.map(e=>({id:e.id,ownerSlot:e.ownerSlot,...netActorState(e)})),gens:gens.map(g=>g.progress),gates:gates.map(g=>g.progress),
  mines:mines.map(m=>({id:m.netId,ownerSlot:m.ownerSlot,x:m.x,z:m.z,arm:m.arm})),gases:gases.map(g=>({id:g.netId??(g.netId=++netGame.carId),ownerSlot:g.ownerSlot,x:g.x,z:g.z,angle:g.angle,active:g.active,fade:g.fade,travel:g.travel})),cars:cars.map(c=>({driven:!!c.driven,driverSlot:c.driverSlot,phase:c.phase,timeLeft:c.timeLeft,airTime:c.airTime,id:c.netId??(c.netId=++netGame.carId),x:c.x,z:c.z,angle:c.angle,active:c.active,fade:c.fade,travel:c.travel})),events:netGame.events};
}
function applyNetSnapshot(state){
 if(!state||!Array.isArray(state.survivors)||state.survivors.length!==4)return;
 if(state.elapsed<netGame.lastSnapshot)return;netGame.lastSnapshot=state.elapsed;const received=performance.now();netGame.receivedAt=received;
 syncVRPhantoms(state.vrPhantoms);syncCats(state,received);remaining=state.remaining;elapsed=state.elapsed;netGame.hostFps=state.hostFps??null;mailisu.splice(0,mailisu.length,...(state.mailisu||[]).map(m=>({netId:m.id,x:m.x,z:m.z})));if(state.kuchi){if(!kuchi)kuchi=createKuchi(state.kuchi);Object.assign(kuchi,state.kuchi);let track=netGame.tracks.get(kuchi);if(!track){track=new MotionTrack();netGame.tracks.set(kuchi,track);}track.push(state.elapsed,{...kuchi,state:'active'},received);}else clearKuchi();for(const data of state.chests||[]){const chest=chests[data.id];if(chest){Object.assign(chest,data);updateChestVisual(chest);}}
 const echoIds=new Set((state.echoes||[]).map(e=>e.id));for(const e of [...echoes])if(!echoIds.has(e.id))removeEcho(e);for(const data of state.echoes||[])if(!echoes.some(e=>e.id===data.id))createEchoActor({...createEchoState({id:data.ownerSlot,characterId:data.characterId,angle:data.angle},data,data.id),...data});
 for(const [actor,copy] of [[hunter,state.hunter],...survivors.map((s,i)=>[s,state.survivors[i]]),...echoes.map(e=>[e,state.echoes.find(data=>data.id===e.id)])]){
  if(actor===hunter&&copy.hunterCharacter!==undefined&&copy.hunterCharacter!==actor.hunterCharacter)setHunterCharacter(copy.hunterCharacter);if(actor!==hunter&&copy.characterId!==undefined&&copy.characterId!==actor.characterId)setActorCharacter(actor,copy.characterId);
  for(const key of netActorFields)if(Object.hasOwn(copy,key))actor[key]=copy[key];
  actor.group.visible=!['escaped','eliminated'].includes(actor.state);
  let track=netGame.tracks.get(actor);if(!track){track=new MotionTrack();netGame.tracks.set(actor,track);}track.push(state.elapsed,actor,received);
  if(actor===current()){if(!netGame.prediction){netGame.prediction=new LocalPrediction(obs,role==='hunter',driveObstacles());netGame.prediction.reset(actor);}netGame.prediction.reconcile(actor,received);}
 }
 state.gens.forEach((p,i)=>{gens[i].progress=p;gens[i].crystal.material.emissive.set(p>=1?'#ffc76b':'#86d8bc');});state.gates.forEach((p,i)=>{gates[i].progress=p;gates[i].bars.position.y=p>=1?4.5:0;gates[i].portal.material.opacity=p>=1?.22:0;});
 const npcIds=new Set((state.redEyes||[]).map(n=>n.id));for(let i=redEyes.length-1;i>=0;i--)if(!npcIds.has(redEyes[i].id)){disposeRedEyeVisual(redEyes[i].root);netGame.tracks.delete(redEyes[i]);redEyes.splice(i,1);}for(const data of state.redEyes||[]){let npc=redEyes.find(n=>n.id===data.id);if(!npc){npc={...data,root:createRedEyeVisual()};redEyes.push(npc);scene.add(npc.root);}Object.assign(npc,data);netTrackEffect(npc,state.elapsed,received);}
 const pigIds=new Set((state.pigs||[]).map(p=>p.id));for(let i=pigs.length-1;i>=0;i--)if(!pigIds.has(pigs[i].id)){disposePigVisual(pigs[i].root);pigs.splice(i,1);}for(const data of state.pigs||[]){let pig=pigs.find(p=>p.id===data.id);if(!pig){pig={...data,state:'active',root:createPigVisual()};pigs.push(pig);scene.add(pig.root);}Object.assign(pig,data);posePigVisual(pig.root,pig);netTrackEffect(pig,state.elapsed,received);}
 const mineIds=new Set((state.mines||[]).map(m=>m.id));for(let i=mines.length-1;i>=0;i--)if(!mineIds.has(mines[i].netId)){disposeCurryMine(mines[i]);mines.splice(i,1);}for(const data of state.mines||[]){let mine=mines.find(m=>m.netId===data.id);if(!mine)mine=addCurryMine({...data,netId:data.id});Object.assign(mine,data);mine.root.children[0].material.emissiveIntensity=mine.arm>0?.15:.65;}updateCurryMineVisibility();
 const gasIds=new Set((state.gases||[]).map(g=>g.id));for(let i=gases.length-1;i>=0;i--)if(!gasIds.has(gases[i].netId)){disposeExhaust(gases[i]);gases.splice(i,1);}for(const data of state.gases||[]){let gas=gases.find(g=>g.netId===data.id);if(!gas){gas={netId:data.id,root:createExhaustVisual()};gases.push(gas);scene.add(gas.root);}Object.assign(gas,data);exhaustVisual(gas);netTrackEffect(gas,state.elapsed,received);}
 const activeIds=new Set(state.cars.map(c=>c.id));
 for(let i=cars.length-1;i>=0;i--)if(!activeIds.has(cars[i].netId)){disposeCarVisual(cars[i].root);cars.splice(i,1);}
 for(const data of state.cars){let car=cars.find(c=>c.netId===data.id);if(!car){car={netId:data.id,root:createCarVisual()};cars.push(car);scene.add(car.root);}Object.assign(car,data);car.root.position.set(car.x,0,car.z);car.root.rotation.y=car.angle;car.root.scale.setScalar(car.active?1:Math.max(.02,car.fade/.3));netTrackEffect(car,state.elapsed,received);}
 for(const event of state.events||[]){if(event.id<=netGame.seenEvent)continue;netGame.seenEvent=event.id;if(event.type==='cat-sound')catSound(event,event.fighting);if(event.type==='cat-scratch-stun'&&event.slot===netSlot())toast('被传说橘猫三连挠中 · 眩晕 3 秒');if(event.type==='cat-stun'&&event.slot===netSlot())toast('哈基米们打起来了！眩晕 3 秒');if(event.type==='red-eye-caught'&&event.slot===netSlot())toast('被红眼女抓住 · 顶住鞋底 15 秒，暂时无法行动');if(event.type==='kuchi-kick')tone(95,.14,.07,'triangle');if(event.type==='mailisu-hit'&&role==='survivor'&&event.slot===playerIndex)toast('踩中麦丽素 · 移速降低 50%，持续 5 秒');if(event.type==='feed')feed(event.message);if(event.type==='echo-pop'){ringEffect(event.x,event.z,'#eac273',2);tone(150,.15,.05);}if(event.type==='pig-blast'){ringEffect(event.x,event.z,'#f4ac8f',5);playExplosionSound(event);}if(event.type==='hurt')playHurtSound(slotActor(event.slot));if(event.type==='teleport')showTeleport(event);if(event.type==='drive-start'&&role==='hunter'){camYaw=event.angle-Math.PI;}if(event.type==='car-explosion')carExplosion(event.x,event.z);if(event.type==='curry-blast'){ringEffect(event.x,event.z,'#ffb66c',5);tone(65,.35,.09,'triangle');}}

}
function netTrackEffect(effect,time,now){let track=netGame.tracks.get(effect);if(!track){track=new MotionTrack();netGame.tracks.set(effect,track);}track.push(time,{x:effect.x,z:effect.z,angle:effect.angle,moving:effect.active,state:'active'},now);}
function adaptNetworkRendering(){
 if(!netIsHost()||netGame.quality>=3)return;
 netGame.slowWindows=netGame.fps<35?netGame.slowWindows+1:0;
 if(netGame.slowWindows<2)return;
 netGame.slowWindows=0;netGame.quality++;
 renderer.shadowMap.autoUpdate=false;
 renderer.setPixelRatio(Math.min(devicePixelRatio,[1.6,1,.75,.55][netGame.quality]));renderer.setSize(innerWidth,innerHeight);
}
function netFrame(dt){
 if(!netGame.playing)return;
 const now=performance.now();netGame.frameCount++;netGame.frameTime+=netGame.fpsStamp?Math.max(0,(now-netGame.fpsStamp)/1000):dt;netGame.fpsStamp=now;if(netGame.frameTime>=1){netGame.fps=Math.round(netGame.frameCount/netGame.frameTime);netGame.frameTime=0;netGame.frameCount=0;adaptNetworkRendering();}
 if(netIsHost()){
  netGame.snapshotTime-=dt;if(netGame.snapshotTime<=0){netSend({type:'snapshot',state:netSnapshot()});netGame.snapshotTime=Math.max(-.1,netGame.snapshotTime)+.1;}
  for(const peer of netGame.room.players){if(peer.id===netGame.id)continue;const actor=slotActor(peer.slot);let track=netGame.tracks.get(actor);if(!track){track=new MotionTrack(.08);netGame.tracks.set(actor,track);}track.push(elapsed,actor,now);const pose=track.pose(dt,now);if(pose){actor.group.position.x=pose.x;actor.group.position.z=pose.z;}}
 }else{
  if(!netGame.menu){if(keys.arrowleft)camYaw+=dt*1.7;if(keys.arrowright)camYaw-=dt*1.7;}
  if(!netGame.prediction){netGame.prediction=new LocalPrediction(obs,role==='hunter',driveObstacles());netGame.prediction.reset(current());}
  netGame.inputAccumulator=Math.min(.12,netGame.inputAccumulator+dt);
  const directReady=peerNetwork?.stats().mode==='direct';const input={keys:netGame.menu||!directReady?{}:keys,yaw:camYaw,touch:netGame.menu||!directReady?{x:0,z:0}:touchMove,jumpPress,fPress};
  while(netGame.inputAccumulator>=INPUT_STEP){netGame.prediction.push(input,INPUT_STEP,now);netGame.inputAccumulator-=INPUT_STEP;}
  const signature=['w','a','s','d','f','q',' '].map(k=>input.keys[k]?'1':'0').join('')+':'+fPress+':'+jumpPress;
  if(signature!==netGame.controlKeys){netGame.controlKeys=signature;netSend({type:'control',input:{...input,seq:netGame.prediction.sequence,serial:++netGame.controlSerial}});}
  netGame.sendTime-=dt;if(netGame.sendTime<=0){const commands=netGame.prediction.outgoing();netSend({type:'input',input:{...input,commands,seq:netGame.prediction.sequence,serial:++netGame.controlSerial}});netGame.sendTime=Math.max(-.04,netGame.sendTime)+.04;}
  netGame.localPose=netGame.prediction.pose(dt);
  for(const actor of [hunter,...allSurvivors()]){
   const pose=actor===current()?netGame.localPose:netGame.tracks.get(actor)?.pose(dt,now);
   const moving=actor.moving,angle=actor.angle,jumpTime=actor.jumpTime;if(pose){actor.moving=pose.moving;actor.angle=pose.angle;actor.jumpTime=pose.jumpTime??actor.jumpTime;}animateActor(actor,dt);actor.moving=moving;actor.angle=angle;actor.jumpTime=jumpTime;
   if(pose){actor.group.position.x=pose.x;actor.group.position.z=pose.z;actor.group.position.y=curryFlightHeight(pose)+jumpHeight(pose);if(actor===hunter)applyDriverPose(actor,pose);}
  }
  for(const effect of [...cars,...gases,...pigs]){const pose=netGame.tracks.get(effect)?.pose(dt,now);if(pose&&!effect.driven)effect.root.position.set(pose.x,effect.root.position.y,pose.z);}
  const live=new Set([hunter,...allSurvivors(),...cars,...gases,...pigs,...redEyes,...cats,kuchi]);for(const key of netGame.tracks.keys())if(!live.has(key))netGame.tracks.delete(key);
  const danger=role==='survivor'&&isHunterNearby(current(),hunter);$('danger').style.opacity=danger?'1':'0';$('vignette').classList.toggle('danger',danger);
  uiTime-=dt;if(uiTime<=0){updateHUD();uiTime=.1;}
 }
 const status=$('net-status');if(status){status.classList.remove('hidden');status.title='纯 P2P：所有对局数据直接连接房主，没有服务器或中继备用。操作确认包含房主处理与同步等待。';const relay=netGame.relayRtt===null?'--':Math.round(netGame.relayRtt);const path=peerNetwork?.stats();const route=path?.mode==='direct'?`P2P直连 ${Math.round(path.rtt||0)} ms`:'等待P2P直连（无中继）';status.textContent=netIsHost()?`房主 ${netGame.fps} FPS · P2P直连 ${path?.direct||0}/${path?.total||0} · 仅P2P`:now-netGame.receivedAt>1800?`${route} · 等待房主同步`:`${route} · 操作确认 ${Math.round(netGame.prediction?.rtt||0)} ms · 本机 ${netGame.fps} / 房主 ${netGame.hostFps??'--'} FPS`;}
}

let explosionBuffers=[],explosionLoading;
function unlockExplosionAudio(){audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();explosionLoading??=Promise.all([1,2,3,4].map(i=>fetch(`./assets/audio/mc-explode-${i}.ogg`).then(r=>{if(!r.ok)throw Error('explosion audio missing');return r.arrayBuffer();}).then(b=>audio.decodeAudioData(b)))).then(b=>explosionBuffers=b).catch(e=>console.error(e));return explosionLoading;}
function playExplosionSound(point){if(!sound||distance(point,current())>28)return;unlockExplosionAudio().then(()=>{if(!sound||!explosionBuffers.length||!['playing','paused'].includes(mode))return;const source=audio.createBufferSource(),gain=audio.createGain();source.buffer=explosionBuffers[Math.floor(Math.random()*explosionBuffers.length)];gain.gain.value=.85*Math.max(.08,1-distance(point,current())/28);source.connect(gain);gain.connect(audio.destination);source.start();document.body.dataset.explosionSounds=String((Number(document.body.dataset.explosionSounds)||0)+1);});}
let hurtBuffer,hurtLoading;
let jumpBuffer,jumpLoading;
function unlockJumpAudio(){audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();jumpLoading??=fetch('./assets/audio/mario-jump.oga').then(r=>{if(!r.ok)throw Error('jump audio missing');return r.arrayBuffer();}).then(b=>audio.decodeAudioData(b)).then(b=>jumpBuffer=b).catch(e=>console.error(e));return jumpLoading;}
function updateJumpAudio(){
 if(!['playing','paused'].includes(mode))return;
 for(const actor of [hunter,...allSurvivors()]){const pose=netGame.playing&&!netIsHost()&&actor===current()?netGame.prediction?.actor||actor:actor,serial=pose.jumpSerial||0;if(serial<=(jumpSoundsSeen.get(actor)||0))continue;jumpSoundsSeen.set(actor,serial);if(!sound||distance(actor,current())>20)continue;
  unlockJumpAudio().then(()=>{if(!jumpBuffer||!sound)return;const source=audio.createBufferSource(),gain=audio.createGain();source.buffer=jumpBuffer;gain.gain.value=actor===current()?.65:Math.max(.03,.5*(1-distance(actor,current())/20));source.connect(gain);gain.connect(audio.destination);source.start();document.body.dataset.jumpSounds=String((Number(document.body.dataset.jumpSounds)||0)+1);});
 }
}
// Available only in the automated test scene; normal game URLs cannot mutate actors.
export function networkTestState(){if(!new URLSearchParams(location.search).has('network-test'))return null;return {...netSnapshot(),phantomSceneObjects:scene.children.filter(o=>o.name==='VRDancePhantom').length,phantomVisuals:vrPhantoms.map(p=>({id:p.id,visible:p.root.visible,x:p.root.position.x,z:p.root.position.z,dancing:p.root.userData.motion.actions.Dance.getEffectiveWeight()>.9,danceTime:p.root.userData.motion.actions.Dance.time,blocked:blocked(p.x,p.z,driveObstacles(),.65),headset:p.root.userData.motion.vrVisible,opacity:(()=>{const m=p.root.userData.motion.model.getObjectByProperty('isSkinnedMesh',true)?.material;return(Array.isArray(m)?m[0]:m)?.opacity;})(),skinned:!!p.root.getObjectByProperty('isSkinnedMesh',true)})),catSceneObjects:scene.children.filter(o=>['HakimiCat','HakimiComicFight'].includes(o.name)).length,catVisuals:cats.map(c=>({id:c.id,phase:c.phase,visible:c.root.visible,x:c.root.position.x,z:c.root.position.z,scaleY:c.root.scale.y,scaleX:c.root.scale.x,bristles:c.root.userData.bristles.visible,legendary:!!c.legendary,clip:c.root.userData.getClip?.()||null,swipeMask:c.root.userData.getSwipeMask?.()||0,slashVisible:!!c.root.userData.slashes?.visible,skinned:!!c.root.getObjectByProperty('isSkinnedMesh',true),grooming:c.legendary?c.phase==='grooming':c.root.userData.paws[3].rotation.x< -1,meshes:c.root.children.length})),catFightVisuals:catFights.map(f=>({id:f.id,phase:f.phase,visible:!!f.root?.visible,cloud:!!f.root?.userData.cloud.visible,puffs:f.root?.userData.puffs.length||0})),vrVisual:{headset:hunter.motion?.vrVisible||false,model:hunter.model.name,laserVisible:laserVisual?.visible||false,laserRange:hunter.laserRange||0},redEyeVisuals:redEyes.map(n=>({id:n.id,visible:n.root.visible,x:n.root.position.x,y:n.root.position.y,z:n.root.position.z,phase:n.phase,invincible:n.invincible,holdTarget:n.holdTarget})),shoePoses:[...survivors,hunter].map(a=>({id:redEyeActorId(a),weight:a.motion?.shoeWeight||0,head:a.motion?.headTop?.()?.y??null})),initialSpawns,pigVisuals:pigs.map(p=>({id:p.id,visible:p.root.visible,x:p.root.position.x,y:p.root.position.y,z:p.root.position.z,legs:p.root.userData.legs.length})),explosionSounds:Number(document.body.dataset.explosionSounds)||0,cameraOcclusion:cameraOcclusion?.stats(),carCollision:carBlocked(hunter,driveObstacles()),renderEchoes:echoes.map(e=>({id:e.id,x:e.group.position.x,z:e.group.position.z,visible:e.group.visible,clip:e.motion?.current,skinned:!!e.model?.getObjectByProperty('isSkinnedMesh',true)})),kuchiVisual:kuchiRig?{visible:kuchiRig.model.visible,x:kuchiRig.model.position.x,z:kuchiRig.model.position.z,clip:kuchiRig.current,stunned:kuchiRig.stunEffect.visible,skins:!!kuchiRig.model.getObjectByName('Kuchi_original_dog')}:null,mailisuCount:mailisu.length,mailisuVisible:mailisuVisuals.size,previewCompanion:$('model-view').dataset.companion||'',jumpSounds:Number(document.body.dataset.jumpSounds)||0,extraCoverCount:EXTRA_COVER.length,carVisuals:cars.map(c=>({x:c.root.position.x,y:c.root.position.y,z:c.root.position.z,rx:c.root.rotation.x,ry:c.root.rotation.y,rz:c.root.rotation.z,active:c.active,phase:c.phase})),hunterVisual:{y:hunter.group.position.y,rx:hunter.group.rotation.x,rz:hunter.group.rotation.z,modelX:hunter.model.position.x,modelScale:hunter.model.scale.x},netStats:{p2p:peerNetwork?.stats()??null,relayRtt:netGame.relayRtt,hostFps:netGame.hostFps,streams:netGame.streams,quality:netGame.quality,queues:[...netGame.queues.entries()].map(([slot,q])=>({slot,queuedMs:Math.round(q.queuedSeconds*1000),dropped:q.dropped})),fps:netGame.fps,rtt:netGame.prediction?.rtt||0,pending:netGame.prediction?.pending.length||0,snapshotAge:performance.now()-netGame.receivedAt},renderActors:[...survivors,hunter].map(a=>({x:a.group.position.x,y:a.group.position.y,z:a.group.position.z,angle:a.group.rotation.y,kickWeight:a.motion?.kickWeight||0,jumpWeight:a.motion?.jumpWeight||0})),mineVisibility:mines.map(m=>({id:m.netId,ownerSlot:m.ownerSlot,visible:m.root.visible})),mode,mouseLocked:!!mouseCapture?.locked(),camera:{yaw:camYaw,pitch:camPitch,distance:camDistance,x:camera.position.x,y:camera.position.y,z:camera.position.z},slot:netSlot(),eatingSounds:Number(document.body.dataset.eatingSounds)||0,hurtSounds:Number(document.body.dataset.hurtSounds)||0,obiwanModels:survivors.map(s=>!!s.model?.getObjectByName('Survivor_obiwan')),longLegModels:survivors.map(s=>!!s.model?.getObjectByName('Survivor_longleg'))};}
export function networkTestConfigure(options){if(!new URLSearchParams(location.search).has('network-test')||(netGame.playing&&!netIsHost()&&Object.keys(options).some(key=>key!=='camera')))throw Error('Test scene required');if(options.freezeAI!==undefined)testFreezeAI=!!options.freezeAI;if(options.clearCats)clearCats();if(options.cats){clearCats();for(const data of options.cats)addCat({...createCat(data.id,data,()=>.5),...data});}if(options.clearRedEyes)clearRedEyes();if(options.redEyes)for(const data of options.redEyes){const npc=redEyes.find(n=>n.id===data.id);if(npc)Object.assign(npc,data);}if(options.clearPigs)clearPigs();if(options.spawnPig){const owner=options.spawnPig.ownerSlot>=100?echoes.find(e=>e.id===options.spawnPig.ownerSlot):survivors[options.spawnPig.ownerSlot??2];Object.assign(summonPig(owner),options.spawnPig);}if(options.pigs)for(const data of options.pigs){const pig=pigs.find(p=>p.id===data.id);if(pig)Object.assign(pig,data);}if(options.camera){camYaw=options.camera.yaw??camYaw;camPitch=clamp(options.camera.pitch??camPitch,CAMERA_MIN_PITCH,CAMERA_MAX_PITCH);camDistance=clamp(options.camera.distance??camDistance,CAMERA_MIN_DISTANCE,CAMERA_MAX_DISTANCE);teleportCameraPending=true;}if(options.elapsed!==undefined)elapsed=options.elapsed;if(options.clearEchoes)clearEchoes();if(options.echoes)for(const data of options.echoes){const e=echoes.find(a=>a.id===data.id);if(e)Object.assign(e,data);}if(options.clearMailisu)mailisu.length=0;if(options.mailisu)mailisu.push(...options.mailisu);if(options.kuchi&&kuchi)Object.assign(kuchi,options.kuchi);if(options.stopCar)clearCars();if(options.placeMine)addCurryMine({...options.placeMine,ownerSlot:options.placeMine.ownerSlot??0,arm:options.placeMine.arm??0});if(options.hunter?.hunterCharacter!==undefined&&options.hunter.hunterCharacter!==hunter.hunterCharacter)setHunterCharacter(options.hunter.hunterCharacter);if(options.hunter)Object.assign(hunter,options.hunter);for(const [id,state] of Object.entries(options.survivors||{}))Object.assign(survivors[Number(id)],state);for(const [id,state] of Object.entries(options.chests||{})){Object.assign(chests[Number(id)],state);updateChestVisual(chests[Number(id)]);}if(options.gens)options.gens.forEach((progress,i)=>{if(gens[i])gens[i].progress=progress;});for(const slot of options.captureSlots||[])capture(survivors[slot]);if(options.captureAll)survivors.forEach(s=>capture(s));updateHUD();}
function unlockHurtAudio(){audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();hurtLoading??=fetch('./assets/audio/steve-classic-hurt.ogg').then(r=>{if(!r.ok)throw Error('hurt audio missing');return r.arrayBuffer();}).then(b=>audio.decodeAudioData(b)).then(b=>hurtBuffer=b).catch(e=>console.error(e));return hurtLoading;}
function playHurtSound(actor){
 if(!sound)return;
 const distanceToListener=distance(actor,current());if(distanceToListener>20)return;
 unlockHurtAudio().then(()=>{if(!hurtBuffer||!sound)return;const source=audio.createBufferSource(),gain=audio.createGain();source.buffer=hurtBuffer;gain.gain.value=actor===current()?.8:Math.max(.1,.65*(1-distanceToListener/20));source.connect(gain);gain.connect(audio.destination);source.start();document.body.dataset.hurtSounds=String((Number(document.body.dataset.hurtSounds)||0)+1);});
}


let eatingBuffers=[],eatingLoading;const eatingVoices=new Map();
function unlockEatingAudio(){
 audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();
 eatingLoading??=Promise.all([1,2,3].map(i=>fetch(`./assets/audio/mc-eat-${i}.ogg`).then(r=>{if(!r.ok)throw Error('eating audio missing');return r.arrayBuffer();}).then(data=>audio.decodeAudioData(data)))).then(buffers=>{eatingBuffers=buffers;}).catch(e=>console.error(e));return eatingLoading;
}
function updateEatingAudio(dt){
 for(const actor of allSurvivors()){
  const audible=mode==='playing'&&sound&&actor.state==='active'&&(actor.mealActive||actor.eating>0)&&distance(actor,current())<20;
  let voice=eatingVoices.get(actor);
  if(!audible){if(voice){for(const source of voice.sources){try{source.stop();}catch{}}eatingVoices.delete(actor);}continue;}
  if(!eatingBuffers.length){unlockEatingAudio();continue;}
  if(!voice){voice={next:0,sources:new Set()};eatingVoices.set(actor,voice);}voice.next-=dt;if(voice.next>0)continue;voice.next=.3;
  const source=audio.createBufferSource(),gain=audio.createGain();source.buffer=eatingBuffers[Math.floor(Math.random()*eatingBuffers.length)];gain.gain.value=actor===current()?.6:Math.max(.03,.4*(1-distance(actor,current())/20));source.connect(gain);gain.connect(audio.destination);voice.sources.add(source);source.onended=()=>voice.sources.delete(source);source.start();document.body.dataset.eatingSounds=String((Number(document.body.dataset.eatingSounds)||0)+1);
 }
}

try{buildWorld();cameraOcclusion=createCameraOcclusion(scene);for(let i=0;i<4;i++){makeSurvivor(i).group.visible=false;}initEvents();initMultiplayer();document.addEventListener('pointerdown',()=>unlockHurtAudio(),{once:true});await Promise.all([makeHunter(),loadSurvivorModels(),loadKuchi(),loadLegendaryCat()]);characterPreview=createCharacterPreview($('model-view'));selectionLobby=createSelectionLobby({names:SURVIVOR_NAMES,onChoose(id){if(id>=6){$('hunter-choice').value=String(id-6);if(role!=='hunter')$('hunter-role').click();else $('hunter-choice').onchange();return;}if(role==='survivor'&&Number($('survivor-choice').value)===id)return;$('survivor-choice').value=String(id);if(role!=='survivor')setRole('survivor');$('survivor-choice').onchange();}});updateLobbyCharacter();$('start').disabled=false;$('start-text').textContent='进入惊魂夜';requestAnimationFrame(frame);}catch(e){console.error(e);$('error-message').textContent=`${e.message}。请使用支持 WebGL 的现代浏览器。`;show('error');}

export function networkTestP2P(enabled){if(!new URLSearchParams(location.search).has('network-test'))throw Error('Test scene required');if(enabled!==undefined)peerNetwork?.setEnabled(enabled);return peerNetwork?.stats()??null;}

export async function networkTestDirect(action,value){if(!new URLSearchParams(location.search).has('network-test'))throw Error('Test scene required');if(action==='invite')return peerNetwork.createInvitation();if(action==='response')return peerNetwork.importResponse(value);return peerNetwork?.stats()??null;}

export function networkTestImpairment(config){
 if(!new URLSearchParams(location.search).has('network-test'))throw Error('Test scene required');
 if(!peerNetwork.testFault){const original=peerNetwork.realtime.bind(peerNetwork),fault={enabled:false,received:0,dropped:0};peerNetwork.testFault=fault;peerNetwork.realtime=async(p,data)=>{if(!fault.enabled)return original(p,data);fault.received++;fault.seed=(Math.imul(fault.seed,1664525)+1013904223)>>>0;const random=fault.seed/4294967296,elapsed=performance.now()-fault.started;if(random<fault.loss||elapsed%fault.period<fault.burst){fault.dropped++;return;}await new Promise(resolve=>setTimeout(resolve,fault.delay+random*fault.jitter));return original(p,data);};}
 const fault=peerNetwork.testFault;if(config){Object.assign(fault,{enabled:config.enabled!==false,loss:config.loss||0,burst:config.burstMs||0,period:config.periodMs||100000,delay:config.delayMs||0,jitter:config.jitterMs||0,seed:config.seed||12345,started:performance.now(),received:0,dropped:0});}return {enabled:fault.enabled,received:fault.received,dropped:fault.dropped};
}

import {HUNTERS} from './vr-hunter.mjs';
const slugs=['baige','2980','zhulian','songyuying','longleg','obiwan','olo'];
const hunterStart=slugs.length;
const portrait=id=>id===1?'./assets/portraits/2980.jpg':id>=hunterStart?HUNTERS[id-hunterStart].portrait:`./assets/portraits/${slugs[id]}.png`;
const element=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
function avatar(id){const frame=element('span','selection-avatar'),img=element('img');img.src=portrait(id);frame.dataset.character=String(id);if(id<hunterStart)frame.classList.add('photo-avatar');if(id===hunterStart+1)img.style.cssText='height:100%;top:0;object-fit:cover;object-position:50% 52%';img.alt='';img.draggable=false;frame.append(img);return frame;}

export function createSelectionLobby({names,onChoose}){
 const pool=document.getElementById('character-pool'),list=document.getElementById('room-players'),cards=[];
 [...names,...HUNTERS.map(h=>h.name)].forEach((name,id)=>{
  const button=element('button','character-card');button.type='button';button.dataset.character=String(id);button.setAttribute('aria-label',`选择${name}`);
  button.append(avatar(id),element('strong','',name),element('span','card-state'));
  button.onclick=()=>{if(!button.disabled)onChoose(id);};pool.append(button);cards.push(button);
 });
 return {update({role,index,hunterIndex=0,room,id,ready}){
  const selected=role==='hunter'?hunterStart+hunterIndex:index,own=room?.players.find(p=>p.id===id),locked=room?.phase==='playing';
  const occupied=new Map((room?.players||[]).filter(p=>p.id!==id).map(p=>[p.slot===4?hunterStart+(p.hunterCharacter||0):p.character??p.slot,p]));
  cards.forEach((card,i)=>{
   const used=i>=hunterStart?(room?.players||[]).find(p=>p.id!==id&&p.slot===4):occupied.get(i);card.hidden=role==='hunter'?i<hunterStart:i>=hunterStart;
   card.disabled=!ready||!!locked||!!used;card.classList.toggle('selected',i===selected);card.classList.toggle('occupied',!!used);
   card.setAttribute('aria-pressed',String(i===selected));card.querySelector('.card-state').textContent=used?'已被选择':i===selected?'当前选择':'';
   card.title=used?`${used.name} 已选择${i>=hunterStart?HUNTERS[i-hunterStart].name:names[i]}`:'';
  });
  document.getElementById('pool-count').textContent=role==='hunter'?'02 / 追杀者':'07 / 逃生者';
  document.getElementById('selection-faction').textContent=role==='hunter'?'追杀者 · 追击 / 囚禁':'逃生者 · 协作 / 逃离';
  document.getElementById('team-mode').textContent=room?`${room.players.length} / 5 人已加入`:'单人对局 · AI 补位';
  document.getElementById('selection-room-hint').textContent=room?'选角会同步给房间内所有玩家':'邀请朋友联机，或直接开始与 AI 对局';
  document.getElementById('start').classList.toggle('hidden',!!room);
  document.getElementById('net-room').classList.toggle('hidden',!room);
  document.getElementById('net-open').textContent=room?'房间信息':'多人联机';
  const choices=new Map();
  if(room){for(const p of room.players)if(p.slot!==4)choices.set(p.slot,p.character??p.slot);}
  else if(role==='survivor')choices.set(Math.min(3,index),index);
  const used=new Set(choices.values());for(let slot=0;slot<4;slot++){if(!choices.has(slot)){const choice=!used.has(slot)?slot:names.findIndex((_,i)=>!used.has(i));choices.set(slot,choice);used.add(choice);}}
  list.replaceChildren();
  for(let slot=0;slot<5;slot++){
   const player=room?.players.find(p=>p.slot===slot),local=room?player?.id===id:slot===(role==='hunter'?4:Math.min(3,index));
   const character=slot===4?hunterStart+(player?.hunterCharacter??hunterIndex):player?.character??choices.get(slot),name=character>=hunterStart?HUNTERS[character-hunterStart].name:names[character];
   const row=element('div',`room-player selection-player${local?' is-you':''}${slot===4?' is-hunter':''}`);row.dataset.slot=String(slot);row.dataset.character=String(character);
   const details=element('div','selection-player-info'),title=element('strong','',name),nickname=element('span','',player?`${player.name}${local?' · 你':''}`:local?'你':'AI 补位');
   details.append(title,nickname);
   const status=element('small','selection-player-status',player?(player.id===room.hostId?'房主':player.ready?'已准备':'未准备'):local?'已选择':'AI');
   if(player?.ready||local&&!room)status.classList.add('is-ready');
   row.append(avatar(character),details,status);list.append(row);
  }
 }};
}

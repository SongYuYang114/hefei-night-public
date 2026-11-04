// Public address discovery only. No TURN, room server or data relay.
export const DIRECT_ICE_SERVERS=[{urls:'stun:stun.cloudflare.com:3478'},{urls:'stun:stun.l.google.com:19302'}];
export function candidateSummary(sdp=''){
 const result={host:0,srflx:0,relay:0,publicIPv4:0,publicIPv6:0,virtual:0,total:0};
 for(const line of sdp.split(/\r?\n/)){
  if(!line.startsWith('a=candidate:'))continue;const fields=line.slice(2).trim().split(/\s+/),address=fields[4],type=fields[fields.indexOf('typ')+1];
  result.total++;if(Object.hasOwn(result,type))result[type]++;
  if(type!=='host')continue;
  const v4=/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(address||'');
  if(v4){const a=Number(v4[1]),b=Number(v4[2]);if(a===198&&(b===18||b===19))result.virtual++;else if(!(a===0||a===10||a===127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a>=224))result.publicIPv4++;}
  else if(/^[23][0-9a-f]{3}:/i.test(address||''))result.publicIPv6++;
 }
 return result;
}
export async function collectCandidates(pc,timeoutMs=15000){
 if(pc.iceGatheringState!=='complete')await new Promise(resolve=>{
  let timer;const finish=()=>{clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',change);pc.removeEventListener('connectionstatechange',change);resolve();};
  const change=()=>{if(pc.iceGatheringState==='complete'||['connected','closed','failed'].includes(pc.connectionState))finish();};
  pc.addEventListener('icegatheringstatechange',change);pc.addEventListener('connectionstatechange',change);timer=setTimeout(finish,timeoutMs);change();
 });
 return {complete:pc.iceGatheringState==='complete',...candidateSummary(pc.localDescription?.sdp)};
}
export function connectionDiagnosis(connections){
 const failed=connections.find(p=>['failed','closed'].includes(p.state)||p.ice==='failed');
 const waiting=connections.find(p=>p.waitingResponse),checking=connections.find(p=>!p.direct&&!p.waitingResponse);
 const virtual=connections.some(p=>p.local.virtual||p.remote.virtual);
 const base={virtualAddressDetected:virtual};
 const advice=virtual?'检测到虚拟网卡地址。请双方退出 VPN／加速器，重启游戏后重新交换邀请和回应。':'请检查双方网络、防火墙，或更换房主／手机热点，然后重新交换邀请和回应。';
 if(failed)return {...base,code:'ice-failed',message:'P2P 路径验证失败。'+advice+'当前没有中继备用。'};
 const noPublic=p=>p.total>0&&!p.srflx&&!p.publicIPv4&&!p.publicIPv6;
 if(checking&&(noPublic(checking.local)||noPublic(checking.remote)))return {...base,code:'no-public-address',message:'尚未发现双方可用的公网地址，跨网络可能无法连接。'+advice};
 if(checking&&checking.waitingMs>45000)return {...base,code:'connection-timeout',message:'直连长时间未完成；请确认房主已导入回应。'+advice};
 if(waiting)return {...base,code:'waiting-response',message:'邀请已生成，等待房主导入玩家返回的回应。'+(virtual?'检测到虚拟网卡；无法直连时请先退出 VPN／加速器再重新生成。':'')};
 if(checking)return {...base,code:'checking',message:'正在验证 P2P 路径。'+(virtual?'检测到虚拟网卡；若无法连接，请退出 VPN／加速器后重新交换信息。':'')};
 return {...base,code:connections.length?'connected':'idle',message:connections.length?'P2P 直连已建立。':'为每位玩家分别生成邀请。'};
}

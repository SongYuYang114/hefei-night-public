const BAD=new Set(['__proto__','constructor','prototype']);
export const MAX_FRAME=256*1024;
export function stateDiff(before,after){
 if(Object.is(before,after))return null;
 if(before&&after&&typeof before==='object'&&typeof after==='object'&&Array.isArray(before)===Array.isArray(after)&&(!Array.isArray(after)||before.length===after.length)){
  const changes={};for(const key of Object.keys(after)){if(BAD.has(key))throw Error('Invalid state key');const p=stateDiff(before[key],after[key]);if(p)changes[key]=p;}const removed=Object.keys(before).filter(k=>!Object.hasOwn(after,k));return Object.keys(changes).length||removed.length?[1,changes,removed]:null;
 }
 return [0,after];
}
export function statePatch(before,delta,depth=0){
 if(depth>64||!Array.isArray(delta))throw Error('Invalid patch');if(delta[0]===0)return delta[1];
 if(delta[0]!==1||!before||typeof before!=='object'||!delta[1]||typeof delta[1]!=='object'||!Array.isArray(delta[2]))throw Error('Missing baseline');
 const result=Array.isArray(before)?before.slice():{...before};for(const key of delta[2]){if(BAD.has(key))throw Error('Invalid key');delete result[key];}for(const [key,value]of Object.entries(delta[1])){if(BAD.has(key))throw Error('Invalid key');result[key]=statePatch(before[key],value,depth+1);}return result;
}
async function transform(bytes,Stream){
 const stream=new Blob([bytes]).stream().pipeThrough(new Stream('deflate-raw')),reader=stream.getReader(),parts=[];let size=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>MAX_FRAME)throw Error('Frame too large');parts.push(value);}}catch(e){await reader.cancel().catch(()=>{});throw e;}
 const result=new Uint8Array(size);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}return result;
}
export async function encodePacket(message){
 const raw=new TextEncoder().encode(JSON.stringify(message));if(raw.length>MAX_FRAME)throw Error('Frame too large');const compressed=raw.length>200?await transform(raw,CompressionStream):raw;
 const zipped=compressed.length<raw.length,body=zipped?compressed:raw,result=new Uint8Array(body.length+1);result[0]=zipped?1:0;result.set(body,1);return result;
}
export async function decodePacket(data){
 const bytes=new Uint8Array(data);if(bytes.length<2||bytes.length>MAX_FRAME||bytes[0]>1)throw Error('Invalid frame');const body=bytes[0]?await transform(bytes.subarray(1),DecompressionStream):bytes.subarray(1);return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body));
}
export function privateSnapshot(state,slot){return {...state,mailisu:slot===4?state.mailisu||[]:[],mines:(state.mines||[]).filter(m=>slot!==4&&Number.isInteger(m.ownerSlot)&&m.ownerSlot===slot)};}
export function cleanPeerInput(data){
 const controls=d=>({keys:Object.fromEntries(['w','a','s','d','f','q',' '].map(k=>[k,d?.keys?.[k]===true])),yaw:Number.isFinite(d?.yaw)?Math.max(-1e6,Math.min(1e6,d.yaw)):0,touch:{x:Math.max(-1,Math.min(1,Number(d?.touch?.x)||0)),z:Math.max(-1,Math.min(1,Number(d?.touch?.z)||0))},fPress:Number.isSafeInteger(d?.fPress)&&d.fPress>=0?d.fPress:0,jumpPress:Number.isSafeInteger(d?.jumpPress)&&d.jumpPress>=0?d.jumpPress:0});
 const input={...controls(data),serial:Number.isSafeInteger(data?.serial)&&data.serial>=0?data.serial:0,seq:Number.isSafeInteger(data?.seq)&&data.seq>=0?data.seq:0};
 if(Array.isArray(data?.commands))input.commands=data.commands.slice(-30).filter(c=>c&&Number.isSafeInteger(c.seq)&&c.seq>0&&Number.isFinite(c.dt)&&c.dt>0&&c.dt<=.04).map(c=>({seq:c.seq,dt:c.dt,...controls(c)}));return input;
}

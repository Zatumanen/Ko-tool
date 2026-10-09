/**
 * Passive, same-origin, read-only bridge for the authoritative EP device runtime.
 * This module never sends MIDI, acquires a device lock, or persists device status.
 * BroadcastChannel offers status between a legacy My EP tab and the OS preview.
 */
export const EP_STATUS_CHANNEL='speeduppercut-os-device-status-v1';
export const EP_STATUS_VERSION=1;
export const EP_STATUS_TTL_MS=6500;
const STATUSES=new Set(['disconnected','connecting','ready','reading','mutating','verifying','blocked','recovery-required','unsafe']);
const SAFETY=new Set(['safe','blocked','recovery-required','unsafe']);
const PHASES=new Set(['idle','reading','mutating','verifying']);
const CONNECTION=new Set(['disconnected','connecting','connected']);
const OWNERSHIP=new Set(['none','owned','blocked']);
const limited=(x,n=140)=>String(x??'').slice(0,n);
const statusOr=(value,allowed,fallback)=>allowed.has(value)?value:fallback;
const nullModel=()=>({status:'unavailable',connection:'disconnected',ownership:'none',safety:'safe',phase:'idle',sku:null,firmware:null,operation:null,reason:null,recoveryHydrated:false});
export function projectEpStatus(snapshot){
 const s=snapshot||{},connection=statusOr(s.connection?.status,CONNECTION,'disconnected');
 const connected=connection==='connected'&&s.connection?.device?.identityVerified===true;
 const ownership=statusOr(s.ownership?.status,OWNERSHIP,'none');
 const safety=statusOr(s.safety?.status,SAFETY,'unsafe');
 const phase=statusOr(s.operation?.phase,PHASES,'idle');
 const recoveryHydrated=s.recovery?.hydrated===true;
 let status=statusOr(s.status,STATUSES,'blocked');
 // Never infer "ready" from connected alone; ownership, identity and recovery hydration matter.
 if(status==='ready'&&(!connected||ownership!=='owned'||!recoveryHydrated||safety!=='safe'))status='blocked';
 if(safety==='unsafe')status='unsafe';
 else if(safety==='recovery-required')status='recovery-required';
 else if(safety==='blocked'||ownership==='blocked')status='blocked';
 const operation=PHASES.has(phase)&&phase!=='idle'?limited(s.operation?.active?.label||'FILE operation',110):null;
 return Object.freeze({
  status,connection,ownership,safety,phase,
  sku:connected?limited(s.connection.device.sku,40)||null:null,
  firmware:connected?limited(s.connection.device.firmware,60)||null:null,
  operation,reason:safety==='safe'?null:limited(s.safety?.reason,220)||null,
  recoveryHydrated
 });
}
export function parseEpStatusMessage(raw){
 if(!raw||raw.version!==EP_STATUS_VERSION||raw.type!=='status'||typeof raw.source!=='string'||raw.source.length>100||!raw.source)return null;
 if(!Number.isSafeInteger(raw.seq)||raw.seq<0||!raw.data||typeof raw.data!=='object')return null;
 const d=raw.data;
 if(!STATUSES.has(d.status)||!CONNECTION.has(d.connection)||!OWNERSHIP.has(d.ownership)||!SAFETY.has(d.safety)||!PHASES.has(d.phase))return null;
 if(![null,undefined].includes(d.sku)&&typeof d.sku!=='string')return null;
 if(![null,undefined].includes(d.firmware)&&typeof d.firmware!=='string')return null;
 if(![null,undefined].includes(d.operation)&&typeof d.operation!=='string')return null;
 if(![null,undefined].includes(d.reason)&&typeof d.reason!=='string')return null;
 // Normalize strings, never accept stale device info on a disconnected transport.
 const connected=d.connection==='connected';
 return {
  source:raw.source,seq:raw.seq,
  data:Object.freeze({
   status:d.status,connection:d.connection,ownership:d.ownership,safety:d.safety,phase:d.phase,
   sku:connected?limited(d.sku,40)||null:null,
   firmware:connected?limited(d.firmware,60)||null:null,
   operation:limited(d.operation,110)||null,reason:limited(d.reason,220)||null,
   recoveryHydrated:d.recoveryHydrated===true
  })
 };
}
const makeChannel=(Type,name)=>{try{return typeof Type==='function'?new Type(name):null;}catch{return null;}};
export function startEpStatusPublisher({
 runtime,Channel=globalThis.BroadcastChannel,
 setIntervalFn=globalThis.setInterval,clearIntervalFn=globalThis.clearInterval,
 source='legacy-'+(globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2))
}={}){
 if(!runtime?.getSnapshot||!runtime?.subscribe)throw new TypeError('Authoritative EP runtime is required');
 const channel=makeChannel(Channel,EP_STATUS_CHANNEL);
 if(!channel)return Object.freeze({supported:false,dispose(){}});
 let seq=0,closed=false;
 const send=()=>{
  if(closed)return;
  channel.postMessage({version:EP_STATUS_VERSION,type:'status',source,seq:++seq,data:projectEpStatus(runtime.getSnapshot())});
 };
 const onMessage=event=>{if(event?.data?.version===EP_STATUS_VERSION&&event.data.type==='request')send();};
 channel.addEventListener('message',onMessage);
 const unsubscribe=runtime.subscribe(send);
 const timer=setIntervalFn(send,1700);
 send();
 return Object.freeze({supported:true,dispose(){
  if(closed)return;closed=true;clearIntervalFn(timer);unsubscribe();channel.removeEventListener('message',onMessage);
  try{channel.postMessage({version:EP_STATUS_VERSION,type:'leave',source});}catch{}
  channel.close();
 }});
}
export function startEpStatusReceiver({
 Channel=globalThis.BroadcastChannel,now=()=>Date.now(),
 setIntervalFn=globalThis.setInterval,clearIntervalFn=globalThis.clearInterval,
 onChange=()=>{},ttlMs=EP_STATUS_TTL_MS
}={}){
 const channel=makeChannel(Channel,EP_STATUS_CHANNEL);
 if(!channel){onChange(null);return Object.freeze({supported:false,dispose(){},getSnapshot:()=>null});}
 const sources=new Map();
 let current=null,closed=false;
 const rank=d=>{
  if(d.status==='unsafe')return 10;
  if(d.status==='recovery-required')return 9;
  if(d.connection==='connected'&&d.ownership==='owned')return 8;
  if(d.status==='blocked')return 7;
  if(d.status==='connecting')return 5;
  if(d.status==='disconnected')return 2;
  return 1;
 };
 const refresh=()=>{
  if(closed)return;
  const cutoff=now()-ttlMs;
  for(const [id,entry] of sources)if(entry.lastSeen<cutoff)sources.delete(id);
  const next=[...sources.values()].sort((a,b)=>rank(b.data)-rank(a.data)||b.lastSeen-a.lastSeen)[0]?.data||null;
  const old=JSON.stringify(current),nextKey=JSON.stringify(next);
  current=next;
  if(old!==nextKey)onChange(current);
 };
 const onMessage=event=>{
  const raw=event?.data;
  if(raw?.version===EP_STATUS_VERSION&&raw.type==='leave'&&typeof raw.source==='string'){
   sources.delete(raw.source);refresh();return;
  }
  const incoming=parseEpStatusMessage(raw);
  if(!incoming)return;
  const previous=sources.get(incoming.source);
  if(previous&&incoming.seq<=previous.seq)return;
  sources.set(incoming.source,{seq:incoming.seq,data:incoming.data,lastSeen:now()});
  refresh();
 };
 channel.addEventListener('message',onMessage);
 const timer=setIntervalFn(refresh,1000);
 onChange(null);
 channel.postMessage({version:EP_STATUS_VERSION,type:'request'});
 return Object.freeze({supported:true,getSnapshot:()=>current,dispose(){
  if(closed)return;closed=true;clearIntervalFn(timer);channel.removeEventListener('message',onMessage);channel.close();sources.clear();current=null;
 }});
}
export function describeEpStatus(data){
 if(!data)return {label:'NO LIVE SESSION',detail:'Open My EP in another tab to connect',tone:'idle'};
 const names={TE032AS001:'EP-133 KO II',TE032AS005:'EP-1320',TE032AS006:'EP-40'};
 const model=data.sku?(names[data.sku]||data.sku):'EP DEVICE';
 const suffix=data.firmware?' · FW '+data.firmware:'';
 const risk=['unsafe','recovery-required','blocked'].includes(data.status);
 const labels={
  disconnected:'DISCONNECTED',connecting:'CONNECTING',ready:'READY',
  reading:'READING',mutating:'WRITING',verifying:'VERIFYING',
  blocked:'BLOCKED', 'recovery-required':'RECOVERY REQUIRED',unsafe:'UNSAFE'
 };
 const text=labels[data.status]||'UNVERIFIED';
 return {
  label:(data.connection==='connected'?model+' · ':'')+text,
  detail:risk?(data.reason||'Open Device diagnostics before continuing'):
   data.operation||((data.connection==='connected'?model+suffix:'No device connected in the live My EP session')),
  tone:data.status==='ready'?'ready':risk?'danger':['reading','mutating','verifying','connecting'].includes(data.status)?'busy':'idle'
 };
}

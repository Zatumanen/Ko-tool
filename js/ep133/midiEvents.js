// Standard complete Web MIDI messages only; never parses SysEx or infers musical position.
export function decodeMidiEvent(data){
 if(!(data instanceof Uint8Array)&&!Array.isArray(data))return null;
 if(![1,3].includes(data.length)||!Array.from(data).every(n=>Number.isInteger(n)&&n>=0&&n<=255))return null;
 const status=data[0],kind=status&0xF0;
 const bytes=Object.freeze(Array.from(data));
 if(kind===0x80||kind===0x90){
  if(data.length!==3||data[1]>127||data[2]>127)return null;
  return Object.freeze({type:kind===0x80||data[2]===0?'note-off':'note-on',channel:(status&15)+1,note:data[1],velocity:data[2],data:bytes});
 }
 if(status===0xF2){
  if(data.length!==3||data[1]>127||data[2]>127)return null;
  return Object.freeze({type:'song-position',channel:null,position:data[1]|(data[2]<<7),data:bytes});
 }
 const type=({248:'clock',250:'start',251:'continue',252:'stop'})[status];
 return type&&data.length===1?Object.freeze({type,channel:null,data:bytes}):null;
}

// Opt-in, bounded per-subscriber rings. No timer runs until a real accepted message arrives.
export function createMidiEventObserver({getContext,setTimeoutFn=globalThis.setTimeout,clearTimeoutFn=globalThis.clearTimeout}){
 const subscriptions=new Set();let context=null,session=0;
 const safely=(fn,value)=>{try{fn?.(value);}catch{/* Observers cannot disrupt device transactions. */}};
 const wipe=sub=>{if(sub.timer!==null)clearTimeoutFn(sub.timer);sub.timer=null;sub.head=0;sub.count=0;sub.dropped=0;sub.ring.fill(undefined);};
 const same=(a,b)=>a===b||!!(a&&b&&a.input===b.input&&a.output===b.output&&a.connectionEpoch===b.connectionEpoch&&a.model===b.model&&a.firmware===b.firmware);
 const sync=()=>{
  if(!subscriptions.size){context=null;return null;}
  const next=getContext();
  if(!same(context,next)){
   const reset=context!==null;context=next;session++;
   for(const sub of subscriptions){wipe(sub);if(reset)safely(sub.onReset,{reason:'session-changed'});}
  }
  return context;
 };
 const flush=sub=>{
  sync();if(!sub.active||!sub.count)return;
  const events=Array.from({length:sub.count},(_,i)=>sub.ring[(sub.head+i)%sub.capacity]);
  const batch=Object.freeze({events:Object.freeze(events),dropped:sub.dropped});wipe(sub);safely(sub.onEvents,batch);
 };
 const subscribe=(onEvents,{capacity=128,flushMs=100,onReset}={})=>{
  if(typeof onEvents!=='function')throw new TypeError('MIDI observer requires a batch listener.');
  capacity=Math.max(1,Math.min(1024,Math.floor(Number(capacity)||128)));
  flushMs=Math.max(50,Math.min(1000,Number(flushMs)||100));
  const sub={onEvents,onReset,capacity,flushMs,ring:new Array(capacity),head:0,count:0,dropped:0,timer:null,active:true};
  subscriptions.add(sub);sync();
  return{
   flush(){flush(sub);},
   clear(){if(sub.active){wipe(sub);safely(sub.onReset,{reason:'cleared'});}},
   unsubscribe(){if(!sub.active)return;sub.active=false;wipe(sub);subscriptions.delete(sub);if(!subscriptions.size)context=null;}
  };
 };
 const receive=({port,epoch,data,timestamp})=>{
  const current=sync();
  if(!current||port!==current.input||epoch!==current.connectionEpoch||!Number.isFinite(timestamp)||timestamp<0)return;
  const decoded=decodeMidiEvent(data);if(!decoded)return;
  const event=Object.freeze({...decoded,timestamp,session,connectionEpoch:current.connectionEpoch,model:current.model,firmware:current.firmware});
  for(const sub of subscriptions){
   if(sub.count===sub.capacity){sub.ring[sub.head]=event;sub.head=(sub.head+1)%sub.capacity;sub.dropped++;}
   else{sub.ring[(sub.head+sub.count)%sub.capacity]=event;sub.count++;}
   if(sub.timer===null)sub.timer=setTimeoutFn(()=>flush(sub),sub.flushMs);
  }
 };
 return{subscribe,receive,sync};
}

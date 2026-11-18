import{MAX_RECORDING_BYTES,wavHeader}from './recorderPcm.js';
const BUSY=new Set(['starting','recording','pausing','paused','resuming','stopping']);
const TERMINAL=new Set(['done','limited','interrupted']);
export function createWavRecorder({onChange=()=>{},maxBytes=MAX_RECORDING_BYTES}={}){
  if(!Number.isSafeInteger(maxBytes)||maxBytes<6||maxBytes>MAX_RECORDING_BYTES)throw Error('Invalid recording memory budget');
  let graph=null,activeGraph=null,node=null,generation=0,commandId=0,state='idle',reason='',bits=16,channels=0,sampleRate=0,frames=0,sequence=0,chunks=[],blob=null,peak=[],clip=[];
  let watchdog=null,lastPacket=0;const waiting=new Map();
  const snapshot=()=>({state,reason,bits,channels,sampleRate,frames,seconds:sampleRate?frames/sampleRate:0,bytes:frames*channels*bits/8,maxBytes,peak:peak.slice(),clip:clip.slice(),busy:BUSY.has(state)});
  const changed=()=>onChange(snapshot());
  function cleanup(){
    clearInterval(watchdog);watchdog=null;
    for(const p of waiting.values()){clearTimeout(p.timer);p.resolve(false);}waiting.clear();
    if(node){node.port.onmessage=null;try{node.port.postMessage({dispose:true})}catch{}node.port.close();try{activeGraph?.source.disconnect(node)}catch{}try{node.disconnect()}catch{}}
    node=null;activeGraph=null;
  }
  function interrupt(why){if(!BUSY.has(state))return;generation++;state='interrupted';reason=why;cleanup();changed();}
  function send(command,pendingState){
    if(!node)return Promise.resolve(false);
    state=pendingState;changed();const id=++commandId;
    return new Promise(resolve=>{
      const timer=setTimeout(()=>interrupt('command-timeout'),2000);waiting.set(id,{resolve,timer});
      node.port.postMessage({command,commandId:id});
    });
  }
  function receive(packet,token){
    if(token!==generation||!BUSY.has(state))return;
    try{
      if(Number(activeGraph?.getChannelCount?.())!==channels){interrupt('channel-format');return;}
      lastPacket=performance.now();
      if(packet.type==='data'){
        const align=channels*bits/8;
        if(packet.sequence!==sequence||!(packet.bytes instanceof ArrayBuffer)||!Number.isInteger(packet.frames)||packet.frames<1||packet.bytes.byteLength!==packet.frames*align||(frames+packet.frames)*align>maxBytes)throw Error('chunk-order');
        chunks.push(new Uint8Array(packet.bytes));frames+=packet.frames;sequence++;
        node.port.postMessage({ack:packet.sequence});changed();
      }else if(packet.type==='levels'){
        if(packet.peak?.length!==channels||packet.clip?.length!==channels||packet.peak.some(x=>!Number.isFinite(x)||x<0)||packet.clip.some(x=>typeof x!=='boolean'))throw Error('invalid-levels');
        peak=packet.peak;clip=packet.clip;node.port.postMessage({levelsAck:true});changed();
      }else if(packet.type==='state'){
        if(packet.frames!==frames||packet.bytes!==frames*channels*bits/8||packet.sequence!==sequence||!['recording','paused','done','limited','interrupted'].includes(packet.state))throw Error('final-counters');
        state=packet.state;reason=packet.reason||'';
        const pending=waiting.get(packet.commandId);
        if(pending){clearTimeout(pending.timer);waiting.delete(packet.commandId);pending.resolve(true);}
        if(TERMINAL.has(state))cleanup();changed();
      }
    }catch(error){interrupt(error.message||'invalid-packet');}
  }
  return{
    snapshot,
    attach(next){if(BUSY.has(state))interrupt('capture-replaced');graph=next;},
    detach(){graph=null;if(BUSY.has(state))interrupt('capture-ended');},
    async start(depth=16){
      if(state!=='idle')return false;
      const current=graph,token=++generation;bits=Number(depth);channels=current?.channelCount||0;sampleRate=current?.context?.sampleRate||0;
      state='starting';reason='';changed();
      try{
        if(!current||![1,2].includes(channels)||![16,24].includes(bits)||!current.context.audioWorklet||typeof AudioWorkletNode==='undefined')throw Error('unsupported-format-or-worklet');
        // Derive the worklet build stamp from this module, as capture already does.
        const url=new URL('./recorderWorklet.js',import.meta.url);url.search=new URL(import.meta.url).search;
        let timer;
        try{await Promise.race([current.context.audioWorklet.addModule(url.href),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('module-timeout')),5000)})]);}finally{clearTimeout(timer);}
        if(token!==generation||graph!==current)return false;
        activeGraph=current;
        node=new AudioWorkletNode(current.context,'visuals-recorder',{channelCount:channels,channelCountMode:'clamped-max',processorOptions:{channels,bits,maxBytes}});
        node.port.onmessage=event=>receive(event.data,token);
        current.source.connect(node);node.connect(current.sink);lastPacket=performance.now();
        watchdog=setInterval(()=>{if(performance.now()-lastPacket>5000)interrupt('audio-stalled');},1000);
        return await send('start','starting');
      }catch(error){if(token===generation)interrupt(error.message||'start-failed');return false;}
    },
    pause:()=>state==='recording'?send('pause','pausing'):Promise.resolve(false),
    resume:()=>state==='paused'?send('resume','resuming'):Promise.resolve(false),
    stop:()=>['recording','paused'].includes(state)?send('stop','stopping'):Promise.resolve(false),
    discard(){generation++;cleanup();state='idle';reason='';frames=0;sequence=0;chunks=[];blob=null;peak=[];clip=[];changed();},
    result(){
      if(!TERMINAL.has(state)||!frames)throw Error('No completed recording prefix');
      if(!blob){const size=frames*channels*bits/8;blob=new Blob([wavHeader({sampleRate,channels,bits,frames}),...chunks,...(size%2?[new Uint8Array(1)]:[])],{type:'audio/wav'});chunks=[];}
      return blob;
    }
  };
}

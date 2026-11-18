import{quantizePcmSample}from '../audio/pcm.js';
export const MAX_RECORDING_BYTES=64*1024*1024;
function format({sampleRate,channels,bits}){
  if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>384000||![1,2].includes(channels)||![16,24].includes(bits))throw Error('Unsupported recording format');
  return channels*bits/8;
}
export function wavHeader({sampleRate,channels,bits,frames}){
  const align=format({sampleRate,channels,bits}),size=frames*align;
  if(!Number.isSafeInteger(frames)||frames<1||size>0xffffffff-37)throw Error('Invalid WAV frame count');
  const b=new Uint8Array(44),v=new DataView(b.buffer),text=new TextEncoder();
  b.set(text.encode('RIFF'));v.setUint32(4,36+size+(size%2),true);b.set(text.encode('WAVEfmt '),8);v.setUint32(16,16,true);
  v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*align,true);v.setUint16(32,align,true);v.setUint16(34,bits,true);
  b.set(text.encode('data'),36);v.setUint32(40,size,true);return b;
}
export function createPcmRecorder({sampleRate,channels,bits,maxBytes=MAX_RECORDING_BYTES,maxPendingBytes=1024*1024},emit){
  const align=format({sampleRate,channels,bits});
  if(!Number.isSafeInteger(maxBytes)||maxBytes<align||maxBytes>0xffffffff-37||!Number.isSafeInteger(maxPendingBytes)||maxPendingBytes<align)throw Error('Invalid recording budget');
  const maxFrames=Math.floor(maxBytes/align),chunkBytes=Math.min(4096,Math.floor(maxPendingBytes/align))*align;
  let buffer=new Uint8Array(chunkBytes),view=new DataView(buffer.buffer),cursor=0,frames=0,sequence=0,state='idle',outstanding=0;
  const pending=new Map(),peaks=[0,0],clip=[false,false];
  function flush(){
    if(!cursor)return;
    const bytes=cursor===buffer.length?buffer.buffer:buffer.buffer.slice(0,cursor),length=cursor;
    const seq=sequence++;pending.set(seq,length);outstanding+=length;
    buffer=new Uint8Array(chunkBytes);view=new DataView(buffer.buffer);cursor=0;
    emit({type:'data',sequence:seq,frames:length/align,bytes});
  }
  function announce(reason='',commandId=null){emit({type:'state',state,frames,bytes:frames*align,sequence,reason,commandId});}
  function finish(next,reason='',id=null){flush();state=next;announce(reason,id);}
  return{
    get state(){return state},
    command(command,id){
      if(command==='start'&&state==='idle'){state='recording';announce('',id);}
      else if(command==='pause'&&state==='recording'){flush();state='paused';announce('',id);}
      else if(command==='resume'&&state==='paused'){state='recording';announce('',id);}
      else if(command==='stop'&&['recording','paused'].includes(state))finish('done','',id);
      else if(command==='abort'&&['recording','paused'].includes(state))finish('interrupted','capture-ended',id);
    },
    ack(seq){const bytes=pending.get(seq);if(bytes!==undefined){outstanding-=bytes;pending.delete(seq);}},
    levels(){const result={peak:peaks.slice(0,channels),clip:clip.slice(0,channels),frames};peaks.fill(0);return result;},
    push(input){
      if(!['recording','paused'].includes(state))return;
      const length=input?.[0]?.length;
      if(input?.length!==channels||!length||input.some(c=>c.length!==length)){finish('interrupted','channel-format');return;}
      for(let i=0;i<length;i++){
        for(let c=0;c<channels;c++)if(!Number.isFinite(input[c][i])){finish('interrupted','invalid-pcm');return;}
        for(let c=0;c<channels;c++){const value=Math.abs(input[c][i]);peaks[c]=Math.max(peaks[c],value);clip[c]||=value>=1;}
        if(state==='paused')continue;
        if(outstanding+cursor+align>maxPendingBytes){finish('interrupted','backpressure');return;}
        for(let c=0;c<channels;c++){
          const value=quantizePcmSample(input[c][i],bits);
          if(bits===16){view.setInt16(cursor,value,true);cursor+=2;}
          else{buffer[cursor++]=value&255;buffer[cursor++]=(value>>8)&255;buffer[cursor++]=(value>>16)&255;}
        }
        frames++;
        if(cursor===buffer.length)flush();
        if(frames===maxFrames){finish('limited','memory-limit');return;}
      }
    }
  };
}

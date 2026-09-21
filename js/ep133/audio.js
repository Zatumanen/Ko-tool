const DEFAULT_SAMPLE_RATE=46875;
const DEVICE_AUDIO_FORMAT='s16';

export function getTargetSampleRate(audioMeta,formats=[],fallback=DEFAULT_SAMPLE_RATE){
  const supported=(Array.isArray(formats)?formats:[])
    .filter(group=>group?.type==='pcm')
    .flatMap(group=>Array.isArray(group.formats)?group.formats:[])
    .find(format=>String(format?.format||'').includes(DEVICE_AUDIO_FORMAT)&&Array.isArray(format?.channels)&&format.channels.includes(audioMeta?.channels));
  const rangeMax=Array.isArray(supported?.['samplerate.range'])?supported['samplerate.range'][1]:undefined;
  const native=supported?.['samplerate.native'];
  const max=rangeMax||native;
  return max?Math.min(audioMeta.sample_rate,max):fallback;
}

function readAscii(view,offset,length){let s='';for(let i=0;i<length;i++)s+=String.fromCharCode(view.getUint8(offset+i));return s;}

export function parseWavAudioMeta(bytes){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(view.byteLength<44||readAscii(view,0,4)!=='RIFF'||readAscii(view,8,4)!=='WAVE')return null;
  let offset=12,fmt=null,dataOffset=-1,dataSize=0;
  while(offset+8<=view.byteLength){
    const id=readAscii(view,offset,4),size=view.getUint32(offset+4,true),next=offset+8+size+(size&1);
    if(id==='fmt '&&size>=16)fmt={format:view.getUint16(offset+8,true),channels:view.getUint16(offset+10,true),rate:view.getUint32(offset+12,true),bits:view.getUint16(offset+22,true)};
    if(id==='data'){dataOffset=offset+8;dataSize=Math.min(size,view.byteLength-dataOffset);break;}
    if(next<=offset||next>view.byteLength)break;
    offset=next;
  }
  if(!fmt||dataOffset<0)return null;
  return{...fmt,dataOffset,dataSize};
}

function parseNativeWav(bytes){
  const meta=parseWavAudioMeta(bytes);
  if(!meta||meta.format!==1||meta.bits!==16||(meta.channels!==1&&meta.channels!==2)||meta.rate!==DEFAULT_SAMPLE_RATE)return null;
  return{data:bytes.slice(meta.dataOffset,meta.dataOffset+meta.dataSize),channels:meta.channels,rate:meta.rate};
}

async function decode(file,sourceRate){
  const C=window.AudioContext||window.webkitAudioContext;
  if(!C)throw new Error('Web Audio API is not supported by this browser.');
  const options=Number.isFinite(sourceRate)&&sourceRate>0?{sampleRate:sourceRate}:undefined;
  const ctx=new C(options);
  try{return await ctx.decodeAudioData((await file.arrayBuffer()).slice(0));}
  finally{try{await ctx.close();}catch{}}
}

async function resample(buffer,targetRate){
  if(buffer.sampleRate===targetRate)return buffer;
  const frames=Math.max(1,Math.round(buffer.duration*targetRate));
  const C=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  if(!C)throw new Error('OfflineAudioContext is required for EP-133 sample conversion.');
  const ctx=new C(buffer.numberOfChannels,frames,targetRate);
  const source=ctx.createBufferSource();
  source.buffer=buffer;
  source.connect(ctx.destination);
  source.start(0);
  return ctx.startRendering();
}

function encodePcm16(buffer,targetRate){
  const channels=Math.min(2,buffer.numberOfChannels);
  const out=new Uint8Array(buffer.length*channels*2);
  const view=new DataView(out.buffer);
  const data=Array.from({length:channels},(_,c)=>buffer.getChannelData(c));
  let offset=0;
  for(let i=0;i<buffer.length;i++)for(let c=0;c<channels;c++){
    const x=Math.max(-1,Math.min(1,data[c][i]));
    view.setInt16(offset,x<0?Math.round(x*32768):Math.round(x*32767),true);
    offset+=2;
  }
  return{data:out,channels,samplerate:targetRate,format:'s16'};
}

export async function prepareEp133Sample(file,{formats=[],targetSampleRate=null,onProgress}={}){
  if(!file)throw new Error('No audio file supplied.');
  const name=String(file.name||'sample.wav');
  if(!/\\.(wav|mp3|aac|ogg|flac|m4a)$/i.test(name)&&!String(file.type||'').startsWith('audio/'))throw new Error('Unsupported audio file.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  const native=parseNativeWav(bytes);
  if(native){onProgress?.(100,{status:'ready'});return{data:native.data,channels:native.channels,samplerate:native.rate,format:'s16'};}
  const wavMeta=parseWavAudioMeta(bytes);
  onProgress?.(0,{status:'decoding'});
  const decoded=await decode(file,wavMeta?.rate);
  if(decoded.duration>20)throw new Error('Maximum EP-133 sample length is 20 seconds.');
  if(decoded.numberOfChannels<1||decoded.numberOfChannels>2)throw new Error('EP-133 samples must have 1 or 2 channels.');
  const sourceMeta={sample_rate:decoded.sampleRate,channels:decoded.numberOfChannels};
  const target=targetSampleRate??getTargetSampleRate(sourceMeta,formats);
  onProgress?.(35,{status:'resampling'});
  const converted=await resample(decoded,target);
  onProgress?.(80,{status:'encoding'});
  const result=encodePcm16(converted,target);
  onProgress?.(100,{status:'ready'});
  return result;
}

export const EP133_SAMPLE_RATE=DEFAULT_SAMPLE_RATE;
export const EP133_AUDIO_FORMAT=DEVICE_AUDIO_FORMAT;

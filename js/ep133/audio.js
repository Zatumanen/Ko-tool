import{resampleInterleavedFloat32}from './resampler.js?v=20260923-1';

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

function parseKo2Metadata(bytes){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(view.byteLength<12)return null;
  const text=(offset,length)=>String.fromCharCode(...bytes.slice(offset,offset+length));
  let offset=12;
  while(offset+8<=view.byteLength){
    const id=text(offset,4),size=view.getUint32(offset+4,true),end=offset+8+size+(size&1);
    if(end>view.byteLength)break;
    if(id==='LIST'&&size>=12&&text(offset+8,4)==='INFO'&&text(offset+12,4)==='TNGE'){
      const jsonLength=view.getUint32(offset+16,true);
      if(jsonLength>0&&offset+20+jsonLength<=view.byteLength){
        try{
          const json=new TextDecoder().decode(bytes.slice(offset+20,offset+20+jsonLength));
          const metadata=JSON.parse(json);
          return metadata&&typeof metadata==='object'?metadata:null;
        }catch{}
      }
    }
    offset=end;
  }
  return null;
}

const TEENAGE_META_VALIDATORS={
  "sound.loopstart":value=>value!=null&&value>=0,
  "sound.loopend":value=>value!=null&&value>=0,
  "sound.rootnote":value=>value!=null&&value>0&&value<=127,
  "sound.bpm":value=>value!=null&&value>=60&&value<=180,
  "sound.pitch":value=>value!=null&&value>=-12&&value<=12,
  "sound.pan":value=>value!=null&&value>=-16&&value<=16,
  "sound.amplitude":value=>value!=null&&value>=0&&value<=200,
  "envelope.attack":value=>value!=null&&value>=0&&value<=255,
  "envelope.release":value=>value!=null&&value>=0&&value<=255,
  "sound.playmode":value=>value!=null&&String(value).length>0,
  "time.mode":value=>value!=null&&String(value).length>0
};

function cleanTeenageMetadata(metadata){
  const out={};
  for(const[key,value]of Object.entries(metadata||{})){
    const validator=TEENAGE_META_VALIDATORS[key];
    if(validator&&!validator(value))continue;
    out[key]=value;
  }
  return out;
}

export function prepareTeenageMetadata(audioMeta,targetSampleRate){
  const extra=audioMeta?.extra||{};
  let metadata={};
  if(typeof extra.json==='string'&&extra.json){
    try{
      const parsed=JSON.parse(extra.json);
      if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))metadata={...parsed};
    }catch{}
  }
  const sourceRate=Number(audioMeta?.sample_rate);
  const scale=Number.isFinite(sourceRate)&&sourceRate>0&&Number.isFinite(targetSampleRate)&&targetSampleRate>0
    ? targetSampleRate/sourceRate : 1;
  if(TEENAGE_META_VALIDATORS["sound.loopstart"](extra.loop_start))
    metadata["sound.loopstart"]=Math.floor(extra.loop_start*scale);
  if(TEENAGE_META_VALIDATORS["sound.loopend"](extra.loop_end))
    metadata["sound.loopend"]=Math.floor(extra.loop_end*scale);
  if(TEENAGE_META_VALIDATORS["sound.rootnote"](extra.midi_root_note))
    metadata["sound.rootnote"]=extra.midi_root_note;
  if(TEENAGE_META_VALIDATORS["sound.bpm"](extra.bpm))
    metadata["sound.bpm"]=extra.bpm;
  return cleanTeenageMetadata(metadata);
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

function flattenAudioBuffer(buffer){
  const channels=Math.min(2,buffer.numberOfChannels);
  const frames=buffer.length;
  const out=new Float32Array(frames*channels);
  const data=Array.from({length:channels},(_,channel)=>buffer.getChannelData(channel));
  let offset=0;
  for(let frame=0;frame<frames;frame++)for(let channel=0;channel<channels;channel++)out[offset++]=data[channel][frame];
  return{data:out,channels};
}

function encodePcm16(interleaved,channels,targetRate){
  const frames=Math.floor(interleaved.length/channels);
  const out=new Uint8Array(frames*channels*2);
  const view=new DataView(out.buffer);
  let offset=0;
  for(let i=0;i<interleaved.length;i++){
    const x=Math.max(-1,Math.min(1,interleaved[i]));
    view.setInt16(offset,x<0?Math.round(x*32768):Math.round(x*32767),true);
    offset+=2;
  }
  return{data:out,channels,samplerate:targetRate,format:'s16'};
}

export async function prepareEp133Sample(file,{formats=[],targetSampleRate=null,wasmUrl=null,onProgress}={}){
  if(!file)throw new Error('No audio file supplied.');
  const name=String(file.name||'sample.wav');
  if(!/\.(wav|mp3|aac|ogg|flac|m4a)$/i.test(name)&&!String(file.type||'').startsWith('audio/'))throw new Error('Unsupported audio file.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  const ko2Metadata=parseKo2Metadata(bytes);
  const resampler=await getLibSampleRateModule(wasmUrl);
  let audioMeta;
  try{audioMeta=resampler.getAudioMeta(name,bytes);}catch{audioMeta=decodeMetaFallback(bytes);}
  if(!audioMeta?.channels||!audioMeta?.sample_rate)throw new Error('Could not read audio metadata.');
  const nativeStart=audioMeta?.extra?.data_start??0;
  const nativeEnd=audioMeta?.extra?.data_end??0;
  if(nativeStart>0&&nativeEnd>nativeStart&&audioMeta.container==='WAV'&&audioMeta.format===DEVICE_AUDIO_FORMAT&&audioMeta.sample_rate===DEFAULT_SAMPLE_RATE&&(audioMeta.channels===1||audioMeta.channels===2)){
    onProgress?.(100,{status:'ready'});
    return{data:bytes.slice(nativeStart,nativeEnd),channels:audioMeta.channels,samplerate:audioMeta.sample_rate,format:DEVICE_AUDIO_FORMAT,metadata:prepareTeenageMetadata(audioMeta,audioMeta.sample_rate)};
  }
  if((audioMeta.length??0)>20)throw new Error('Maximum EP-133 sample length is 20 seconds.');
  if(audioMeta.sample_rate<3000||audioMeta.sample_rate>768000)throw new Error('Invalid sample rate.');
  const target=targetSampleRate??getTargetSampleRate(audioMeta,formats);
  let inputData=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),channels=audioMeta.channels,inputFormat=audioMeta.container==='AIFF'?'aiff':'pcm';
  if(inputFormat==='pcm'){
    onProgress?.(0,{status:'decoding'});
    const decoded=await decode(file,audioMeta.sample_rate);
    const flattened=flattenAudioBuffer(decoded);
    inputData=flattened.data.buffer;
    channels=flattened.channels;
  }
  onProgress?.(35,{status:'resampling'});
  const output=await resampler.resampleAudioData(inputData,audioMeta.sample_rate,target,inputFormat,'pcm',16,channels);
  const data=output instanceof Uint8Array?output:new Uint8Array(output.buffer||output);
  onProgress?.(80,{status:'encoding'});
  onProgress?.(100,{status:'ready'});
  return{data,channels,samplerate:target,format:DEVICE_AUDIO_FORMAT,metadata:prepareTeenageMetadata(audioMeta,target)};
}
export {parseKo2Metadata};

export const EP133_SAMPLE_RATE=DEFAULT_SAMPLE_RATE;
export const EP133_AUDIO_FORMAT=DEVICE_AUDIO_FORMAT;

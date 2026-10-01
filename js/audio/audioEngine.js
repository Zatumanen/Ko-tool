import{getLibSampleRateModule}from '../ep133/resampler.js?v=20260930-5';

const asUint8=value=>value instanceof Uint8Array?value:new Uint8Array(value?.buffer||value||[]);
const finitePositive=(value,label)=>{
  const number=Number(value);
  if(!Number.isFinite(number)||number<=0)throw new Error(label+' must be greater than zero.');
  return number;
};
const validChannels=value=>{
  const channels=Number(value);
  if(!Number.isInteger(channels)||channels<1||channels>2)throw new Error('Reference audio engine supports mono or stereo only.');
  return channels;
};
const makeBuffer=(length,sampleRate,channels)=>{
  if(typeof AudioBuffer==='undefined')throw new Error('AudioBuffer is unavailable.');
  return new AudioBuffer({length:Math.max(1,Math.floor(length)),sampleRate,numberOfChannels:channels});
};

export async function getReferenceAudioModule({module=null,moduleProvider=null}={}){
  const resolved=module||await (typeof moduleProvider==='function'?moduleProvider():getLibSampleRateModule());
  if(!resolved||typeof resolved.resampleAudioData!=='function'||typeof resolved.createWav!=='function')
    throw new Error('EP-series reference audio module is unavailable.');
  return resolved;
}

export function flattenAudioBuffer(buffer){
  if(!buffer?.getChannelData)throw new Error('Invalid audio buffer.');
  const channels=validChannels(buffer.numberOfChannels),frames=Number(buffer.length);
  if(!Number.isInteger(frames)||frames<1)throw new Error('Invalid audio buffer frame count.');
  const output=new Float32Array(frames*channels);
  const source=Array.from({length:channels},(_,channel)=>buffer.getChannelData(channel));
  let offset=0;
  for(let frame=0;frame<frames;frame++)for(let channel=0;channel<channels;channel++)output[offset++]=source[channel][frame]||0;
  return{data:output,channels,frames};
}

export function audioBufferToS16(buffer){
  const flattened=flattenAudioBuffer(buffer),bytes=new Uint8Array(flattened.data.length*2),view=new DataView(bytes.buffer);
  for(let index=0;index<flattened.data.length;index++){
    const sample=Math.max(-1,Math.min(1,flattened.data[index]));
    view.setInt16(index*2,sample<0?Math.round(sample*32768):Math.round(sample*32767),true);
  }
  return bytes;
}

export function s16PcmToAudioBuffer(data,{sampleRate,channels}={}){
  const bytes=asUint8(data),rate=finitePositive(sampleRate,'Sample rate'),channelCount=validChannels(channels),bytesPerFrame=channelCount*2;
  if(bytes.byteLength<bytesPerFrame||bytes.byteLength%bytesPerFrame!==0)throw new Error('Reference resampler returned invalid s16 PCM length.');
  const frames=bytes.byteLength/bytesPerFrame,output=makeBuffer(frames,rate,channelCount),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  for(let frame=0;frame<frames;frame++)for(let channel=0;channel<channelCount;channel++){
    const value=view.getInt16((frame*channelCount+channel)*2,true);
    output.getChannelData(channel)[frame]=value<0?value/32768:value/32767;
  }
  return output;
}

export async function resampleReferenceAudioData(input,{sourceSampleRate,targetSampleRate,inputFormat='pcm',outputFormat='pcm',bitDepth=16,channels,module=null,moduleProvider=null}={}){
  const sourceRate=finitePositive(sourceSampleRate,'Source sample rate'),targetRate=finitePositive(targetSampleRate,'Target sample rate'),channelCount=validChannels(channels);
  if(Number(bitDepth)!==16)throw new Error('EP reference resampling requires 16-bit output.');
  const reference=await getReferenceAudioModule({module,moduleProvider});
  let raw;
  if(input instanceof ArrayBuffer)raw=input;
  else{const bytes=asUint8(input);raw=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);}
  const output=await reference.resampleAudioData(raw,sourceRate,targetRate,String(inputFormat||'pcm'),String(outputFormat||'pcm'),16,channelCount);
  return asUint8(output).slice();
}

export async function resampleAudioBufferReference(buffer,{speed=1,targetSampleRate,module=null,moduleProvider=null}={}){
  if(!buffer?.getChannelData)throw new Error('Invalid audio buffer.');
  const factor=finitePositive(speed,'Speed'),targetRate=finitePositive(targetSampleRate,'Target sample rate'),sourceRate=finitePositive(buffer.sampleRate,'Source sample rate');
  const flattened=flattenAudioBuffer(buffer);
  const data=await resampleReferenceAudioData(flattened.data.buffer,{
    sourceSampleRate:sourceRate*factor,targetSampleRate:targetRate,inputFormat:'pcm',outputFormat:'pcm',bitDepth:16,
    channels:flattened.channels,module,moduleProvider
  });
  return s16PcmToAudioBuffer(data,{sampleRate:targetRate,channels:flattened.channels});
}

export function buildReferenceAudioMeta(buffer,metadata={}){
  if(!buffer?.getChannelData)throw new Error('Invalid audio buffer.');
  const channels=validChannels(buffer.numberOfChannels),sampleRate=finitePositive(buffer.sampleRate,'Sample rate'),teenage={...(metadata||{})};
  return{
    channels,sample_rate:sampleRate,format:'s16',length:Number(buffer.length)/sampleRate,bit_rate:sampleRate*channels*16,container:'',
    extra:{
      midi_root_note:teenage['sound.rootnote'],loop_start:teenage['sound.loopstart'],loop_end:teenage['sound.loopend'],
      bpm:teenage['sound.bpm'],json:JSON.stringify(teenage)
    }
  };
}

export async function createReferenceWav(name,audioMeta,pcm,{module=null,moduleProvider=null}={}){
  const reference=await getReferenceAudioModule({module,moduleProvider}),bytes=asUint8(pcm);
  const result=reference.createWav(String(name||'sample.wav'),audioMeta,bytes),output=asUint8(result).slice();
  if(output.byteLength<12)throw new Error('EP-series reference WAV encoder returned invalid data.');
  return output;
}

export async function encodeReferenceEpWav(buffer,{name='sample.wav',metadata={},module=null,moduleProvider=null}={}){
  const pcm=audioBufferToS16(buffer),audioMeta=buildReferenceAudioMeta(buffer,metadata);
  const bytes=await createReferenceWav(name,audioMeta,pcm,{module,moduleProvider});
  return new Blob([bytes],{type:'audio/wav'});
}

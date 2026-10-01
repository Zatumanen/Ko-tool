import{EP_OUTPUT_BIT_DEPTH,encodeEpReadyWav,measureEpStorage,quantizeBuffer}from './processor.js?v=20261001-1';

const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const makeBuffer=(length,sampleRate,channels)=>{
  if(typeof AudioBuffer==='undefined')throw new Error('AudioBuffer is unavailable.');
  return new AudioBuffer({
    length:Math.max(1,Math.floor(length)),
    sampleRate,
    numberOfChannels:channels
  });
};

export function clampWaveformSelection(buffer,start=0,end=null){
  const duration=Math.max(0,finite(buffer?.duration)||(
    finite(buffer?.length)&&finite(buffer?.sampleRate)>0
      ?finite(buffer.length)/finite(buffer.sampleRate)
      :0
  ));
  let a=Math.max(0,Math.min(duration,finite(start)));
  let b=end==null?duration:Math.max(0,Math.min(duration,finite(end)));
  if(b<a)[a,b]=[b,a];
  const min=duration>0?Math.min(duration,1/Math.max(1,finite(buffer?.sampleRate)||1)):0;
  if(duration>0&&b-a<min)b=Math.min(duration,a+min);
  if(duration>0&&b<=a){a=Math.max(0,duration-min);b=duration;}
  return{start:a,end:b,duration:b-a,totalDuration:duration};
}

export function cropAudioBuffer(buffer,start=0,end=null){
  if(!buffer?.getChannelData||!buffer?.sampleRate||!buffer?.numberOfChannels)
    throw new Error('Invalid audio buffer.');
  const selection=clampWaveformSelection(buffer,start,end);
  const first=Math.max(0,Math.min(buffer.length-1,Math.floor(selection.start*buffer.sampleRate)));
  const last=Math.max(first+1,Math.min(buffer.length,Math.ceil(selection.end*buffer.sampleRate)));
  const out=makeBuffer(last-first,buffer.sampleRate,buffer.numberOfChannels);
  for(let channel=0;channel<buffer.numberOfChannels;channel++)
    out.getChannelData(channel).set(buffer.getChannelData(channel).subarray(first,last));
  return out;
}

export function audioBufferPeak(buffer){
  let peak=0;
  if(!buffer?.getChannelData)return peak;
  for(let channel=0;channel<buffer.numberOfChannels;channel++){
    const data=buffer.getChannelData(channel);
    for(let index=0;index<data.length;index++)peak=Math.max(peak,Math.abs(data[index]));
  }
  return peak;
}

export function gainDbToLinear(db=0){
  return 10**(finite(db)/20);
}

export function applyGainToAudioBuffer(buffer,gainDb=0){
  if(!buffer?.getChannelData)throw new Error('Invalid audio buffer.');
  const gain=gainDbToLinear(gainDb);
  const out=makeBuffer(buffer.length,buffer.sampleRate,buffer.numberOfChannels);
  for(let channel=0;channel<buffer.numberOfChannels;channel++){
    const source=buffer.getChannelData(channel),target=out.getChannelData(channel);
    for(let index=0;index<source.length;index++)target[index]=source[index]*gain;
  }
  return out;
}

export function normalizeAudioBufferPeak(buffer,targetPeak=1){
  if(!buffer?.getChannelData)throw new Error('Invalid audio buffer.');
  const peak=audioBufferPeak(buffer);
  const target=Math.max(0,Math.min(1,finite(targetPeak)||1));
  const gain=peak>0?target/peak:1;
  const out=makeBuffer(buffer.length,buffer.sampleRate,buffer.numberOfChannels);
  for(let channel=0;channel<buffer.numberOfChannels;channel++){
    const source=buffer.getChannelData(channel),targetData=out.getChannelData(channel);
    for(let index=0;index<source.length;index++)targetData[index]=source[index]*gain;
  }
  return out;
}

export function buildWaveformPeaks(buffer,{start=0,end=null,bins=512}={}){
  if(!buffer?.getChannelData||!buffer?.sampleRate)return[];
  const selection=clampWaveformSelection(buffer,start,end);
  const first=Math.max(0,Math.floor(selection.start*buffer.sampleRate));
  const last=Math.min(buffer.length,Math.max(first+1,Math.ceil(selection.end*buffer.sampleRate)));
  const count=Math.max(1,Math.floor(finite(bins)||512));
  const channels=Array.from({length:buffer.numberOfChannels},(_,index)=>buffer.getChannelData(index));
  const peaks=new Array(count);
  for(let bin=0;bin<count;bin++){
    const from=first+Math.floor((last-first)*bin/count);
    const to=Math.max(from+1,first+Math.floor((last-first)*(bin+1)/count));
    let min=0,max=0;
    for(let frame=from;frame<to&&frame<last;frame++){
      let sample=0;
      for(const channel of channels)sample+=channel[frame]||0;
      sample/=Math.max(1,channels.length);
      if(sample<min)min=sample;
      if(sample>max)max=sample;
    }
    peaks[bin]={min,max};
  }
  return peaks;
}

export async function renderWaveformEdit(buffer,{
  start=0,
  end=null,
  gainDb=0,
  normalize=false,
  playmode='oneshot',
  referenceModuleProvider=null
}={}){
  let edited=cropAudioBuffer(buffer,start,end);
  if(finite(gainDb)!==0)edited=applyGainToAudioBuffer(edited,gainDb);
  if(normalize)edited=normalizeAudioBufferPeak(edited,1);
  edited=await quantizeBuffer(edited,EP_OUTPUT_BIT_DEPTH);
  const blob=await encodeEpReadyWav(edited,{referenceModuleProvider},playmode);
  return{
    buffer:edited,
    blob,
    epStorage:measureEpStorage(edited),
    edit:Object.freeze({
      start:clampWaveformSelection(buffer,start,end).start,
      end:clampWaveformSelection(buffer,start,end).end,
      gainDb:finite(gainDb),
      normalize:!!normalize
    })
  };
}

import{resampleAudioBufferReference,encodeReferenceEpWav}from './audioEngine.js?v=20261001-1';
import{parseKo2Metadata}from '../ep133/audio.js?v=20261001-1';
export const EP_REPITCH_FACTOR=2;
export const EP_REPITCH_COMPENSATION=-12;
export const EP_OUTPUT_BIT_DEPTH=16;
export const EP_STORAGE_BYTES_PER_SAMPLE=EP_OUTPUT_BIT_DEPTH/8;
export const EP_MAX_SAMPLE_RATE=46875;

export function estimateDirectEpStorage({frames=0,sampleRate=0,channels=0}={}){
  const frameCount=Number(frames),rate=Number(sampleRate),channelCount=Number(channels);
  if(!Number.isFinite(frameCount)||frameCount<0||!Number.isFinite(rate)||rate<=0||!Number.isInteger(channelCount)||channelCount<1||channelCount>2)return null;
  const duration=frameCount/rate;
  const targetRate=Math.min(rate,EP_MAX_SAMPLE_RATE);
  const targetFrames=Math.max(0,Math.round(duration*targetRate));
  return{
    bytes:targetFrames*channelCount*EP_STORAGE_BYTES_PER_SAMPLE,
    frames:targetFrames,
    sampleRate:targetRate,
    channels:channelCount,
    duration
  };
}

export function measureEpStorage(buffer){
  const frames=Number(buffer?.length),rate=Number(buffer?.sampleRate),channels=Number(buffer?.numberOfChannels);
  if(!Number.isFinite(frames)||frames<0||!Number.isFinite(rate)||rate<=0||!Number.isInteger(channels)||channels<1||channels>2)
    throw new Error('Invalid audio buffer for EP storage measurement.');
  return{
    bytes:frames*channels*EP_STORAGE_BYTES_PER_SAMPLE,
    frames,
    sampleRate:rate,
    channels,
    duration:frames/rate
  };
}
export const PRESETS=Object.freeze({
  hi:Object.freeze({label:'HI',sampleRate:46875,bitDepth:EP_OUTPUT_BIT_DEPTH,wavBitDepth:EP_OUTPUT_BIT_DEPTH}),
  mid:Object.freeze({label:'MID',sampleRate:32000,bitDepth:EP_OUTPUT_BIT_DEPTH,wavBitDepth:EP_OUTPUT_BIT_DEPTH}),
  lo:Object.freeze({label:'LO',sampleRate:26250,bitDepth:EP_OUTPUT_BIT_DEPTH,wavBitDepth:EP_OUTPUT_BIT_DEPTH})
});
export const getPreset=(name='hi')=>PRESETS[name]||PRESETS.hi;
export function createAudioContext(){const C=window.AudioContext||window.webkitAudioContext;if(!C)throw Error('Web Audio API is not supported in this browser.');return new C();}
function readAscii(view,offset,len){let s='';for(let i=0;i<len;i++)s+=String.fromCharCode(view.getUint8(offset+i));return s;}
function decodeWav(arrayBuffer){
  const v=new DataView(arrayBuffer);
  if(v.byteLength<44||readAscii(v,0,4)!=='RIFF'||readAscii(v,8,4)!=='WAVE')return null;
  let o=12,fmt=null,dataOffset=-1,dataSize=0;
  while(o+8<=v.byteLength){
    const id=readAscii(v,o,4),size=v.getUint32(o+4,true),next=o+8+size+(size&1);
    if(id==='fmt '&&size>=16){fmt={format:v.getUint16(o+8,true),channels:v.getUint16(o+10,true),sampleRate:v.getUint32(o+12,true),bits:v.getUint16(o+22,true)};if(fmt.format===65534&&size>=40){const sub=v.getUint16(o+32,true);fmt.format=sub===3?3:1;}}
    else if(id==='data'){dataOffset=o+8;dataSize=Math.min(size,v.byteLength-dataOffset);break;}
    if(next<=o||next>v.byteLength+1)break;o=next;
  }
  if(!fmt||dataOffset<0||!fmt.channels||!fmt.sampleRate||!dataSize)return null;
  const bytesPerSample=fmt.bits/8;
  if(![8,16,24,32].includes(fmt.bits)||!([1,3].includes(fmt.format))||dataSize<bytesPerSample*fmt.channels)return null;
  const frames=Math.floor(dataSize/(bytesPerSample*fmt.channels)),out=makeBuffer(frames,fmt.sampleRate,Math.min(2,fmt.channels));
  const srcChannels=fmt.channels,dstChannels=out.numberOfChannels,bytesPerFrame=bytesPerSample*srcChannels;
  const readSample=pos=>{if(fmt.format===3&&fmt.bits===32)return v.getFloat32(pos,true);if(fmt.bits===8)return (v.getUint8(pos)-128)/128;if(fmt.bits===16){const x=v.getInt16(pos,true);return x<0?x/32768:x/32767;}if(fmt.bits===24){let x=v.getUint8(pos)|(v.getUint8(pos+1)<<8)|(v.getUint8(pos+2)<<16);if(x&0x800000)x|=0xff000000;return x<0?x/8388608:x/8388607;}const x=v.getInt32(pos,true);return x<0?x/2147483648:x/2147483647;};
  for(let i=0;i<frames;i++)for(let c=0;c<dstChannels;c++){let x=0;if(dstChannels===1){for(let sc=0;sc<srcChannels;sc++)x+=readSample(dataOffset+i*bytesPerFrame+sc*bytesPerSample);x/=srcChannels;}else x=readSample(dataOffset+i*bytesPerFrame+Math.min(c,srcChannels-1)*bytesPerSample);out.getChannelData(c)[i]=Math.max(-1,Math.min(1,x));}
  return out;
}
export async function decodeAudio(arrayBuffer,ctx){const wav=decodeWav(arrayBuffer);if(wav)return wav;if(!ctx)ctx=createAudioContext();try{return await ctx.decodeAudioData(arrayBuffer.slice(0));}catch(e){throw Error('Audio decoding failed: '+(e?.message||e));}}
function makeBuffer(length,sampleRate,channels){if(typeof AudioBuffer==='undefined')throw Error('AudioBuffer is unavailable.');return new AudioBuffer({length:Math.max(1,Math.floor(length)),sampleRate,numberOfChannels:channels});}
function checkCancel(hooks){if(hooks?.shouldCancel?.())throw Object.assign(new Error('Processing cancelled'),{name:'AbortError'});}
const yieldControl=()=>new Promise(resolve=>setTimeout(resolve,0));
export async function trimSilence(buffer,thresholdDb=-60,minSilenceDuration=.1,hooks={}){if(!buffer?.length)return buffer;const threshold=10**(thresholdDb/20),sr=buffer.sampleRate,ch=buffer.numberOfChannels,d=Array.from({length:ch},(_,i)=>buffer.getChannelData(i));let start=0,end=buffer.length;while(start<end){checkCancel(hooks);let loud=false;for(let c=0;c<ch&&!loud;c++)loud=Math.abs(d[c][start])>threshold;if(loud)break;start++;if(start%10000===0)await yieldControl();}while(end>start){checkCancel(hooks);let loud=false;for(let c=0;c<ch&&!loud;c++)loud=Math.abs(d[c][end-1])>threshold;if(loud)break;end--;if(end%10000===0)await yieldControl();}const min=Math.floor(minSilenceDuration*sr);if(start<min)start=0;if(buffer.length-end<min)end=buffer.length;if(!start&&end===buffer.length)return buffer;if(end<=start)return buffer;const out=makeBuffer(end-start,sr,ch);for(let c=0;c<ch;c++){const src=d[c],dst=out.getChannelData(c);for(let i=0;i<src.length&&i<dst.length;i++){if(i%50000===0){checkCancel(hooks);await yieldControl();}dst[i]=src[i+start];}}return out;}
/** Original keeps each source's mono/stereo layout, including in a mixed batch. */
export function resolveOutputChannels(sourceChannels,mode='stereo'){
  if(mode==='mono')return 1;
  if(mode==='stereo')return 2;
  if(mode!=='original')throw new Error('Unsupported output channels setting: '+mode);
  if(sourceChannels!==1&&sourceChannels!==2)
    throw new Error('Original channels supports only mono or stereo sources.');
  return sourceChannels;
}
export async function convertChannels(buffer,target,hooks={}){if(buffer.numberOfChannels===target)return buffer;const out=makeBuffer(buffer.length,buffer.sampleRate,target),src=Array.from({length:buffer.numberOfChannels},(_,c)=>buffer.getChannelData(c));if(target===1){const d=out.getChannelData(0),scale=1/src.length;for(let i=0;i<buffer.length;i++){if(i%50000===0){checkCancel(hooks);await yieldControl();}let x=0;for(const s of src)x+=s[i];d[i]=x*scale;}}else{const l=out.getChannelData(0),r=out.getChannelData(1);if(src.length===1){for(let i=0;i<buffer.length;i++){if(i%50000===0){checkCancel(hooks);await yieldControl();}l[i]=src[0][i];r[i]=src[0][i];}}else{for(let i=0;i<buffer.length;i++){if(i%50000===0){checkCancel(hooks);await yieldControl();}l[i]=src[0][i];r[i]=src[1][i];}}}return out;}
export async function speedAndResample(buffer,speed=2,targetSampleRate=44100,hooks={}){if(!(speed>0))throw Error('Speed must be greater than zero.');checkCancel(hooks);const out=await resampleAudioBufferReference(buffer,{speed,targetSampleRate,module:hooks.referenceModule,moduleProvider:hooks.referenceModuleProvider});checkCancel(hooks);return out;}
export async function quantizeBuffer(buffer,bits,hooks={}){if(bits!==8&&bits!==12&&bits!==16)throw Error(`Unsupported bit depth: ${bits}`);const out=makeBuffer(buffer.length,buffer.sampleRate,buffer.numberOfChannels),levels=bits===8?127:bits===12?2047:32767;for(let c=0;c<buffer.numberOfChannels;c++){const s=buffer.getChannelData(c),d=out.getChannelData(c);for(let i=0;i<s.length;i++){if(i%20000===0){checkCancel(hooks);await yieldControl();}const x=Math.max(-1,Math.min(1,s[i]));d[i]=x<0?Math.round(x*(levels+1))/(levels+1):Math.round(x*levels)/levels;}}return out;}
export async function normalizeBuffer(buffer,hooks={}){const out=makeBuffer(buffer.length,buffer.sampleRate,buffer.numberOfChannels);let peak=0;for(let c=0;c<buffer.numberOfChannels;c++){const s=buffer.getChannelData(c);for(let i=0;i<s.length;i++){if(i%20000===0){checkCancel(hooks);await yieldControl();}peak=Math.max(peak,Math.abs(s[i]));}}if(!(peak>0)||peak>=1){for(let c=0;c<buffer.numberOfChannels;c++)out.getChannelData(c).set(buffer.getChannelData(c));return out;}const gain=1/peak;for(let c=0;c<buffer.numberOfChannels;c++){const s=buffer.getChannelData(c),d=out.getChannelData(c);for(let i=0;i<s.length;i++){if(i%20000===0){checkCancel(hooks);await yieldControl();}d[i]=Math.max(-1,Math.min(1,s[i]*gain));}}return out;}
function writeAscii(view,offset,text){for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));}
const SUPPORTED_PLAYMODES=new Set(['oneshot','loop','key','legato']);
const normalizePlaymode=mode=>SUPPORTED_PLAYMODES.has(mode)?mode:'oneshot';
const KO2_METADATA={"sound.amplitude":100,"sound.pan":0,"sound.pitch":EP_REPITCH_COMPENSATION,"envelope.attack":0,"envelope.release":255,"sound.rootnote":60,"time.mode":"off"};
function makeKo2ListChunk(playmode='oneshot'){const mode=normalizePlaymode(playmode);const json=JSON.stringify({...KO2_METADATA,"sound.playmode":mode});const payloadSize=4+4+4+json.length+((json.length&1)?1:0);const chunkSize=8+payloadSize;const out=new Uint8Array(chunkSize);const v=new DataView(out.buffer);writeAscii(v,0,'LIST');v.setUint32(4,payloadSize,true);writeAscii(v,8,'INFO');writeAscii(v,12,'TNGE');v.setUint32(16,json.length,true);for(let i=0;i<json.length;i++)v.setUint8(20+i,json.charCodeAt(i));return out;}
function makeSmplChunk(){const out=new Uint8Array(44);const v=new DataView(out.buffer);writeAscii(v,0,'smpl');v.setUint32(4,36,true);return out;}
export async function encodeWav(buffer,bits=16,hooks={},playmode='oneshot'){const ch=Math.min(2,buffer.numberOfChannels),bps=bits/8,frames=buffer.length,size=frames*ch*bps,smpl=makeSmplChunk(),list=makeKo2ListChunk(playmode),riffSize=4+(8+16)+smpl.length+list.length+(8+size),out=new ArrayBuffer(8+riffSize),v=new DataView(out),w=(o,s)=>writeAscii(v,o,s);w(0,'RIFF');v.setUint32(4,riffSize,true);w(8,'WAVE');let header=12;w(header,'fmt ');v.setUint32(header+4,16,true);v.setUint16(header+8,1,true);v.setUint16(header+10,ch,true);v.setUint32(header+12,buffer.sampleRate,true);v.setUint32(header+16,buffer.sampleRate*ch*bps,true);v.setUint16(header+20,ch*bps,true);v.setUint16(header+22,bits,true);header+=24;new Uint8Array(out,header,smpl.length).set(smpl);header+=smpl.length;new Uint8Array(out,header,list.length).set(list);header+=list.length;w(header,'data');v.setUint32(header+4,size,true);const data=Array.from({length:ch},(_,c)=>buffer.getChannelData(c));let o=header+8;for(let i=0;i<frames;i++){if(i%20000===0){checkCancel(hooks);await yieldControl();}for(let c=0;c<ch;c++){const x=Math.max(-1,Math.min(1,data[c][i]));if(bits===8)v.setUint8(o++,Math.max(0,Math.min(255,Math.round((x+1)*127.5))));else{v.setInt16(o,x<0?Math.round(x*32768):Math.round(x*32767),true);o+=2;}}}return new Blob([out],{type:'audio/wav'});}
export function buildSpeedUppercutMetadata(playmode='oneshot'){const mode=normalizePlaymode(playmode);return Object.freeze({...KO2_METADATA,"sound.playmode":mode});}
export async function encodeEpReadyWav(buffer,hooks={},playmode='oneshot'){checkCancel(hooks);return encodeReferenceEpWav(buffer,{name:'speeduppercut.wav',metadata:buildSpeedUppercutMetadata(playmode),module:hooks.referenceModule,moduleProvider:hooks.referenceModuleProvider});}
/**
 * Preserve the original Teenage Engineering playmode when embedded in a WAV.
 * WAVs without this metadata (and other audio formats) default to oneshot.
 */
export function resolveOutputPlaymode(input,requested='oneshot'){
  if(requested!=='original')return{mode:normalizePlaymode(requested),sourcePlaymodeDetected:false};
  const bytes=input instanceof ArrayBuffer?new Uint8Array(input):null;
  if(!bytes||bytes.byteLength<12)return{mode:'oneshot',sourcePlaymodeDetected:false};
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(readAscii(view,0,4)!=='RIFF'||readAscii(view,8,4)!=='WAVE')
    return{mode:'oneshot',sourcePlaymodeDetected:false};
  const embedded=parseKo2Metadata(bytes)?.['sound.playmode'];
  if(embedded==null||embedded==='')return{mode:'oneshot',sourcePlaymodeDetected:false};
  if(!SUPPORTED_PLAYMODES.has(embedded))throw new Error('Unsupported source playmode: '+String(embedded));
  return{mode:embedded,sourcePlaymodeDetected:true};
}
// The public x2 conversion contract. An EP sample upload is a distinct path;
// it may bypass these stages when the input is already EP-compatible.
export const EP_AUDIO_PIPELINE_STAGES=Object.freeze([
  'decode','trim','channels','x2-reference-resample',
  'peak-normalize','s16-quantize','reference-wav'
]);

/**
 * Canonical SpeedUpperCut x2 pipeline, used for individual files and folders.
 * The reference module is required; no silent browser/linear resampler fallback.
 */
export async function processAudio(input,{
  fidelity='hi',channels='stereo',playmode='oneshot',autoTrim=true,context
}={},hooks={}){
  const preset=getPreset(fidelity),ctx=context||null;
  const resolvedPlaymode=resolveOutputPlaymode(input,playmode);
  const stage=(index,progress,label)=>{
    checkCancel(hooks);
    hooks.stage?.(EP_AUDIO_PIPELINE_STAGES[index]);
    hooks.progress?.(progress,label);
  };
  stage(0,.05,'Decoding');
  let buffer=await decodeAudio(input,ctx);
  const sourceStorage=estimateDirectEpStorage({
    frames:buffer.length,sampleRate:buffer.sampleRate,channels:buffer.numberOfChannels
  });
  checkCancel(hooks);
  if(autoTrim){
    stage(1,.2,'Auto-trim');
    buffer=await trimSilence(buffer,-60,.1,hooks);
  }
  stage(2,.35,'Channels');
  buffer=await convertChannels(buffer,resolveOutputChannels(buffer.numberOfChannels,channels),hooks);
  stage(3,.55,'Speed ×2 · reference resampler');
  buffer=await speedAndResample(buffer,EP_REPITCH_FACTOR,preset.sampleRate,hooks);
  stage(4,.82,'Normalize');
  buffer=await normalizeBuffer(buffer,hooks);
  stage(5,.9,'16-bit PCM');
  buffer=await quantizeBuffer(buffer,EP_OUTPUT_BIT_DEPTH,hooks);
  const epStorage=measureEpStorage(buffer);
  const metadata=buildSpeedUppercutMetadata(resolvedPlaymode.mode);
  stage(6,.94,'Reference WAV encoding');
  const blob=await encodeEpReadyWav(buffer,hooks,resolvedPlaymode.mode);
  checkCancel(hooks);
  hooks.progress?.(1,'Done');
  return{
    buffer,blob,metadata,sampleRate:preset.sampleRate,
    bitDepth:EP_OUTPUT_BIT_DEPTH,channels:buffer.numberOfChannels,
    repitchFactor:EP_REPITCH_FACTOR,pitchCompensation:EP_REPITCH_COMPENSATION,
    sourceEpStorage:sourceStorage,epStorage,outputFormat:'wav',
    playmode:resolvedPlaymode.mode,sourcePlaymodeDetected:resolvedPlaymode.sourcePlaymodeDetected
  };
}

/**
 * Shared batch adapter. A one-file import and a folder import both enter the
 * exact same processAudio call with the same options and reference module.
 * Results stream in input order. Callers must explicitly opt into skipping\n * failed inputs via onFileError; cancellations and default errors still throw.
 */
export async function* processAudioInputs(files,options={},hooks={}){
  const sources=Array.from(files||[]),total=sources.length;
  for(let index=0;index<total;index++){
    checkCancel(hooks);
    const file=sources[index];
    if(typeof file?.arrayBuffer!=='function')
      throw new TypeError('Audio input must expose arrayBuffer().');
    hooks.onStart?.(file,index,total);
    let result;
    try{
      const input=await file.arrayBuffer();
      checkCancel(hooks);
      result=await processAudio(input,options,{
        ...hooks,
        progress:(value,phase)=>hooks.progress?.(value,phase,index,total,file)
      });
      checkCancel(hooks);
    }catch(error){
      // An opted-in batch caller may isolate a corrupt or unsupported file.
      // Never swallow user cancellation or change the strict default contract.
      if(error?.name==='AbortError'||hooks.shouldCancel?.())throw error;
      if(typeof hooks.onFileError!=='function')throw error;
      await hooks.onFileError(error,file,index,total);
      checkCancel(hooks);
      continue;
    }
    yield Object.freeze({file,index,total,result});
  }
}

import{audioBufferToS16,flattenAudioBuffer,resampleAudioBufferReference}from '../audio/audioEngine.js?v=20261001-1';
import{decodeAudio,convertChannels}from '../audio/processor.js?v=20261001-1';
import{cropAudioBuffer}from '../audio/waveform-editor.js?v=20261001-1';
import{STOCK_PROFILE}from './profile.js';

const check=(v,msg)=>{if(!v)throw Error('WAV: '+msg);};
export function inspectWav(input){
  const b=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
  const tag=o=>String.fromCharCode(...b.subarray(o,o+4));
  check(b.length>=44&&tag(0)==='RIFF'&&tag(8)==='WAVE','expected RIFF/WAVE');
  check(v.getUint32(4,true)+8===b.length,'RIFF size mismatch');
  let fmt=null,data=null,pos=12;
  while(pos<b.length){
    check(pos+8<=b.length,'truncated chunk header');
    const id=tag(pos),size=v.getUint32(pos+4,true),at=pos+8,end=at+size;
    check(end<=b.length,'truncated chunk data');
    if(id==='fmt '){
      check(!fmt&&size>=16,'duplicate or incomplete fmt');
      fmt={format:v.getUint16(at,true),channels:v.getUint16(at+2,true),sampleRate:v.getUint32(at+4,true),byteRate:v.getUint32(at+8,true),align:v.getUint16(at+12,true),bits:v.getUint16(at+14,true)};
    }else if(id==='data'){check(data===null&&size>0,'duplicate or empty data');data={offset:at,size};}
    pos=end+(size%2);check(pos<=b.length,'missing chunk padding');
  }
  check(fmt&&data,'missing fmt/data');
  check((fmt.format===1&&[8,16,24].includes(fmt.bits))||(fmt.format===3&&fmt.bits===32),'supported output is PCM8/16/24 or float32');
  check([1,2].includes(fmt.channels),'expected mono or stereo');
  check(fmt.sampleRate>0&&fmt.sampleRate<=STOCK_PROFILE.maxRate,'sample rate must be positive and <=96000');
  const frameBytes=fmt.channels*fmt.bits/8;
  check(fmt.align===frameBytes&&fmt.byteRate===fmt.sampleRate*frameBytes,'inconsistent block alignment/byte rate');
  check(data.size%frameBytes===0,'incomplete PCM frame');
  if(fmt.format===3)for(let i=data.offset;i<data.offset+data.size;i+=4)check(Number.isFinite(v.getFloat32(i,true)),'nonfinite float sample');
  return{...fmt,...data,frames:data.size/frameBytes,duration:data.size/frameBytes/fmt.sampleRate,bytes:b.length};
}
// Plain stock WAV container; quantization uses the canonical shared audio engine.
export function encodePcmWav(interleaved,{sampleRate,channels}){
  check([1,2].includes(channels)&&Number.isInteger(sampleRate)&&sampleRate>0&&sampleRate<=96000,'invalid output format');
  check(interleaved.length>0&&interleaved.length%channels===0&&interleaved.every(Number.isFinite),'invalid PCM frames');
  const frames=interleaved.length/channels;
  const planes=Array.from({length:channels},(_,c)=>Float32Array.from({length:frames},(_,i)=>interleaved[i*channels+c]));
  const pcm=audioBufferToS16({length:frames,numberOfChannels:channels,getChannelData:c=>planes[c]});
  const bytes=new Uint8Array(44+pcm.length),v=new DataView(bytes.buffer),text=new TextEncoder();
  bytes.set(text.encode('RIFF'));v.setUint32(4,bytes.length-8,true);bytes.set(text.encode('WAVEfmt '),8);v.setUint32(16,16,true);
  v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*channels*2,true);v.setUint16(32,channels*2,true);v.setUint16(34,16,true);
  bytes.set(text.encode('data'),36);v.setUint32(40,pcm.length,true);bytes.set(pcm,44);return bytes;
}
export async function prepareWav(input,{start=0,end=null,sampleRate=22050,channels=1,context=null,moduleProvider=null}={}){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);inspectWav(bytes);
  const decoded=await decodeAudio(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),context);
  let buffer=cropAudioBuffer(decoded,start,end);
  buffer=await convertChannels(buffer,channels);
  if(buffer.sampleRate!==sampleRate)buffer=await resampleAudioBufferReference(buffer,{speed:1,targetSampleRate:sampleRate,moduleProvider});
  return encodePcmWav(flattenAudioBuffer(buffer).data,{sampleRate,channels});
}

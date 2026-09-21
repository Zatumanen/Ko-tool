let lamePromise=null;
async function getLame(){
  if(!lamePromise)lamePromise=import('https://cdn.jsdelivr.net/npm/@breezystack/lamejs@1.2.7/+esm');
  return lamePromise;
}
function toInt16(buffer){
  const out=Array.from({length:buffer.numberOfChannels},(_,c)=>new Int16Array(buffer.length));
  for(let c=0;c<buffer.numberOfChannels;c++){
    const s=buffer.getChannelData(c),d=out[c];
    for(let i=0;i<s.length;i++){
      const x=Math.max(-1,Math.min(1,s[i]));
      d[i]=x<0?Math.round(x*32768):Math.round(x*32767);
    }
  }
  return out;
}
export async function encodeMp3(buffer,{bitrate=128,hooks={}}={}){
  const lame=await getLame();
  const channels=Math.min(2,buffer.numberOfChannels);
  const supported=[8000,11025,12000,16000,22050,24000,32000,44100,48000];
  if(!supported.includes(buffer.sampleRate))throw Error(`MP3 cannot represent ${buffer.sampleRate} Hz exactly; selected Quality requires a WAV-compatible sample rate.`);
  const enc=new lame.Mp3Encoder(channels,buffer.sampleRate,bitrate);
  const pcm=toInt16(buffer),chunks=[],block=1152;
  for(let i=0;i<buffer.length;i+=block){
    if(hooks.shouldCancel?.())throw Object.assign(new Error('Processing cancelled'),{name:'AbortError'});
    const end=Math.min(buffer.length,i+block);
    const left=pcm[0].subarray(i,end);
    const data=channels===1?enc.encodeBuffer(left):enc.encodeBuffer(left,pcm[1].subarray(i,end));
    if(data?.length)chunks.push(new Int8Array(data));
    hooks.progress?.(Math.min(.99,i/Math.max(1,buffer.length)),'MP3 encoding');
    await new Promise(r=>setTimeout(r,0));
  }
  const tail=enc.flush();
  if(tail?.length)chunks.push(new Int8Array(tail));
  return new Blob(chunks,{type:'audio/mpeg'});
}
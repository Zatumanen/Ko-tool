import createResampleModule from './resampleModule.js';

const DYNAMIC_LIBRARIES=['libsndfile.wasm','libsamplerate.wasm','libtag.wasm','libtag_c.wasm'];
let modulePromise=null;

async function loadResampleModule(){
  if(!modulePromise)modulePromise=createResampleModule({dynamicLibraries:DYNAMIC_LIBRARIES,locateFile:file=>new URL(`./wasm/${file}`,import.meta.url).href});
  return modulePromise;
}

export async function getLibSampleRateModule(){return loadResampleModule();}

function toArrayBuffer(input){
  if(input instanceof ArrayBuffer)return input.slice(0);
  if(ArrayBuffer.isView(input))return input.buffer.slice(input.byteOffset,input.byteOffset+input.byteLength);
  throw new Error('Invalid audio sample data.');
}

export async function resampleInterleavedFloat32(input,sourceRate,targetRate,channels){
  if(sourceRate===targetRate)return new Float32Array(input);
  if(!Number.isFinite(sourceRate)||sourceRate<=0||!Number.isFinite(targetRate)||targetRate<=0)throw new Error('Invalid sample rate.');
  if(!Number.isInteger(channels)||channels<1||channels>2)throw new Error('EP-133 resampler supports 1 or 2 channels.');
  if(!(input instanceof Float32Array))input=new Float32Array(input);
  const module=await loadResampleModule();
  const output=await module.resampleAudioData(toArrayBuffer(input),sourceRate,targetRate,'pcm','pcm',16,channels);
  const bytes=output instanceof Uint8Array?output:new Uint8Array(output.buffer||output);
  if(bytes.byteLength%2)throw new Error('EP-133 resampler returned invalid PCM data.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const samples=Math.floor(bytes.byteLength/2),result=new Float32Array(samples);
  for(let i=0;i<samples;i++){const value=view.getInt16(i*2,true);result[i]=value<0?value/32768:value/32767;}
  return result;
}

export {DYNAMIC_LIBRARIES};

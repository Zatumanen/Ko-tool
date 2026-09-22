const DEFAULT_WASM_URL='https://raw.githubusercontent.com/pbarilla/ep_133_sample_tool/28e545a8a9db09d75802fc9ce612779d2690b556/data/libsamplerate.wasm';
const DEFAULT_WASM_GIT_BLOB_SHA='537871e90eeb3373144066543dd2a01c205173a6';
let modulePromise=null;

function lrint(value){
  const floor=Math.floor(value),fraction=value-floor;
  if(fraction<0.5)return floor;
  if(fraction>0.5)return floor+1;
  return (floor&1)?floor+1:floor;
}

function createRuntime(){
  const memory=new WebAssembly.Memory({initial:64,maximum:1024});
  const table=new WebAssembly.Table({initial:10,maximum:1000,element:'anyfunc'});
  let heap=1024*1024;
  const ensureMemory=bytes=>{
    const required=heap+bytes;
    const current=memory.buffer.byteLength;
    if(required>current)memory.grow(Math.ceil((required-current)/65536));
  };
  const alloc=bytes=>{
    ensureMemory(bytes);
    const ptr=heap;
    heap=(heap+bytes+15)&~15;
    return ptr;
  };
  const bytes=new Uint8Array(memory.buffer);
  const env={
    memory,
    __indirect_function_table:table,
    __stack_pointer:new WebAssembly.Global({value:'i32',mutable:true},65536),
    __memory_base:new WebAssembly.Global({value:'i32',mutable:false},0),
    __table_base:new WebAssembly.Global({value:'i32',mutable:false},0),
    calloc:(count,size)=>alloc(count*size),
    free:()=>{},
    memset:(ptr,value,length)=>{new Uint8Array(memory.buffer,ptr,length).fill(value);return ptr;},
    memmove:(dst,src,length)=>{new Uint8Array(memory.buffer).copyWithin(dst,src,src+length);return dst;},
    memcpy:(dst,src,length)=>{new Uint8Array(memory.buffer,dst,length).set(new Uint8Array(memory.buffer,src,length));return dst;},
    lrint
  };
  return {memory,alloc,env};
}

async function sha1Hex(bytes){
  const digest=await crypto.subtle.digest('SHA-1',bytes);
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
async function loadModule(url=DEFAULT_WASM_URL){
  const response=await fetch(url);
  if(!response.ok)throw new Error(`Could not load EP-133 resampler: HTTP ${response.status}`);
  const bytes=await response.arrayBuffer();
  if(url===DEFAULT_WASM_URL){
    const header=new TextEncoder().encode(`blob ${bytes.byteLength}\\0`);
    const blob=new Uint8Array(header.length+bytes.byteLength);
    blob.set(header);
    blob.set(new Uint8Array(bytes),header.length);
    const actual=await sha1Hex(blob);
    if(actual!==DEFAULT_WASM_GIT_BLOB_SHA)throw new Error('EP-133 resampler integrity check failed.');
  }
  return WebAssembly.compile(bytes);
}
async function instantiateModule(module){
  const runtime=createRuntime();
  const instance=await WebAssembly.instantiate(module,{env:runtime.env});
  instance.exports.__wasm_call_ctors?.();
  instance.exports.__wasm_apply_data_relocs?.();
  return{...runtime,exports:instance.exports};
}

export async function getLibSampleRateModule(url){
  if(!modulePromise||url)modulePromise=loadModule(url||DEFAULT_WASM_URL);
  return instantiateModule(await modulePromise);
}

export async function resampleInterleavedFloat32(input,sourceRate,targetRate,channels,{wasmUrl}={}){
  if(sourceRate===targetRate)return new Float32Array(input);
  if(!Number.isFinite(sourceRate)||sourceRate<=0||!Number.isFinite(targetRate)||targetRate<=0)throw new Error('Invalid sample rate.');
  if(!Number.isInteger(channels)||channels<1||channels>2)throw new Error('EP-133 resampler supports 1 or 2 channels.');
  const {memory,alloc,exports}=await getLibSampleRateModule(wasmUrl);
  const frames=Math.floor(input.length/channels);
  const ratio=targetRate/sourceRate;
  if(ratio<1/256||ratio>256)throw new Error('Sample-rate ratio is outside libsamplerate limits.');
  const maxOutputFrames=Math.max(1,Math.ceil(frames*ratio)+256);
  const inputPtr=alloc(input.byteLength);
  const outputPtr=alloc(maxOutputFrames*channels*4);
  const dataPtr=alloc(40);
  new Float32Array(memory.buffer,inputPtr,input.length).set(input);
  const view=new DataView(memory.buffer);
  view.setUint32(dataPtr,inputPtr,true);
  view.setUint32(dataPtr+4,outputPtr,true);
  view.setInt32(dataPtr+8,frames,true);
  view.setInt32(dataPtr+12,maxOutputFrames,true);
  view.setInt32(dataPtr+16,0,true);
  view.setInt32(dataPtr+20,0,true);
  view.setInt32(dataPtr+24,1,true);
  view.setFloat64(dataPtr+32,ratio,true);
  const error=exports.src_simple(dataPtr,0,channels);
  if(error!==0){
    const errorPtr=exports.src_strerror(error);
    const text=new Uint8Array(memory.buffer);
    let message='';
    for(let i=errorPtr;i<text.length&&text[i]&&i<errorPtr+256;i++)message+=String.fromCharCode(text[i]);
    throw new Error(message||`libsamplerate error ${error}`);
  }
  const generated=view.getInt32(dataPtr+20,true);
  return new Float32Array(memory.buffer,outputPtr,generated*channels).slice();
}

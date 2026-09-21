const TARGET_RATE=46875;

function readAscii(view,offset,length){let s='';for(let i=0;i<length;i++)s+=String.fromCharCode(view.getUint8(offset+i));return s;}

function parseNativeWav(bytes){
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
  if(!fmt||dataOffset<0||fmt.format!==1||fmt.bits!==16||(fmt.channels!==1&&fmt.channels!==2)||fmt.rate!==TARGET_RATE)return null;
  return {data:bytes.slice(dataOffset,dataOffset+dataSize),channels:fmt.channels};
}

async function decode(file){
  const C=window.AudioContext||window.webkitAudioContext;
  if(!C)throw new Error('Web Audio API is not supported by this browser.');
  const ctx=new C();
  try{return await ctx.decodeAudioData((await file.arrayBuffer()).slice(0));}
  finally{try{await ctx.close();}catch{}}
}

async function resample(buffer){
  if(buffer.sampleRate===TARGET_RATE)return buffer;
  const frames=Math.max(1,Math.round(buffer.duration*TARGET_RATE));
  const C=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  if(!C)throw new Error('OfflineAudioContext is required for EP-133 sample conversion.');
  const ctx=new C(buffer.numberOfChannels,frames,TARGET_RATE);
  const source=ctx.createBufferSource();
  source.buffer=buffer;
  source.connect(ctx.destination);
  source.start(0);
  return ctx.startRendering();
}

function encodePcm16(buffer){
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
  return{data:out,channels,samplerate:TARGET_RATE,format:'s16'};
}

export async function prepareEp133Sample(file,{onProgress}={}){
  if(!file)throw new Error('No audio file supplied.');
  const name=String(file.name||'sample.wav');
  if(!/\.(wav|mp3|aac|ogg|flac|m4a)$/i.test(name)&&!String(file.type||'').startsWith('audio/'))throw new Error('Unsupported audio file.');
  const native=parseNativeWav(new Uint8Array(await file.arrayBuffer()));
  if(native){
    onProgress?.(100,{status:'ready'});
    return{data:native.data,channels:native.channels,samplerate:TARGET_RATE,format:'s16'};
  }
  onProgress?.(0,{status:'decoding'});
  const decoded=await decode(file);
  if(decoded.duration>20)throw new Error('Maximum EP-133 sample length is 20 seconds.');
  if(decoded.numberOfChannels<1||decoded.numberOfChannels>2)throw new Error('EP-133 samples must have 1 or 2 channels.');
  onProgress?.(35,{status:'resampling'});
  const converted=await resample(decoded);
  onProgress?.(80,{status:'encoding'});
  const result=encodePcm16(converted);
  onProgress?.(100,{status:'ready'});
  return result;
}

function parseNativeChannels(file){
  return 2;
}
export const EP133_SAMPLE_RATE=TARGET_RATE;

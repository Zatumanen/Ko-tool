export function normalizeFileName(name,stripSlotPrefix=false){
  let value=String(name||'sample.wav');
  if(stripSlotPrefix)value=value.replace(/^(?:00[1-9]|0[1-9][0-9]|[1-9][0-9]{2})[ \t]+(?=\S)/,'');
  value=value.split('.').slice(0,-1).join('.')||value;
  value=value.replace(/\//g,'').trim().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^\x20-\x7F]/g,'?').replace(/[\\"]/g,'');
  if(value.length>16)value=value.substring(0,7)+'.'+value.substring(value.length-8);
  return value.toLowerCase()||'sample';
}

const SAMPLE_WRITABLE_METADATA_KEYS=new Set([
  'name','sample.start','sample.end','sample.mode','regions',
  'sound.loopstart','sound.loopend','sound.amplitude','sound.playmode','sound.rootnote',
  'sound.bpm','sound.pitch','sound.pan','sound.bars','envelope.attack','envelope.release','time.mode'
]);
const SAMPLE_TRANSPORT_METADATA_KEYS=new Set(['channels','samplerate','format','crc']);

export function prepareSampleCreateMetadata(metadata={}){
  const result={};
  if(metadata?.name!=null)result.name=normalizeFileName(metadata.name);
  const channels=Number(metadata?.channels);
  const samplerate=Number(metadata?.samplerate);
  const format=String(metadata?.format||'');
  const crc=Number(metadata?.crc);
  if(Number.isInteger(channels)&&(channels===1||channels===2))result.channels=channels;
  if(Number.isFinite(samplerate)&&samplerate>=3000&&samplerate<=768000)result.samplerate=samplerate;
  if(format==='s16')result.format=format;
  if(Number.isInteger(crc)&&crc>=0&&crc<=0xffffffff)result.crc=crc;
  return result;
}

const SAMPLE_PLAY_MODES=new Set(['oneshot','key','legato','loop']);
const allowedPlayModeSet=allowed=>{
  if(!Array.isArray(allowed))return null;
  return new Set(allowed.map(String).filter(value=>SAMPLE_PLAY_MODES.has(value)));
};
const SAMPLE_TIME_MODES=new Set(['off','bpm','bar']);
const allowedBarValueSet=allowed=>{
  if(!Array.isArray(allowed))return null;
  return new Set(allowed.map(Number).filter(value=>Number.isInteger(value)&&value>0));
};
const finiteRange=(value,min,max)=>Number.isFinite(Number(value))&&Number(value)>=min&&Number(value)<=max;
const integerRange=(value,min,max)=>Number.isInteger(Number(value))&&Number(value)>=min&&Number(value)<=max;

export function prepareSampleWritableMetadata(metadata={},options={}){
  const result={};
  const allowedPlayModes=allowedPlayModeSet(options?.allowedPlayModes);
  const allowedBarValues=allowedBarValueSet(options?.allowedBarValues);
  const barWriteMode=String(options?.barWriteMode||'preserve');
  if(!['preserve','verified','omit'].includes(barWriteMode))throw new Error('Unknown sample bar write mode: '+barWriteMode);
  const allowAdvancedMetadata=options?.allowAdvancedMetadata!==false;
  for(const[key,value]of Object.entries(metadata||{})){
    if(key==='name'){result.name=normalizeFileName(value);continue;}
    if(SAMPLE_TRANSPORT_METADATA_KEYS.has(key))continue;
    if(!allowAdvancedMetadata)continue;
    if(!SAMPLE_WRITABLE_METADATA_KEYS.has(key)){result[key]=value;continue;}
    if(key==='sample.start'||key==='sample.end'){
      if(integerRange(value,-1,0x7fffffff))result[key]=Number(value);
      continue;
    }
    if(key==='sample.mode'){
      if(value!=null&&String(value).length>0)result[key]=value;
      continue;
    }
    if(key==='regions'){
      if(Array.isArray(value))result[key]=value;
      continue;
    }
    if(key==='sound.loopstart'||key==='sound.loopend'){
      if(integerRange(value,-1,0x7fffffff))result[key]=Number(value);
      continue;
    }
    if(key==='sound.amplitude'){
      if(finiteRange(value,0,200))result[key]=Number(value);
      continue;
    }
    if(key==='sound.playmode'){
      const normalized=typeof value==='number'?['oneshot','key','legato','loop'][value]:value!=null?String(value):'';
      if(normalized&&allowedPlayModes&&!allowedPlayModes.has(normalized))
        throw new Error("Sample play mode '"+normalized+"' is not allowed by the connected EP profile.");
      if(normalized)result[key]=normalized;
      continue;
    }
    if(key==='sound.rootnote'){
      if(integerRange(value,1,127))result[key]=Number(value);
      continue;
    }
    if(key==='sound.bpm'){
      if(finiteRange(value,1,200))result[key]=Number(value);
      continue;
    }
    if(key==='sound.pitch'){
      if(finiteRange(value,-12,12))result[key]=Number(value);
      continue;
    }
    if(key==='sound.pan'){
      if(finiteRange(value,-16,16))result[key]=Number(value);
      continue;
    }
    if(key==='sound.bars'){
      if(barWriteMode==='omit')continue;
      const bars=Number(value);
      if(barWriteMode==='verified'&&!allowedBarValues)
        throw new Error('Sample bar authoring requires an explicit verified value set.');
      if(Number.isFinite(bars)&&bars>0&&allowedBarValues&&!allowedBarValues.has(bars))
        throw new Error("Sample bar value '"+bars+"' is not allowed by the connected EP profile.");
      if(Number.isFinite(bars)&&bars>0)result[key]=bars;
      continue;
    }
    if(key==='envelope.attack'||key==='envelope.release'){
      if(integerRange(value,0,255))result[key]=Number(value);
      continue;
    }
    if(key==='time.mode'){
      const normalized=typeof value==='number'?['off','bpm','bar'][value]:value!=null?String(value):'';
      if(normalized)result[key]=normalized;
    }
  }
  if('sound.playmode'in result&&!Object.prototype.hasOwnProperty.call(result,'envelope.release'))
    throw new Error("Writing 'sound.playmode' requires 'envelope.release' in the same metadata write.");
  return result;
}

export function prepareSampleLocalMetadata(metadata={},options={}){
  return{
    ...prepareSampleCreateMetadata(metadata),
    ...prepareSampleWritableMetadata(metadata,options)
  };
}

export function prepareSampleTransferMetadata(metadata={},options={}){
  const result={...(metadata||{})};
  const allowedPlayModes=allowedPlayModeSet(options?.allowedPlayModes);
  const allowedBarValues=allowedBarValueSet(options?.allowedBarValues);
  delete result.crc;

  if('sound.playmode' in result){
    const raw=result['sound.playmode'];
    const normalized=typeof raw==='number'?['oneshot','key','legato','loop'][raw]:String(raw);
    if(!normalized)throw new Error('Invalid source sample play mode.');
    if(allowedPlayModes&&!allowedPlayModes.has(normalized))
      throw new Error("Source sample play mode '"+normalized+"' is not allowed by the connected EP profile.");
    result['sound.playmode']=normalized;
  }

  if('time.mode' in result){
    const raw=result['time.mode'];
    const normalized=typeof raw==='number'?['off','bpm','bar'][raw]:String(raw);
    if(!normalized)throw new Error('Invalid source sample time mode.');
    result['time.mode']=normalized;
  }
  if('sound.bars' in result){
    const bars=Number(result['sound.bars']);
    if(!Number.isFinite(bars)||bars<=0)throw new Error('Invalid source sample bar value.');
    if(allowedBarValues&&!allowedBarValues.has(bars))
      throw new Error("Source sample bar value '"+bars+"' is not allowed by the connected EP profile.");
    result['sound.bars']=bars;
  }
  if('sound.playmode'in result&&!Object.prototype.hasOwnProperty.call(result,'envelope.release'))
    throw new Error("Writing 'sound.playmode' requires 'envelope.release' in the same metadata write.");
  return result;
}

export function createTransferFileName(sourceId,targetId){
  const source=String(Math.max(0,Number(sourceId)||0)).padStart(3,'0');
  const target=String(Math.max(0,Number(targetId)||0)).padStart(3,'0');
  return normalizeFileName('mv'+source+'_'+target);
}

export async function uploadSampleToSlotWithTransport({
  file,data,filename,parentId,destinationId,metadata={},
  allowedPlayModes=null,allowAdvancedMetadata=true,allowedBarValues=null,barWriteMode='preserve',
  onProgress,onCreated
},{
  putFile,setFileMetadata,initFileSystem
}={}){
  if(typeof putFile!=='function'||typeof setFileMetadata!=='function'||typeof initFileSystem!=='function')
    throw new TypeError('Sample upload transport is incomplete.');

  const bytes=data instanceof Uint8Array?data:new Uint8Array(await file.arrayBuffer());
  if(bytes.byteLength===0)throw new Error('Cannot upload an empty sample.');
  const name=filename||file?.name||'sample.wav';
  const wireName=normalizeFileName(name);
  const displayName=normalizeFileName(metadata?.name||name);
  const uploadMetadata={...metadata,name:displayName};
  const createMetadata=prepareSampleCreateMetadata(uploadMetadata);
  if(!createMetadata.name||!createMetadata.channels||!createMetadata.samplerate||createMetadata.format!=='s16')
    throw new Error('EP-series upload metadata is incomplete or unsupported.');
  const writableMetadata=prepareSampleWritableMetadata(uploadMetadata,{
    allowedPlayModes,allowAdvancedMetadata,allowedBarValues,barWriteMode
  });
  const fileId=await putFile({
    data:bytes,filename:wireName,parentId,destinationId,metadata:createMetadata,onProgress
  });
  onCreated?.(fileId);
  if(Object.keys(writableMetadata).length)await setFileMetadata(fileId,writableMetadata);
  await initFileSystem();
  return fileId;
}

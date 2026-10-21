import{createZip}from '../zip.js?v=20261022-1';

const encoder=new TextEncoder();
const bytes=value=>value instanceof Uint8Array?value:new Uint8Array(value||[]);
const concat=chunks=>{
  const out=new Uint8Array(chunks.reduce((sum,chunk)=>sum+chunk.length,0));
  let at=0;for(const chunk of chunks){out.set(chunk,at);at+=chunk.length;}return out;
};
const fourcc=value=>encoder.encode(value);
const u32=value=>{const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,value>>>0,true);return b;};
const chunk=(tag,data)=>{
  const b=bytes(data);
  return concat([fourcc(tag),u32(b.length),b,...(b.length%2?[new Uint8Array(1)]:[])]);
};
const metaFields=[
  'sound.loopstart','sound.loopend','sound.playmode','sound.rootnote',
  'sound.bpm','sound.pitch','sound.pan','sound.amplitude',
  'envelope.attack','envelope.release','time.mode',
  'sample.start','sample.end','sample.mode','regions'
];
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const allowedMeta=(key,value)=>{
  if(value==null)return false;
  switch(key){
    case 'sound.loopstart':case 'sound.loopend':return finite(value)&&value>=0;
    case 'sound.rootnote':return Number.isInteger(value)&&value>0&&value<=127;
    case 'sound.bpm':return finite(value)&&value>=60&&value<=180;
    case 'sound.pitch':return finite(value)&&value>=-12&&value<=12;
    case 'sound.pan':return finite(value)&&value>=-16&&value<=16;
    case 'sound.amplitude':return finite(value)&&value>=0&&value<=200;
    case 'envelope.attack':case 'envelope.release':return finite(value)&&value>=0&&value<=255;
    case 'sound.playmode':case 'time.mode':return typeof value==='string'&&value.length>0;
    default:return true; // sample.start/end/mode and regions are device metadata
  }
};
const safeSampleName=(name,slot)=>{
  const value=String(name||'').replace(/\.wav$/i,'').replace(/[\\/\x00-\x1f\x7f]/g,'_').trim();
  if(!value||value==='.'||value==='..')throw new Error('Official PAK sample '+slot+' has no safe filename.');
  return value;
};

/** Build the RIFF/WAV envelope observed in the official EP Sample Tool v1.2.0.
 *  This never re-encodes PCM: FILE_GET bytes become the exact WAV data chunk.
 */
export function createOfficialSampleWav(sample){
  const slot=Number(sample?.slot),meta=sample?.metadata;
  if(!Number.isInteger(slot)||slot<1||slot>999)throw new Error('Invalid official PAK sample slot.');
  if(!meta||typeof meta!=='object')throw new Error('Missing sample metadata for slot '+slot+'.');
  const channels=Number(meta.channels),rate=Number(meta.samplerate);
  if(meta.format!=='s16'||![1,2].includes(channels)||
     !Number.isInteger(rate)||rate<8000||rate>192000)
    throw new Error('Unsupported WAV format for sample '+slot+'; requires s16 mono/stereo and a valid sample rate.');
  const pcm=bytes(sample.data);
  if(!pcm.length||pcm.length%(channels*2)!==0)
    throw new Error('Sample '+slot+' has truncated or empty PCM.');
  const root=meta['sound.rootnote'];
  if(!Number.isInteger(root)||root<1||root>127)
    throw new Error('Sample '+slot+' is missing a valid root note.');
  if([meta['sound.loopstart'],meta['sound.loopend']].some(v=>finite(v)&&v>=0))
    throw new Error('Sample '+slot+' has loop markers not yet verified against the official WAV encoder.');

  const fmt=new Uint8Array(16),fv=new DataView(fmt.buffer);
  fv.setUint16(0,1,true);fv.setUint16(2,channels,true);
  fv.setUint32(4,rate,true);fv.setUint32(8,rate*channels*2,true);
  fv.setUint16(12,channels*2,true);fv.setUint16(14,16,true);
  const smpl=new Uint8Array(36);
  new DataView(smpl.buffer).setUint32(12,root,true);

  const compact={};
  for(const key of metaFields)
    if(Object.hasOwn(meta,key)&&allowedMeta(key,meta[key]))compact[key]=meta[key];
  const json=encoder.encode(JSON.stringify(compact));
  const tng=concat([fourcc('TNGE'),u32(json.length+1),json,new Uint8Array(1)]);
  const wavChunks=[chunk('fmt ',fmt),chunk('smpl',smpl)];
  if(allowedMeta('sound.bpm',meta['sound.bpm'])){
    const acid=new Uint8Array(24);
    new DataView(acid.buffer).setFloat32(20,meta['sound.bpm'],true);
    wavChunks.push(chunk('acid',acid));
  }
  wavChunks.push(chunk('LIST',concat([fourcc('INFO'),tng])));
  wavChunks.push(chunk('data',pcm));
  const body=concat([fourcc('WAVE'),...wavChunks]);
  return concat([fourcc('RIFF'),u32(body.length),body]);
}

const projectNumber=record=>{
  const value=String(record?.project??record?.number??'').padStart(2,'0');
  if(!/^\d{2}$/.test(value))throw new Error('Invalid official PAK project ID.');
  return value;
};

/**
 * A separate read-only exporter. Existing SpeedUpperCut v1 ZIPs and their
 * restore/import code remain untouched. The official PAK is ZIP/Deflate.
 */
export async function createOfficialEpPak({
  scope,device,projects=[],samples=[],createdAt=new Date()
}={}){
  if(!['device','project+samples'].includes(scope))
    throw new Error('Only whole-device .pak and project+samples .ppak are supported.');
  const sku=String(device?.sku||'').toUpperCase();
  const firmware=String(device?.metadata?.os_version||'');
  if(sku!=='TE032AS001'||firmware!=='2.5.1')
    throw new Error('Official PAK export is verified only for EP-133 TE032AS001 OS 2.5.1.');
  if(!Array.isArray(projects)||!projects.length||
     (scope==='project+samples'&&projects.length!==1))
    throw new Error('Official PAK requires the complete requested project selection.');
  if(!Array.isArray(samples))throw new Error('Official PAK samples are missing.');
  const seenProjects=new Set(),seenSamples=new Set(),files=[];
  for(const p of projects){
    const number=projectNumber(p);
    if(seenProjects.has(number))throw new Error('Duplicate official PAK project P'+number+'.');
    seenProjects.add(number);
    const tar=bytes(p?.data);
    if(!tar.length||tar.length%512!==0)
      throw new Error('Incomplete official PAK project P'+number+' TAR.');
    files.push({path:'/projects/P'+number+'.tar',blob:new Blob([tar])});
    if(scope==='project+samples'){
      const missing=p?.dependencies?.missingSampleSlots;
      if(!Array.isArray(missing)||missing.length||p.dependencies?.allSamplesAvailable!==true)
        throw new Error('Project P'+number+' dependencies are incomplete or unverified.');
      const referenced=p.dependencies.referencedSampleSlots;
      if(!Array.isArray(referenced)||
         referenced.some(slot=>!samples.some(s=>Number(s.slot)===Number(slot))))
        throw new Error('Project P'+number+' has missing referenced samples.');
    }
  }
  for(const sample of samples){
    const slot=Number(sample?.slot);
    if(!Number.isInteger(slot)||slot<1||slot>999||seenSamples.has(slot))
      throw new Error('Invalid or duplicate official PAK sample slot.');
    seenSamples.add(slot);
    const name=safeSampleName(sample?.name||sample?.metadata?.name,slot);
    const wav=createOfficialSampleWav(sample);
    files.push({path:'/sounds/'+String(slot).padStart(3,'0')+' '+name+'.wav',
      blob:new Blob([wav],{type:'audio/wav'})});
  }
  const date=createdAt instanceof Date?createdAt:new Date(createdAt);
  if(!Number.isFinite(date.valueOf()))throw new Error('Invalid official PAK backup date.');
  const info={
    info:'teenage engineering - pak file',pak_version:1,
    pak_type:scope==='device'?'user':'project',
    pak_release:'1.2.0',
    device_name:String(device?.name||'EP-133'),
    device_sku:sku,device_version:firmware,
    generated_at:date.toISOString(),author:'computer',
    base_sku:String(device?.metadata?.base_sku||sku)
  };
  // Never copy device serial, identity hashes or private device metadata.
  files.push({path:'/meta.json',blob:new Blob([JSON.stringify(info,null,2)],
    {type:'application/json'})});
  const blob=await createZip(files,{compression:'deflate'});
  return{blob,meta:info,projectCount:projects.length,sampleCount:samples.length,
    extension:scope==='device'?'.pak':'.ppak'};
}

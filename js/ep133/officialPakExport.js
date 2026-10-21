import{createZip}from '../zip.js?v=20261001-1';
import{crc32Hex}from './projectRecovery.js?v=20261001-1';

// Observed: EP Sample Tool 1.2.0 full .pak and project .ppak archives.
// The private reference archives are NOT bundled or committed.
const teKeys=Object.freeze([
  'sound.loopstart','sound.loopend','sound.playmode','sound.rootnote',
  'sound.bpm','sound.pitch','sound.pan','sound.amplitude','envelope.attack',
  'envelope.release','time.mode','sample.start','sample.end','sample.mode','regions'
]);
const numeric=new Set([
  'sound.loopstart','sound.loopend','sound.rootnote','sound.bpm','sound.pitch',
  'sound.pan','sound.amplitude','envelope.attack','envelope.release','sample.start','sample.end'
]);
const limits=Object.freeze({
  'sound.rootnote':[1,127],
  'sound.pitch':[-12,12],
  'sound.pan':[-16,16],
  'sound.amplitude':[0,200],
  'envelope.attack':[0,255],
  'envelope.release':[0,255],
  'sound.bpm':[60,180]
});
const asBytes=a=>a instanceof Uint8Array?a:new Uint8Array(a||[]);
const encoder=new TextEncoder();
const u16=v=>{const a=new Uint8Array(2);new DataView(a.buffer).setUint16(0,v,true);return a;};
const u32=v=>{const a=new Uint8Array(4);new DataView(a.buffer).setUint32(0,v>>>0,true);return a;};
const join=parts=>{
  const total=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(total);
  let offset=0;for(const p of parts){out.set(p,offset);offset+=p.length;}return out;
};
const fourcc=s=>encoder.encode(s);
const chunk=(name,content)=>{
  const bytes=asBytes(content);
  return join([fourcc(name),u32(bytes.length),bytes,...(bytes.length%2?[new Uint8Array(1)]:[])]);
};
const numberField=(value,label)=>{
  if(value==null||value==='')throw new Error('Missing official WAV metadata '+label);
  const n=Number(value);
  if(!Number.isFinite(n))throw new Error('Invalid official WAV metadata '+label);
  return n;
};
const cleanMeta=meta=>{
  if(meta['sample.mode']!=null||meta.regions!=null)
    throw new Error('Official WAV export for sample.mode/regions has not been verified.');
  const result={};
  for(const key of teKeys){
    let v=meta[key];
    if(v==null)continue;
    if(numeric.has(key))v=numberField(v,key);
    if((key==='sound.loopstart'||key==='sound.loopend')&&v<0)continue;
    if(key==='sound.loopstart'||key==='sound.loopend')
      throw new Error('Official WAV loop encoding needs an additional reference test.');
    if(key==='sound.bpm'&&(v<60||v>180))continue;
    if(limits[key]&&(v<limits[key][0]||v>limits[key][1]))
      throw new Error('Official WAV metadata '+key+' is outside the verified range.');
    if((key==='sound.playmode'||key==='time.mode')&&
       (typeof v!=='string'||!v.length))
      throw new Error('Invalid official WAV '+key);
    result[key]=v;
  }
  for(const key of ['sound.playmode','sound.rootnote','sound.pitch','sound.pan',
    'sound.amplitude','envelope.attack','envelope.release','time.mode',
    'sample.start','sample.end']){
    if(!(key in result))throw new Error('Official WAV export requires metadata '+key);
  }
  return result;
};

/** PCM is byte-preserved. RIFF chunks reproduce all 331 owner-supplied official WAVs. */
export function encodeOfficialEpWav(pcmInput,metadata){
  const meta=metadata&&typeof metadata==='object'?metadata:null;
  if(!meta)throw new Error('Official WAV metadata is missing.');
  const pcm=asBytes(pcmInput);
  const channels=numberField(meta.channels,'channels');
  const samplerate=numberField(meta.samplerate,'samplerate');
  if(meta.format!=='s16'||![1,2].includes(channels)||!Number.isInteger(samplerate)||
    samplerate<8000||samplerate>96000||!pcm.length||pcm.length%(channels*2))
    throw new Error('Official WAV export supports only complete PCM16 mono/stereo samples.');
  if(pcm.length>0xffffffff-4096)throw new Error('Official WAV is too large.');
  if(meta.crc!=null&&parseInt(crc32Hex(pcm),16)!==Number(meta.crc))
    throw new Error('Official WAV PCM CRC disagrees with the device metadata.');
  const native=cleanMeta(meta);
  const format=join([u16(1),u16(channels),u32(samplerate),u32(samplerate*channels*2),
    u16(channels*2),u16(16)]);
  const smpl=join([u32(0),u32(0),u32(0),u32(native['sound.rootnote']),
    u32(0),u32(0),u32(0),u32(0),u32(0)]);
  const json=encoder.encode(JSON.stringify(native));
  // TE's TNGE payload ends in one or more NULs, aligned to four bytes.
  const padded=new Uint8Array(Math.ceil((json.length+1)/4)*4);
  padded.set(json);
  const list=chunk('LIST',join([fourcc('INFO'),chunk('TNGE',padded)]));
  const acid=('sound.bpm' in native)?(()=>{
    const data=new Uint8Array(24);
    new DataView(data.buffer).setFloat32(20,native['sound.bpm'],true);
    return chunk('acid',data);
  })():new Uint8Array();
  const body=join([fourcc('WAVE'),chunk('fmt ',format),chunk('smpl',smpl),
    acid,list,chunk('data',pcm)]);
  return join([fourcc('RIFF'),u32(body.length),body]);
}
const safeName=value=>{
  const name=String(value||'').split('/').join('_').split(String.fromCharCode(92)).join('_').replace(/[\x00-\x1f]/g,'_').trim();
  if(!name||name==='.'||name==='..'||name.length>120)
    throw new Error('Sample name cannot be represented safely in a .pak filename.');
  return name.toLowerCase().endsWith('.wav')?name.slice(0,-4):name;
};
const safeProject=value=>{
  const p=String(value??'').padStart(2,'0');
  if(!/^[0-9]{2}$/.test(p))throw new Error('Invalid official backup project number.');
  return p;
};

/** Produce the official *archive schema*, not a guarantee of official restore support. */
export async function createOfficialEpPak({
  scope,device,projects=[],samples=[],createdAt=new Date()
}={}){
  if(!['device','project'].includes(scope))
    throw new Error('Official export requires device or project scope.');
  const sku=String(device?.sku||'').toUpperCase();
  const firmware=String(device?.metadata?.os_version||'');
  // HIL evidence is exact model+firmware, not an approval for arbitrary EPs.
  if(sku!=='TE032AS001'||firmware!=='2.5.1')
    throw new Error('Official .pak export is verified only for EP-133 firmware 2.5.1.');
  const activeProjects=Array.from(projects||[]);
  if(!activeProjects.length||(scope==='project'&&activeProjects.length!==1))
    throw new Error('Official backup has an invalid project count.');
  const files=[],seenProjects=new Set(),seenSlots=new Set();
  for(const project of activeProjects){
    const p=safeProject(project?.project??project?.number);
    if(seenProjects.has(p))throw new Error('Duplicate project P'+p+'.');
    seenProjects.add(p);
    const tar=asBytes(project?.data);
    if(!tar.length||tar.length%512)throw new Error('Invalid project P'+p+' TAR byte length.');
    files.push({path:'/projects/P'+p+'.tar',blob:new Blob([tar])});
  }
  for(const sample of samples||[]){
    const slot=Number(sample?.slot);
    if(!Number.isInteger(slot)||slot<1||slot>999||seenSlots.has(slot))
      throw new Error('Invalid or duplicate official backup sample slot.');
    seenSlots.add(slot);
    const id=String(slot).padStart(3,'0');
    const label=safeName(sample?.metadata?.name||sample?.name);
    const wav=encodeOfficialEpWav(sample?.data,sample?.metadata);
    files.push({path:'/sounds/'+id+' '+label+'.wav',blob:new Blob([wav])});
  }
  const data={
    info:'teenage engineering - pak file',
    pak_version:1,
    pak_type:scope==='device'?'user':'project',
    pak_release:'1.2.0',
    device_name:String(device?.name||'EP-133'),
    device_sku:sku,
    device_version:firmware,
    generated_at:new Date(createdAt).toISOString(),
    author:'K.O. Tool'
  };
  const base=String(device?.metadata?.base_sku||'').toUpperCase();
  if(base&&/^TE[0-9]{3}AS[0-9]{3}$/.test(base))data.base_sku=base;
  files.push({path:'/meta.json',blob:new Blob([JSON.stringify(data,null,2)],{type:'application/json'})});
  return{blob:await createZip(files,{compression:'deflate'}),
    format:scope==='device'?'pak':'ppak',
    projects:seenProjects.size,samples:seenSlots.size};
}

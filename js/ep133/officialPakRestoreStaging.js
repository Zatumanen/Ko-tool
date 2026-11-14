import{crc32Hex}from './projectRecovery.js?v=20261001-1';

/**
 * Offline-only staging of validated official PAK/PPAK members.
 *
 * The caller must obtain inventory from inspectOfficialPak() and members from
 * readOfficialPakZip() on the SAME input. The canonical CRC and lengths are
 * independently checked again here. Staging never talks to EP, maps slots,
 * rewrites project bytes, creates a runnable restore plan, or grants writes.
 *
 * Returned Uint8Array payloads are detached copies and deliberately remain
 * non-authoritative. Device FILE_GET, firmware rights, backup, transaction,
 * checkpoint, conflict resolution and HIL are required before any restore.
 */
const text=new TextDecoder('utf-8',{fatal:true});
const u32=(data,at)=>new DataView(data.buffer,data.byteOffset,data.byteLength).getUint32(at,true);
const assert=(valid,message)=>{if(!valid)throw new Error('Official PAK staging: '+message);};
const code=(data,at)=>text.decode(data.subarray(at,at+4));
const pad=slot=>String(slot).padStart(3,'0');
const normal=value=>String(value??'').trim().toUpperCase();

function readPcmWithoutConverting(wav,slot){
  assert(wav instanceof Uint8Array&&wav.length>=44,'missing WAV payload for slot '+slot);
  assert(code(wav,0)==='RIFF'&&code(wav,8)==='WAVE'&&u32(wav,4)+8===wav.length,
    'invalid RIFF envelope for slot '+slot);
  let pos=12,pcm=null;
  while(pos<wav.length){
    assert(pos+8<=wav.length,'truncated WAV chunk for slot '+slot);
    const type=code(wav,pos),size=u32(wav,pos+4);
    const end=pos+8+size;
    assert(end<=wav.length,'out-of-bounds WAV chunk for slot '+slot);
    if(type==='data'){
      assert(pcm===null&&size>0,'duplicate or empty PCM chunk for slot '+slot);
      pcm=wav.slice(pos+8,end);
    }
    pos=end+(size&1);
    assert(pos<=wav.length,'WAV padding exceeds file for slot '+slot);
  }
  assert(pcm!==null,'missing PCM data for slot '+slot);
  return pcm;
}

function sourceIdentity(inventory,device){
  const metadata=inventory.metadata||{};
  const source={
    sku:normal(metadata.device_sku),baseSku:normal(metadata.base_sku),
    firmware:String(metadata.device_version??'').trim()
  };
  const target={
    sku:normal(device?.identitySku),baseSku:normal(device?.baseSku||device?.metadata?.base_sku),
    firmware:String(device?.metadata?.os_version||device?.metadata?.sw_version||'').trim()
  };
  const allKnown=[...Object.values(source),...Object.values(target)].every(Boolean);
  return Object.freeze({source:Object.freeze(source),target:Object.freeze(target),
    status:allKnown?(source.sku===target.sku&&source.baseSku===target.baseSku&&
      source.firmware===target.firmware?'match':'mismatch'):'unverified'});
}

export function stageOfficialPakRestoreReadOnly(inventory,members,{device=null}={}){
  assert(inventory&&['pak','ppak'].includes(inventory.format)&&
    Array.isArray(inventory.projects)&&Array.isArray(inventory.sounds),
  'validated archive inventory required');
  assert(members instanceof Map&&members.has('/meta.json'),'verified ZIP members required');
  const metaBytes=members.get('/meta.json');
  assert(metaBytes instanceof Uint8Array,'missing archive identity metadata');
  let meta;
  try{meta=JSON.parse(text.decode(metaBytes));}
  catch{throw new Error('Official PAK staging: invalid archive identity metadata');}
  assert(meta&&JSON.stringify(meta)===JSON.stringify(inventory.metadata),
    'archive identity differs from validated inventory');
  const samples=[];
  const projectRecords=[];
  const pathSet=new Set(['/meta.json']);
  const slots=new Set();
  const blockers=[];
  for(const sound of inventory.sounds){
    const slot=Number(sound.slot);
    assert(Number.isInteger(slot)&&slot>=1&&slot<=999&&!slots.has(slot),'invalid or duplicate sample slot');
    slots.add(slot);
    const prefix='/sounds/'+pad(slot)+' ';
    const paths=[...members.keys()].filter(path=>
      path.startsWith(prefix)&&/\.wav$/i.test(path)&&
      path.slice(prefix.length,-4)===String(sound.name));
    assert(paths.length===1,'missing or ambiguous WAV member for slot '+slot);
    const path=paths[0],wav=members.get(path);
    assert(wav instanceof Uint8Array&&wav.length===sound.size,'WAV length mismatch for slot '+slot);
    const pcm=readPcmWithoutConverting(wav,slot);
    assert(pcm.length===sound.pcmBytes&&crc32Hex(pcm)===sound.pcmCrc32,
      'PCM fingerprint differs from validated archive slot '+slot);
    assert(pcm.length===Number(sound.sampleFrames)*Number(sound.channels)*2,
      'PCM frame geometry differs for slot '+slot);
    pathSet.add(path);
    const unknownChunks=Object.freeze([...(sound.unknownChunks||[])]);
    if(unknownChunks.length)blockers.push('Slot '+pad(slot)+' contains unknown WAV chunks; preservation needs verification.');
    samples.push(Object.freeze({slot,name:String(sound.name),channels:Number(sound.channels),
      sampleRate:Number(sound.sampleRate),sampleFrames:Number(sound.sampleFrames),
      pcmCrc32:sound.pcmCrc32,pcm,originalWav:wav.slice(),
      metadata:Object.freeze({...sound.metadata}),unknownChunks}));
  }
  for(const project of inventory.projects){
    const number=String(project.number),path='/projects/P'+number+'.tar';
    const tar=members.get(path);
    assert(tar instanceof Uint8Array&&tar.length===project.size,
      'project TAR missing or wrong length for P'+number);
    assert(crc32Hex(tar)===project.crc32,'project TAR checksum mismatch for P'+number);
    pathSet.add(path);
    const refs=Object.freeze([...new Set((project.padReferences||[])
      .map(ref=>Number(ref.slot)))].sort((a,b)=>a-b));
    const missing=Object.freeze(refs.filter(slot=>!slots.has(slot)));
    if(missing.length)blockers.push('Project P'+number+' references samples absent from archive: '+missing.map(pad).join(', ')+'.');
    projectRecords.push(Object.freeze({number,tar:tar.slice(),tarCrc32:project.crc32,
      padReferences:Object.freeze((project.padReferences||[]).map(ref=>Object.freeze({...ref}))),
      referencedSlots:refs,missingInArchive:missing,
      deviceTarget:'unverified',activeProject:'unverified'}));
  }
  assert(pathSet.size===members.size,'ZIP member inventory differs from validated archive');
  const identity=sourceIdentity(inventory,device);
  if(identity.status!=='match')blockers.push('Device identity is '+identity.status+'.');
  blockers.push('Device slot occupancy, PCM readback, firmware WRITE rights and free memory are unverified.');
  blockers.push('Project targets, active project, protected fields and any required slot remapping are unverified.');
  return Object.freeze({kind:'official-pak-offline-staging/v1',format:inventory.format,
    canRestore:false,writeAuthorized:false,requiresHardwareReadback:true,
    identity,samples:Object.freeze(samples),projects:Object.freeze(projectRecords),
    blockers:Object.freeze(blockers),
    summary:Object.freeze({sampleCount:samples.length,projectCount:projectRecords.length,
      totalPcmBytes:samples.reduce((sum,item)=>sum+item.pcm.length,0)})});
}

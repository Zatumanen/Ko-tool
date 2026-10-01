import{createZip}from '../zip.js?v=20261001-1';
import{crc32Hex,hashDeviceIdentity}from './projectRecovery.js?v=20261001-1';

export const EP_BACKUP_SCHEMA='speeduppercut.ep-backup/v1';
export const EP_BACKUP_SCOPES=Object.freeze(['project','project+samples','device']);

const enc=new TextEncoder(),dec=new TextDecoder();
const asBytes=value=>value instanceof Uint8Array?value:new Uint8Array(value||[]);
const cloneBytes=value=>asBytes(value).slice();
const safeName=value=>String(value||'').replace(/[^a-zA-Z0-9._-]+/g,'_').replace(/^_+|_+$/g,'')||'file';
const jsonBlob=value=>new Blob([JSON.stringify(value,null,2)],{type:'application/json'});
const binaryBlob=value=>new Blob([asBytes(value)],{type:'application/octet-stream'});
const u16=(bytes,offset)=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint16(offset,true);
const u32=(bytes,offset)=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(offset,true);

export function normalizeBackupScope(scope){
  const value=String(scope||'');
  if(!EP_BACKUP_SCOPES.includes(value))throw new Error('Unknown EP backup scope: '+value);
  return value;
}

export async function createEpBackupBundle({
  scope,device,activeProject=null,projects=[],samples=[],createdAt=new Date()
}={}){
  const normalizedScope=normalizeBackupScope(scope);
  const timestamp=(createdAt instanceof Date?createdAt:new Date(createdAt)).toISOString();
  const projectRecords=[];
  const sampleRecords=[];
  const files=[];

  for(const project of projects||[]){
    const number=String(project?.project??project?.number??'').padStart(2,'0');
    if(!/^\d{2}$/.test(number))throw new Error('Backup project number must be 00..99.');
    const data=cloneBytes(project?.data);
    if(!data.byteLength)throw new Error('Backup project P'+number+' is empty.');
    const file='projects/P'+number+'.tar';
    projectRecords.push({
      number,file,size:data.byteLength,crc32:crc32Hex(data),
      active:!!project?.active,
      dependencies:{
        referencedSampleSlots:[...(project?.dependencies?.referencedSampleSlots||[])],
        missingSampleSlots:[...(project?.dependencies?.missingSampleSlots||[])],
        allSamplesAvailable:project?.dependencies?.allSamplesAvailable??null
      }
    });
    files.push({path:file,blob:binaryBlob(data)});
  }

  for(const sample of samples||[]){
    const slot=Number(sample?.slot);
    if(!Number.isInteger(slot)||slot<1||slot>999)throw new Error('Backup sample slot must be 001..999.');
    const data=cloneBytes(sample?.data);
    if(!data.byteLength)throw new Error('Backup sample '+String(slot).padStart(3,'0')+' is empty.');
    const id=String(slot).padStart(3,'0');
    const dataFile='samples/'+id+'.bin';
    const metadataFile='samples/'+id+'.json';
    const metadata=sample?.metadata&&typeof sample.metadata==='object'?JSON.parse(JSON.stringify(sample.metadata)):{};
    const name=String(sample?.name||metadata?.name||('sample-'+id));
    sampleRecords.push({
      slot,name,dataFile,metadataFile,size:data.byteLength,
      crc32:crc32Hex(data),
      metadataCrc:Number.isInteger(Number(metadata?.crc))?Number(metadata.crc):null
    });
    files.push({path:dataFile,blob:binaryBlob(data)});
    files.push({path:metadataFile,blob:jsonBlob(metadata)});
  }

  const sku=String(device?.sku||'').toUpperCase();
  const firmware=String(device?.metadata?.os_version||device?.metadata?.sw_version||device?.firmware||'');
  const identityHash=String(device?.identityHash||hashDeviceIdentity(device));
  const manifest={
    schema:EP_BACKUP_SCHEMA,
    createdAt:timestamp,
    scope:normalizedScope,
    device:{sku,firmware,identityHash},
    activeProject:activeProject==null?null:String(activeProject).padStart(2,'0'),
    projects:projectRecords,
    samples:sampleRecords
  };
  files.unshift({path:'manifest.json',blob:jsonBlob(manifest)});
  return{blob:await createZip(files),manifest};
}

export function parseStoredZip(value){
  const bytes=cloneBytes(value);
  const files=new Map();
  let offset=0;
  while(offset+4<=bytes.length){
    const signature=u32(bytes,offset);
    if(signature!==0x04034b50)break;
    if(offset+30>bytes.length)throw new Error('Truncated ZIP local header.');
    const flags=u16(bytes,offset+6);
    const method=u16(bytes,offset+8);
    const expectedCrc=u32(bytes,offset+14);
    const compressedSize=u32(bytes,offset+18);
    const uncompressedSize=u32(bytes,offset+22);
    const nameLength=u16(bytes,offset+26);
    const extraLength=u16(bytes,offset+28);
    if(method!==0)throw new Error('Backup ZIP compression is unsupported.');
    if(flags&0x08)throw new Error('Backup ZIP data descriptors are unsupported.');
    if(compressedSize!==uncompressedSize)throw new Error('Backup ZIP stored-size mismatch.');
    const nameStart=offset+30,nameEnd=nameStart+nameLength;
    const dataStart=nameEnd+extraLength,dataEnd=dataStart+compressedSize;
    if(dataEnd>bytes.length)throw new Error('Truncated ZIP file payload.');
    const name=dec.decode(bytes.slice(nameStart,nameEnd));
    if(!name||name.startsWith('/')||name.includes('..')||name.includes('\\'))
      throw new Error('Unsafe ZIP path: '+name);
    if(files.has(name))throw new Error('Duplicate ZIP path: '+name);
    const data=bytes.slice(dataStart,dataEnd);
    const actualCrc=parseInt(crc32Hex(data),16)>>>0;
    if(actualCrc!==expectedCrc)throw new Error('ZIP CRC mismatch for '+name+'.');
    files.set(name,data);
    offset=dataEnd;
  }
  if(!files.size)throw new Error('Backup ZIP contains no files.');
  return files;
}

export function parseEpBackupBundle(value){
  const files=parseStoredZip(value);
  const manifestBytes=files.get('manifest.json');
  if(!manifestBytes)throw new Error('Backup bundle manifest.json is missing.');
  let manifest;
  try{manifest=JSON.parse(dec.decode(manifestBytes));}
  catch{throw new Error('Backup bundle manifest.json is invalid.');}
  if(manifest?.schema!==EP_BACKUP_SCHEMA)throw new Error('Unsupported EP backup schema.');
  normalizeBackupScope(manifest.scope);

  const projects=(manifest.projects||[]).map(record=>{
    const number=String(record?.number||'').padStart(2,'0');
    const data=files.get(String(record?.file||''));
    if(!data)throw new Error('Backup project P'+number+' payload is missing.');
    if(crc32Hex(data)!==String(record?.crc32||''))throw new Error('Backup project P'+number+' checksum mismatch.');
    return{...record,number,data:data.slice()};
  });
  const samples=(manifest.samples||[]).map(record=>{
    const slot=Number(record?.slot);
    const data=files.get(String(record?.dataFile||''));
    const metadataBytes=files.get(String(record?.metadataFile||''));
    if(!data||!metadataBytes)throw new Error('Backup sample '+String(slot).padStart(3,'0')+' payload is incomplete.');
    if(crc32Hex(data)!==String(record?.crc32||''))throw new Error('Backup sample '+String(slot).padStart(3,'0')+' checksum mismatch.');
    let metadata;
    try{metadata=JSON.parse(dec.decode(metadataBytes));}
    catch{throw new Error('Backup sample '+String(slot).padStart(3,'0')+' metadata is invalid.');}
    return{...record,slot,data:data.slice(),metadata};
  });
  return Object.freeze({
    manifest:Object.freeze({...manifest}),
    projects:Object.freeze(projects),
    samples:Object.freeze(samples)
  });
}

export async function readEpBackupBundleFile(file){
  if(!file?.arrayBuffer)throw new TypeError('Backup file is required.');
  return parseEpBackupBundle(new Uint8Array(await file.arrayBuffer()));
}

export function buildBundleProjectRestorePlan(bundle,projectNumber,{getSampleSlot}={}){
  const number=String(projectNumber||'').padStart(2,'0');
  const project=bundle?.projects?.find(item=>item.number===number);
  if(!project)throw new Error('Project P'+number+' is not present in this backup.');
  const referenced=[...new Set(project.dependencies?.referencedSampleSlots||[])].map(Number).filter(slot=>slot>=1&&slot<=999).sort((a,b)=>a-b);
  const bundled=new Map((bundle?.samples||[]).map(sample=>[Number(sample.slot),sample]));
  const dependencies=referenced.map(slot=>{
    const current=typeof getSampleSlot==='function'?getSampleSlot(slot):null;
    const occupied=!!current?.file;
    const backupSample=bundled.get(slot)||null;
    const currentCrc=Number(current?.meta?.crc);
    const backupCrc=Number(backupSample?.metadata?.crc??backupSample?.metadataCrc);
    let status;
    if(occupied&&Number.isInteger(currentCrc)&&Number.isInteger(backupCrc)&&currentCrc===backupCrc)status='already-matches';
    else if(occupied)status='conflict';
    else if(backupSample)status='restore';
    else status='missing';
    return Object.freeze({slot,status,current,backupSample});
  });
  const restore=dependencies.filter(item=>item.status==='restore');
  const conflicts=dependencies.filter(item=>item.status==='conflict');
  const missing=dependencies.filter(item=>item.status==='missing');
  return Object.freeze({
    project,
    dependencies:Object.freeze(dependencies),
    restore:Object.freeze(restore),
    conflicts:Object.freeze(conflicts),
    missing:Object.freeze(missing),
    canRestore:conflicts.length===0&&missing.length===0
  });
}

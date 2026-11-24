import{createZip}from '../zip.js?v=20261001-1';
import{crc32Hex,hashDeviceIdentity}from './projectRecovery.js?v=20261001-1';
import{readStoredZipViews}from '../archive/zipReader.js';

export const EP_BACKUP_SCHEMA='speeduppercut.ep-backup/v1';
export const EP_BACKUP_SCOPES=Object.freeze(['project','project+samples','device']);

const enc=new TextEncoder(),dec=new TextDecoder();
const asBytes=value=>value instanceof Uint8Array?value:new Uint8Array(value||[]);
const cloneBytes=value=>asBytes(value).slice();
const safeName=value=>String(value||'').replace(/[^a-zA-Z0-9._-]+/g,'_').replace(/^_+|_+$/g,'')||'file';
const jsonBlob=value=>new Blob([JSON.stringify(value,null,2)],{type:'application/json'});
const binaryBlob=value=>new Blob([asBytes(value)],{type:'application/octet-stream'});
const maxProjects=100,maxSamples=999;
// A full 128 MB EP backup needs room for project archives and ZIP metadata.
const archiveLimit=192*1024*1024,manifestLimit=4*1024*1024;
const metadataLimit=1024*1024,totalMetadataLimit=16*1024*1024;
const legacyZipPolicy={
  limits:{zipMax:archiveLimit,expandedMax:archiveLimit,fileMax:128*1024*1024,
    entryMax:1+maxProjects+2*maxSamples},
  checkPath:name=>{
    if(!name||name.length>512||name.startsWith('/')||name.includes('..')||name.includes('\\')||name.includes('\0'))
      throw new Error('Unsafe legacy ZIP path.');
    return name;
  }
};

function backupSlot(value){
  if((typeof value!=='number'&&typeof value!=='string')||!/^\d{1,3}$/.test(String(value)))return null;
  const slot=Number(value);
  return slot>=1&&slot<=maxSamples?slot:null;
}

function validateProjectDependencies(dependencies){
  if(dependencies==null)return;
  if(typeof dependencies!=='object'||Array.isArray(dependencies))throw new Error('Invalid backup project dependencies.');
  for(const field of ['referencedSampleSlots','missingSampleSlots']){
    const values=dependencies[field];
    if(values==null)continue;
    if(!Array.isArray(values)||values.length>maxSamples)throw new Error('Invalid backup project dependency slots.');
    const slots=new Set(values.map(backupSlot));
    if(slots.has(null)||slots.size!==values.length)throw new Error('Invalid backup project dependency slots.');
  }
}

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
  return new Map([...readStoredZipViews(value,legacyZipPolicy)].map(([name,data])=>[name,Uint8Array.from(data)]));
}

export function parseEpBackupBundle(value){
  const files=readStoredZipViews(value,legacyZipPolicy);
  const manifestBytes=files.get('manifest.json');
  if(!manifestBytes)throw new Error('Backup bundle manifest.json is missing.');
  if(manifestBytes.length>manifestLimit)throw new Error('Backup manifest exceeds its size limit.');
  let manifest;
  try{manifest=JSON.parse(dec.decode(manifestBytes));}
  catch{throw new Error('Backup bundle manifest.json is invalid.');}
  if(manifest?.schema!==EP_BACKUP_SCHEMA)throw new Error('Unsupported EP backup schema.');
  normalizeBackupScope(manifest.scope);
  const projectRecords=manifest.projects??[],sampleRecords=manifest.samples??[];
  if(!Array.isArray(projectRecords)||projectRecords.length>maxProjects||
    !Array.isArray(sampleRecords)||sampleRecords.length>maxSamples)
    throw new Error('Backup manifest contains an invalid project or sample count.');

  const projectIds=new Set(),sampleIds=new Set(),claims=new Set(['manifest.json']);
  const claim=path=>{
    const entry=typeof path==='string'?files.get(path):null;
    if(!entry?.length)throw new Error('Backup payload is missing or empty.');
    if(claims.has(path))throw new Error('Reused backup payload path.');
    claims.add(path);
    return entry;
  };
  const validateSize=(record,data)=>{
    if(record.size!=null&&record.size!==data.byteLength)
      throw new Error('Backup manifest payload size mismatch.');
  };
  // Unique, nonoverlapping ZIP entries bound payload copies by the input size.
  // Keep views until all manifest members have been accepted.
  const projects=projectRecords.map(record=>{
    const raw=record?.number;
    if((typeof raw!=='number'&&typeof raw!=='string')||!/^\d{1,2}$/.test(String(raw)))
      throw new Error('Invalid backup project number.');
    const number=String(raw).padStart(2,'0');
    if(projectIds.has(number))throw new Error('Duplicate backup project number.');
    projectIds.add(number);
    validateProjectDependencies(record.dependencies);
    const data=claim(record.file);
    validateSize(record,data);
    if(crc32Hex(data)!==String(record?.crc32||''))throw new Error('Backup project P'+number+' checksum mismatch.');
    return{...record,number,data};
  });
  let totalMetadata=0;
  const samples=sampleRecords.map(record=>{
    const slot=backupSlot(record?.slot);
    if(slot===null)throw new Error('Invalid backup sample slot.');
    if(sampleIds.has(slot))throw new Error('Duplicate backup sample slot.');
    sampleIds.add(slot);
    const data=claim(record.dataFile),metadataBytes=claim(record.metadataFile);
    totalMetadata+=metadataBytes.length;
    if(metadataBytes.length>metadataLimit||totalMetadata>totalMetadataLimit)
      throw new Error('Backup sample metadata exceeds its size limit.');
    validateSize(record,data);
    if(crc32Hex(data)!==String(record?.crc32||''))throw new Error('Backup sample '+String(slot).padStart(3,'0')+' checksum mismatch.');
    let metadata;
    try{metadata=JSON.parse(dec.decode(metadataBytes));}
    catch{throw new Error('Backup sample '+String(slot).padStart(3,'0')+' metadata is invalid.');}
    if(!metadata||typeof metadata!=='object'||Array.isArray(metadata))
      throw new Error('Backup sample metadata must be an object.');
    return{...record,slot,data,metadata};
  });
  for(const record of [...projects,...samples])record.data=Uint8Array.from(record.data);
  return Object.freeze({
    manifest:Object.freeze({...manifest}),
    projects:Object.freeze(projects),
    samples:Object.freeze(samples)
  });
}

export async function readEpBackupBundleFile(file){
  if(typeof file?.arrayBuffer!=='function')throw new TypeError('Backup file is required.');
  const size=file.size;
  if(!Number.isSafeInteger(size)||size<22||size>archiveLimit)
    throw new Error('Backup ZIP size outside safe limits.');
  const buffer=await file.arrayBuffer();
  if(buffer.byteLength!==size)throw new Error('Backup ZIP size changed during read.');
  return parseEpBackupBundle(new Uint8Array(buffer));
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

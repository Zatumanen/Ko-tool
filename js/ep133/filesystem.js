import{TE_SYSEX_FILE,TE_SYSEX_FILE_INIT,TE_SYSEX_FILE_INIT_SUBSCRIBE,TE_SYSEX_FILE_PUT,TE_SYSEX_FILE_PUT_TYPE_INIT,TE_SYSEX_FILE_PUT_TYPE_DATA,TE_SYSEX_FILE_LIST,TE_SYSEX_FILE_GET,TE_SYSEX_FILE_GET_TYPE_INIT,TE_SYSEX_FILE_GET_TYPE_DATA,TE_SYSEX_FILE_FILE_TYPE_FILE,TE_SYSEX_FILE_FILE_TYPE_DIR,TE_SYSEX_FILE_CAPABILITY_READ,TE_SYSEX_FILE_CAPABILITY_WRITE,TE_SYSEX_FILE_CAPABILITY_DELETE,TE_SYSEX_FILE_CAPABILITY_MOVE,TE_SYSEX_FILE_CAPABILITY_PLAYBACK,TE_SYSEX_FILE_METADATA,TE_SYSEX_FILE_METADATA_SET,TE_SYSEX_FILE_METADATA_GET,TE_SYSEX_FILE_METADATA_SET_PAGED,TE_SYSEX_FILE_METADATA_SET_PAGED_TYPE_INIT,TE_SYSEX_FILE_METADATA_SET_PAGED_TYPE_DATA,TE_SYSEX_FILE_PLAYBACK,TE_SYSEX_FILE_PLAYBACK_START,TE_SYSEX_FILE_PLAYBACK_STOP,TE_SYSEX_FILE_DELETE,TE_SYSEX_FILE_INFO,TE_SYSEX_FILE_MOVED}from './constants.js';
import{requestRead,requestFile,onConnectionChange,markDeviceUnsafe,isDeviceUnsafe,isRequestTimeoutError,withStrictFirmwareDebugGuard,getConnectedDeviceInfo}from './device.js?v=20260929-1';
import{parseNullTerminatedString}from './packing.js';
import{parseProjectArchive,validateProjectArchive,compareProjectArchiveMembers}from './projectArchive.js?v=20260929-1';
import{assertProjectAuthoringSupported}from './projectProfile.js?v=20260929-1';

const u16=(a,i)=>(a[i]<<8)|a[i+1];
const u32=(a,i)=>((a[i]<<24)|(a[i+1]<<16)|(a[i+2]<<8)|a[i+3])>>>0;
const writeString=(view,offset,text,terminate=false)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));if(terminate)view.setUint8(offset+text.length,0);};
const writeUtf8String=(view,offset,text,terminate=false)=>{const bytes=new TextEncoder().encode(text);new Uint8Array(view.buffer,view.byteOffset+offset,bytes.length).set(bytes);if(terminate)view.setUint8(offset+bytes.length,0);return bytes.length;};
const TE_SYSEX_HEADER_OVERHEAD=8,TE_SYSEX_FOOTER_OVERHEAD=1;
const deviceChunkSizes=new Map();
let fileOperationQueue=Promise.resolve();
async function withBrowserFileLock(operation){
  const locks=globalThis.navigator?.locks;
  if(!locks?.request)return operation();
  const key=String(activeDeviceKey||'connected').replace(/[^a-z0-9_.:-]/gi,'_');
  return locks.request('ko-tool-ep-file:'+key,{mode:'exclusive'},operation);
}
function runFileOperation(operation){
  const task=fileOperationQueue.then(()=>withBrowserFileLock(operation));
  fileOperationQueue=task.catch(()=>{});
  return task;
}
export function resetFileSystemState(){deviceChunkSizes.clear();fileOperationQueue=Promise.resolve();}
const getDeviceKey=device=>device?.metadata?.serialNumber||device?.metadata?.serial||device?.deviceKey||null;
let activeDeviceKey=null;
onConnectionChange(({connected,device})=>{
  activeDeviceKey=connected?getDeviceKey(device):null;
  if(!connected)deviceChunkSizes.clear();
});
function getCachedChunkSize(){return activeDeviceKey?deviceChunkSizes.get(activeDeviceKey)||0:0;}
function connectedProjectProfile(){
  const info=getConnectedDeviceInfo();
  if(!info)throw new Error('EP-series device is not connected.');
  const firmware=String(info.metadata?.os_version||info.metadata?.sw_version||'');
  return assertProjectAuthoringSupported(info.sku,firmware);
}
export function calculateMaxPayloadLength(maxPacketLength){const overhead=TE_SYSEX_HEADER_OVERHEAD+2+TE_SYSEX_FOOTER_OVERHEAD;if(maxPacketLength<=overhead)return 0;const available=maxPacketLength-1-overhead;return available-Math.floor(available/8);}

function initPayload(maxResponseLength=4*1024*1024){const p=new Uint8Array(6),view=new DataView(p.buffer);p[0]=TE_SYSEX_FILE_INIT;p[1]=TE_SYSEX_FILE_INIT_SUBSCRIBE;view.setUint32(2,maxResponseLength);return p;}

async function initFileSystemUnlocked(maxResponseLength=4*1024*1024){const response=await requestFile(TE_SYSEX_FILE,initPayload(maxResponseLength));if(response.rawData.length<5)throw new Error('Invalid EP-series FILE_INIT response.');const chunkSize=u32(response.rawData,1);if(!chunkSize)throw new Error('EP-series returned an invalid FILE chunk size.');if(activeDeviceKey)deviceChunkSizes.set(activeDeviceKey,chunkSize);return chunkSize;}

export async function initFileSystem(maxResponseLength=4*1024*1024){return runFileOperation(()=>initFileSystemUnlocked(maxResponseLength));}
async function initRead(maxResponseLength=4*1024*1024){return initFileSystemUnlocked(maxResponseLength);}
function listPayload(page,nodeId){const p=new Uint8Array(5),view=new DataView(p.buffer);p[0]=TE_SYSEX_FILE_LIST;view.setUint16(1,page);view.setUint16(3,nodeId);return p;}

export function parseMetadataResponse(raw,page){if(raw.length<=2)return null;const responsePage=u16(raw,0);if(responsePage!==page)throw new Error('Unexpected metadata page '+responsePage+', expected '+page);return{text:parseNullTerminatedString(raw,2),done:raw[raw.length-1]===0};}

function parseList(data){const out=[];let offset=0;while(offset+7<=data.length){const nodeId=u16(data,offset),flags=data[offset+2],fileSize=u32(data,offset+3),fileName=parseNullTerminatedString(data,offset+7);out.push({nodeId,flags,fileSize,fileName,fileType:(flags&TE_SYSEX_FILE_FILE_TYPE_FILE)?'file':'folder',isReadable:!!(flags&TE_SYSEX_FILE_CAPABILITY_READ),isWritable:!!(flags&TE_SYSEX_FILE_CAPABILITY_WRITE),isDeletable:!!(flags&TE_SYSEX_FILE_CAPABILITY_DELETE),isMovable:!!(flags&TE_SYSEX_FILE_CAPABILITY_MOVE),isPlayable:!!(flags&TE_SYSEX_FILE_CAPABILITY_PLAYBACK)});offset+=7+fileName.length+1;}return out;}

async function getMetadataByNodeId(nodeId,key=null){
  let lastError;
  for(let attempt=0;attempt<3;attempt++){
    try{
      let page=0,text='';
      for(;;){
        if(page>0xffff)throw new Error('EP-series metadata page limit exceeded.');
        const keyBytes=key?new TextEncoder().encode(String(key)):null;
        const p=new Uint8Array(6+(keyBytes?.length||0)+(keyBytes?1:0)),view=new DataView(p.buffer);p[0]=TE_SYSEX_FILE_METADATA;p[1]=TE_SYSEX_FILE_METADATA_GET;view.setUint16(2,nodeId);view.setUint16(4,page);if(keyBytes){p.set(keyBytes,6);p[6+keyBytes.length]=0;}
        const response=await requestRead(TE_SYSEX_FILE,p);
        const parsed=parseMetadataResponse(response.rawData,page);
        if(!parsed)break;
        text+=parsed.text;if(parsed.done)break;page+=1;
      }
      const parsed=JSON.parse(text);
      return Object.assign({},parsed);
    }catch(error){
      lastError=error;
      if(!(error instanceof SyntaxError)||attempt>=2)throw error;
      await new Promise(r=>setTimeout(r,200));
    }
  }
  throw lastError||new Error('EP metadata request failed.');
}

export async function getFileMetadata(nodeId,key=null){return runFileOperation(()=>getMetadataByNodeId(nodeId,key));}

export async function listDeviceFiles(onProgress){return runFileOperation(async()=>{await initRead();return listDeviceFilesUnlocked(onProgress);});}
async function listDirectoryUnlocked(nodeId=0,path='/'){
  const result=[];
  for(let page=0;;page++){
    if(page>0xffff)throw new Error('EP-series FILE_LIST page limit exceeded.');
    const response=await requestRead(TE_SYSEX_FILE,listPayload(page,nodeId));
    const raw=response.rawData;
    if(raw.length<=2)break;
    const pageNo=u16(raw,0);
    if(pageNo!==page)throw new Error(`Unexpected page ${pageNo}, expected ${page}`);
    for(const entry of parseList(raw.slice(2))){
      const full=path==='/'?'/'+entry.fileName:path+'/'+entry.fileName;
      result.push({...entry,fileName:full});
    }
  }
  return result;
}
export async function listDirectory(nodeId=0,path='/'){return runFileOperation(async()=>{await initRead();return listDirectoryUnlocked(nodeId,path);});}

export function normalizeFileName(name,stripSlotPrefix=false){let value=String(name||'sample.wav');if(stripSlotPrefix)value=value.replace(/^\d{3}\s/,'');value=value.split('.').slice(0,-1).join('.')||value;value=value.replace(/\//g,'').trim().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^\x20-\x7F]/g,'?').replace(/[\\"]/g,'');if(value.length>16)value=value.substring(0,7)+'.'+value.substring(value.length-8);return value.toLowerCase()||'sample';}

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
  const values=Array.isArray(allowed)?allowed.map(String).filter(value=>SAMPLE_PLAY_MODES.has(value)):[];
  return new Set(values.length?values:SAMPLE_PLAY_MODES);
};
const SAMPLE_TIME_MODES=new Set(['off','bpm','bar']);
const DEFAULT_CONFIRMED_BAR_VALUES=Object.freeze([1,2]);
const allowedBarValueSet=allowed=>{
  const values=Array.isArray(allowed)?allowed.map(Number).filter(value=>Number.isInteger(value)&&value>0):[];
  return new Set(values.length?values:DEFAULT_CONFIRMED_BAR_VALUES);
};
const finiteRange=(value,min,max)=>Number.isFinite(Number(value))&&Number(value)>=min&&Number(value)<=max;
const integerRange=(value,min,max)=>Number.isInteger(Number(value))&&Number(value)>=min&&Number(value)<=max;

export function prepareSampleWritableMetadata(metadata={},options={}){
  const result={};
  const allowedPlayModes=allowedPlayModeSet(options?.allowedPlayModes);
  const allowedBarValues=allowedBarValueSet(options?.allowedBarValues);
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
      if(value!=null&&String(value).length>0)result[key]=String(value);
      continue;
    }
    if(key==='sound.rootnote'){
      if(integerRange(value,1,127))result[key]=Number(value);
      continue;
    }
    if(key==='sound.bpm'){
      if(finiteRange(value,60,180))result[key]=Number(value);
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
      const bars=Number(value);
      if(Number.isFinite(bars)&&bars>0)result[key]=bars;
      continue;
    }
    if(key==='envelope.attack'||key==='envelope.release'){
      if(integerRange(value,0,255))result[key]=Number(value);
      continue;
    }
    if(key==='time.mode'){
      if(value!=null&&String(value).length>0)result[key]=String(value);
    }
  }
  return result;
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
    result['sound.bars']=bars;
  }
  return result;
}

export function createTransferFileName(sourceId,targetId){
  const source=String(Math.max(0,Number(sourceId)||0)).padStart(3,'0');
  const target=String(Math.max(0,Number(targetId)||0)).padStart(3,'0');
  return normalizeFileName('mv'+source+'_'+target);
}

export function buildFileInfoPayload(fileId){const p=new Uint8Array(3),view=new DataView(p.buffer);p[0]=TE_SYSEX_FILE_INFO;view.setUint16(1,fileId);return p;}
export function parseFileInfoResponse(raw){if(raw.length<10)throw new Error('Invalid EP-series FILE_INFO response.');return{nodeId:u16(raw,0),parentId:u16(raw,2),flags:raw[4],fileSize:u32(raw,5),fileName:parseNullTerminatedString(raw,9)};}
async function getFileInfoUnlocked(fileId){const response=await requestRead(TE_SYSEX_FILE,buildFileInfoPayload(fileId));return parseFileInfoResponse(response.rawData);}
export async function getFileInfo(fileId){return runFileOperation(()=>getFileInfoUnlocked(fileId));}

export function buildFileDeletePayload(fileId){const p=new Uint8Array(3),view=new DataView(p.buffer);p[0]=TE_SYSEX_FILE_DELETE;view.setUint16(1,fileId);return p;}

export function buildFileMovePayload(fileId,parentId,newFileId){
  for(const[value,label]of [[fileId,'source id'],[parentId,'parent id'],[newFileId,'destination id']]){
    if(!Number.isInteger(value)||value<0||value>0xffff)throw new Error('EP-series FILE_MOVE '+label+' must be a 16-bit integer.');
  }
  const p=new Uint8Array(7),view=new DataView(p.buffer);
  p[0]=TE_SYSEX_FILE_MOVED;
  view.setUint16(1,fileId);
  view.setUint16(3,parentId);
  view.setUint16(5,newFileId);
  return p;
}
export function parseFileMoveResponse(raw){
  if(!(raw instanceof Uint8Array))raw=new Uint8Array(raw||[]);
  if(raw.length<6)throw new Error('Invalid EP-series FILE_MOVE response.');
  return{oldFileId:u16(raw,0),parentId:u16(raw,2),newFileId:u16(raw,4)};
}

export function buildFilePutInitPayload(fileId,parentId,fileSize,filename,metadata=null,{isDirectory=false,capabilities=[TE_SYSEX_FILE_CAPABILITY_READ]}={}){const safe=String(filename||'').slice(0,54),meta=metadata==null?'':JSON.stringify(metadata),p=new Uint8Array(11+safe.length+1+meta.length),view=new DataView(p.buffer);let flags=isDirectory?TE_SYSEX_FILE_FILE_TYPE_DIR:TE_SYSEX_FILE_FILE_TYPE_FILE;for(const capability of capabilities)flags|=capability;p[0]=TE_SYSEX_FILE_PUT;p[1]=TE_SYSEX_FILE_PUT_TYPE_INIT;p[2]=flags;view.setUint16(3,fileId);view.setUint16(5,parentId);view.setUint32(7,fileSize);writeString(view,11,safe,true);if(meta.length)writeString(view,12+safe.length,meta,false);return p;}

export function validateFilePutPage(page){if(!Number.isInteger(page)||page<0||page>0xffff)throw new Error('EP-series FILE_PUT page limit exceeded.');return page;}

export function buildFilePutDataPayload(page,data){validateFilePutPage(page);const p=new Uint8Array(4+data.byteLength),view=new DataView(p.buffer);p[0]=TE_SYSEX_FILE_PUT;p[1]=TE_SYSEX_FILE_PUT_TYPE_DATA;view.setUint16(2,page);p.set(data,4);return p;}

export function buildMetadataSetPayload(fileId,metadata){const json=JSON.stringify(metadata),p=new Uint8Array(5+json.length),view=new DataView(p.buffer);p[0]=TE_SYSEX_FILE_METADATA;p[1]=TE_SYSEX_FILE_METADATA_SET;view.setUint16(2,fileId);writeString(view,4,json,true);return p;}

export function buildMetadataPagedInitPayload(fileId,size){const p=new Uint8Array(9),view=new DataView(p.buffer);p[0]=TE_SYSEX_FILE_METADATA;p[1]=TE_SYSEX_FILE_METADATA_SET_PAGED;p[2]=TE_SYSEX_FILE_METADATA_SET_PAGED_TYPE_INIT;view.setUint16(3,fileId);view.setUint32(5,size);return p;}
export function buildMetadataPagedDataPayload(page,data){const p=new Uint8Array(5+data.byteLength),view=new DataView(p.buffer);p[0]=TE_SYSEX_FILE_METADATA;p[1]=TE_SYSEX_FILE_METADATA_SET_PAGED;p[2]=TE_SYSEX_FILE_METADATA_SET_PAGED_TYPE_DATA;view.setUint16(3,page);p.set(data,5);return p;}

async function putFileUnlocked({data,filename,parentId,destinationId,metadata=null,onProgress,timeout=2000,isDirectory=false,capabilities=[TE_SYSEX_FILE_CAPABILITY_READ]}){
  if(!(data instanceof Uint8Array))data=new Uint8Array(data);
  let streamOpened=false,streamClosed=false;
  try{
  if(!Number.isInteger(destinationId)||destinationId<1||destinationId>0xffff)throw new Error('Invalid EP-series destination id.');
  if(!Number.isInteger(parentId)||parentId<0||parentId>65535)throw new Error('Invalid EP-series sample parent.');
  const chunkSize=getCachedChunkSize()||await initFileSystemUnlocked();
  let init;
  try{
    init=await requestFile(TE_SYSEX_FILE,buildFilePutInitPayload(destinationId,parentId,data.byteLength,filename,metadata,{isDirectory,capabilities}),timeout);
  }catch(error){
    if(isRequestTimeoutError(error))markDeviceUnsafe('FILE_PUT init timed out after request dispatch; device write state is unknown: '+String(error?.message||error));
    throw error;
  }
  streamOpened=true;
  if(init.rawData.length<2)throw new Error('Invalid EP-series FILE_PUT init response.');
  const fileId=u16(init.rawData,0);
  const maxPayload=calculateMaxPayloadLength(chunkSize-6);
  if(maxPayload<=0)throw new Error('EP-series returned an unusable FILE chunk size.');
  let offset=0,page=0;
  onProgress?.(0,data.byteLength,{status:'sending',fileId});
  while(offset<data.byteLength){
    if(page>0xffff)throw new Error('EP-series FILE_PUT page limit exceeded.');
    const size=Math.min(maxPayload,data.byteLength-offset);
    const payload=buildFilePutDataPayload(page,data.subarray(offset,offset+size));
    await requestFile(TE_SYSEX_FILE,payload,timeout);
    offset+=size;page+=1;
    onProgress?.(offset,data.byteLength,{status:'sending',fileId});
  }
  if(page>0xffff)throw new Error('EP-series FILE_PUT page limit exceeded.');
  await requestFile(TE_SYSEX_FILE,buildFilePutDataPayload(page,new Uint8Array(0)),timeout);
  streamClosed=true;
  return fileId;
  }catch(error){
    if(streamOpened&&!streamClosed)markDeviceUnsafe('FILE_PUT stream was interrupted before EOF: '+String(error?.message||error));
    throw error;
  }
}
export async function putFile(args){return runFileOperation(()=>putFileUnlocked(args));}

async function listDeviceFilesUnlocked(onProgress){const result=[];async function walk(nodeId=0,path='/'){for(let page=0;;page++){if(page>0xffff)throw new Error('EP-series FILE_LIST page limit exceeded.');const response=await requestRead(TE_SYSEX_FILE,listPayload(page,nodeId));const raw=response.rawData;if(raw.length<=2)break;const pageNo=u16(raw,0);if(pageNo!==page)throw new Error(`Unexpected page ${pageNo}, expected ${page}`);for(const entry of parseList(raw.slice(2))){const full=path==='/'?'/'+entry.fileName:path+'/'+entry.fileName;const item={...entry,fileName:full};result.push(item);onProgress?.(item,result.length);if(entry.fileType==='folder')await walk(entry.nodeId,full);}}}await walk();return result;}

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const positiveActive=value=>{
  const number=Number(value);
  return Number.isInteger(number)&&number>0?number:null;
};
async function getActiveNodeUnlocked(nodeId){
  const metadata=await getMetadataByNodeId(nodeId,'active');
  return positiveActive(metadata?.active);
}
async function captureProjectActivationUnlocked(projectId,projectsNodeId){
  const groupRootId=projectId+100;
  const activeProject=await getActiveNodeUnlocked(projectsNodeId);
  const activeGroup=await getActiveNodeUnlocked(groupRootId);
  const activePad=activeGroup?await getActiveNodeUnlocked(activeGroup):null;
  return{activeProject,activeGroup,activePad,groupRootId};
}
async function reloadProjectUnlocked(projectId,projectsNodeId,{cycle=true,activeGroup=null,activePad=null}={}){
  const groupRootId=projectId+100;
  let cycledProject=null;
  if(cycle){
    const projects=await listDirectoryUnlocked(projectsNodeId,'/projects');
    cycledProject=projects.find(item=>item.fileType==='folder'&&Number(item.nodeId)!==Number(projectId))?.nodeId||null;
    if(cycledProject){
      await setFileMetadataUnlocked(projectsNodeId,{active:cycledProject});
      const cycleReadback=await getActiveNodeUnlocked(projectsNodeId);
      if(cycleReadback!==cycledProject)throw new Error(`EP project cycle readback active=${cycleReadback}, expected ${cycledProject}.`);
      await sleep(200);
    }
  }
  await setFileMetadataUnlocked(projectsNodeId,{active:projectId});
  const activeProject=await getActiveNodeUnlocked(projectsNodeId);
  if(activeProject!==projectId)throw new Error(`EP project reload readback active=${activeProject}, expected ${projectId}.`);

  let groupReadback=null,padReadback=null;
  if(positiveActive(activeGroup)){
    await setFileMetadataUnlocked(groupRootId,{active:activeGroup});
    groupReadback=await getActiveNodeUnlocked(groupRootId);
    if(groupReadback!==activeGroup)throw new Error(`EP group reload readback active=${groupReadback}, expected ${activeGroup}.`);
  }
  if(positiveActive(activePad)&&positiveActive(activeGroup)){
    await setFileMetadataUnlocked(activeGroup,{active:activePad});
    padReadback=await getActiveNodeUnlocked(activeGroup);
    if(padReadback!==activePad)throw new Error(`EP pad reload readback active=${padReadback}, expected ${activePad}.`);
  }
  return{activeProjectFid:activeProject,activeGroupFid:groupReadback,activePadFid:padReadback,cycledProjectFid:cycledProject};
}
export async function reloadProjectArchive(projectNumber,{cycle=true}={}){
  return runFileOperation(()=>withStrictFirmwareDebugGuard(async()=>{
    connectedProjectProfile();
    const project=String(projectNumber).padStart(2,'0');
    await initRead();
    const root=await listDirectoryUnlocked(0,'/');
    const parent=root.find(item=>item.fileName==='/projects'&&item.fileType==='folder');
    if(!parent)throw new Error('EP-series /projects node is not available.');
    const projects=await listDirectoryUnlocked(parent.nodeId,'/projects');
    const destination=projects.find(item=>item.fileName===`/projects/${project}`&&item.fileType==='folder');
    if(!destination)throw new Error(`EP-series project ${project} is not available.`);
    const state=await captureProjectActivationUnlocked(destination.nodeId,parent.nodeId);
    return reloadProjectUnlocked(destination.nodeId,parent.nodeId,{cycle,activeGroup:state.activeGroup,activePad:state.activePad});
  },'project reload'));
}

export async function uploadProjectArchive(file,{onProgress,timeout=15000,cycleReload=true,onBackup}={}){
  return runFileOperation(()=>withStrictFirmwareDebugGuard(async()=>{
    const match=String(file?.name||'').match(/\w*P(\d{2})\.tar$/);
    if(!match?.[1])throw new Error(`${file?.name||'file'} is not a valid project archive`);
    const project=match[1];
    const data=new Uint8Array(await file.arrayBuffer());
    if(data.byteLength===0)throw new Error('Cannot upload an empty project archive.');
    const profile=connectedProjectProfile();
    validateProjectArchive(data,{profile});

    await initRead();
    const root=await listDirectoryUnlocked(0,'/');
    const parent=root.find(item=>item.fileName==='/projects'&&item.fileType==='folder');
    if(!parent)throw new Error('EP-series /projects node is not available.');
    const projects=await listDirectoryUnlocked(parent.nodeId,'/projects');
    const destination=projects.find(item=>item.fileName===`/projects/${project}`&&item.fileType==='folder');
    if(!destination)throw new Error(`EP-series project ${project} is not available.`);

    const backup=await getFileUnlocked(destination.nodeId);
    validateProjectArchive(backup.data,{profile});
    const activation=await captureProjectActivationUnlocked(destination.nodeId,parent.nodeId);
    await onBackup?.({project,name:backup.name,size:backup.size,data:backup.data.slice()});

    let candidateWritten=false;
    try{
      await putFileUnlocked({data,filename:project,parentId:parent.nodeId,destinationId:destination.nodeId,metadata:null,onProgress,timeout,isDirectory:true,capabilities:[TE_SYSEX_FILE_CAPABILITY_READ]});
      candidateWritten=true;
      await initFileSystemUnlocked();

      const readback=await getFileUnlocked(destination.nodeId);
      validateProjectArchive(readback.data,{profile});
      const verification=compareProjectArchiveMembers(data,readback.data);
      const reload=await reloadProjectUnlocked(destination.nodeId,parent.nodeId,{
        cycle:cycleReload,
        activeGroup:activation.activeGroup,
        activePad:activation.activePad
      });
      return{
        project,
        fileId:destination.nodeId,
        verification,
        reload,
        backup:{name:backup.name,size:backup.size}
      };
    }catch(error){
      if(!candidateWritten||isDeviceUnsafe())throw error;
      try{
        await putFileUnlocked({data:backup.data,filename:project,parentId:parent.nodeId,destinationId:destination.nodeId,metadata:null,timeout,isDirectory:true,capabilities:[TE_SYSEX_FILE_CAPABILITY_READ]});
        await initFileSystemUnlocked();
        const restored=await getFileUnlocked(destination.nodeId);
        compareProjectArchiveMembers(backup.data,restored.data);
        await reloadProjectUnlocked(destination.nodeId,parent.nodeId,{
          cycle:cycleReload,
          activeGroup:activation.activeGroup,
          activePad:activation.activePad
        });
        error.projectRollbackSucceeded=true;
      }catch(rollbackError){
        error.projectRollbackSucceeded=false;
        error.rollbackError=rollbackError;
        markDeviceUnsafe('Project rollback failed after a project write verification error: '+String(rollbackError?.message||rollbackError));
      }
      throw error;
    }
  },'project write transaction'));
}

export async function downloadProjectArchive(path,onProgress){return runFileOperation(async()=>{await initRead();const files=await listDeviceFilesUnlocked(),node=files.find(item=>item.fileName===path);if(!node)throw new Error(`EP-series project path not found: ${path}`);return getFileUnlocked(node.nodeId,onProgress);});}

export async function deleteFile(fileId,{timeout=2000}={}){return runFileOperation(async()=>{if(!Number.isInteger(fileId)||fileId<1||fileId>0xffff)throw new Error('EP-series file id must be a 16-bit positive integer.');await requestFile(TE_SYSEX_FILE,buildFileDeletePayload(fileId),timeout);await initFileSystemUnlocked();});}

const normalizeCrc=value=>{
  const number=Number(value);
  return Number.isInteger(number)&&number>=0&&number<=0xffffffff?(number>>>0):null;
};
export async function moveFile(fileId,parentId,newFileId,{timeout=2000,verifyCrc=false}={}){
  return runFileOperation(async()=>{
    let sourceCrc=null;
    if(verifyCrc){
      const sourceMetadata=await getMetadataByNodeId(fileId);
      sourceCrc=normalizeCrc(sourceMetadata?.crc);
      if(sourceCrc===null)throw new Error('EP-series source sample CRC is unavailable; native MOVE aborted before mutation.');
    }
    let moved={oldFileId:fileId,parentId,newFileId},timedOut=false;
    try{
      const response=await requestFile(TE_SYSEX_FILE,buildFileMovePayload(fileId,parentId,newFileId),timeout);
      moved=parseFileMoveResponse(response.rawData);
      if(moved.oldFileId!==fileId||moved.parentId!==parentId||moved.newFileId!==newFileId)
        throw new Error(`EP-series FILE_MOVE verification failed: ${moved.oldFileId}->${moved.newFileId}, expected ${fileId}->${newFileId}.`);
    }catch(error){
      if(!isRequestTimeoutError(error))throw error;
      timedOut=true;
    }
    await initFileSystemUnlocked();
    const info=await getFileInfoUnlocked(moved.newFileId);
    if(Number(info.nodeId)!==Number(moved.newFileId)||Number(info.parentId)!==Number(parentId))
      throw new Error('EP-series FILE_MOVE destination could not be resolved after reinitialization.');
    let metadata=null,destinationCrc=null,crcVerified=null;
    if(verifyCrc){
      metadata=await getMetadataByNodeId(moved.newFileId);
      destinationCrc=normalizeCrc(metadata?.crc);
      crcVerified=destinationCrc!==null&&destinationCrc===sourceCrc;
    }
    return{...moved,info,timedOut,metadata,sourceCrc,destinationCrc,crcVerified};
  });
}

async function setFileMetadataUnlocked(fileId,metadata,{timeout=2000}={}){
  const chunkSize=getCachedChunkSize()||await initFileSystemUnlocked();
  const json=JSON.stringify(metadata),jsonBytes=new TextEncoder().encode(json);
  if(json.length<=chunkSize-8){await requestFile(TE_SYSEX_FILE,buildMetadataSetPayload(fileId,metadata),timeout);return;}
  const data=jsonBytes,maxPayload=calculateMaxPayloadLength(chunkSize-8);
  let streamOpened=false,streamClosed=false;
  try{
    await requestFile(TE_SYSEX_FILE,buildMetadataPagedInitPayload(fileId,data.byteLength),timeout);
    streamOpened=true;
    let offset=0,page=0;
    while(offset<data.byteLength){if(page>0xffff)throw new Error('EP-series metadata SET page limit exceeded.');const size=Math.min(maxPayload,data.byteLength-offset);await requestFile(TE_SYSEX_FILE,buildMetadataPagedDataPayload(page,data.subarray(offset,offset+size)),timeout);offset+=size;page+=1;}
    if(page>0xffff)throw new Error('EP-series metadata SET page limit exceeded.');
    await requestFile(TE_SYSEX_FILE,buildMetadataPagedDataPayload(page,new Uint8Array(0)),timeout);
    streamClosed=true;
  }catch(error){
    if(streamOpened&&!streamClosed)markDeviceUnsafe('Paged METADATA SET was interrupted before EOF: '+String(error?.message||error));
    throw error;
  }
}
export async function setFileMetadata(fileId,metadata,options={}){return runFileOperation(()=>setFileMetadataUnlocked(fileId,metadata,options));}

export async function uploadSampleToSlot({
  file,data,filename,parentId,destinationId,metadata={},
  allowedPlayModes=null,allowAdvancedMetadata=true,allowedBarValues=null,
  onProgress,onCreated
}){
  const bytes=data instanceof Uint8Array?data:new Uint8Array(await file.arrayBuffer());
  if(bytes.byteLength===0)throw new Error('Cannot upload an empty sample.');
  const name=filename||file?.name||'sample.wav';
  const wireName=normalizeFileName(name);
  const displayName=normalizeFileName(metadata?.name||name);
  const uploadMetadata={...metadata,name:displayName};
  const createMetadata=prepareSampleCreateMetadata(uploadMetadata);
  if(!createMetadata.name||!createMetadata.channels||!createMetadata.samplerate||createMetadata.format!=='s16')
    throw new Error('EP-series upload metadata is incomplete or unsupported.');
  const fileId=await putFile({data:bytes,filename:wireName,parentId,destinationId,metadata:createMetadata,onProgress});
  onCreated?.(fileId);

  const writableMetadata=prepareSampleWritableMetadata(uploadMetadata,{
    allowedPlayModes,allowAdvancedMetadata,allowedBarValues
  });
  if(Object.keys(writableMetadata).length)await setFileMetadata(fileId,writableMetadata);

  await initFileSystem();
  return fileId;
}

export async function startPlayback(nodeId,preview=true){return runFileOperation(async()=>{const p=new Uint8Array(12),view=new DataView(p.buffer);p[0]=TE_SYSEX_FILE_PLAYBACK;p[1]=TE_SYSEX_FILE_PLAYBACK_START;view.setUint16(2,nodeId);view.setUint32(4,0);view.setUint32(8,preview?1000:0);await requestFile(TE_SYSEX_FILE,p,2000);});}
export async function stopPlayback(nodeId){return runFileOperation(async()=>{const p=new Uint8Array(12),view=new DataView(p.buffer);p[0]=TE_SYSEX_FILE_PLAYBACK;p[1]=TE_SYSEX_FILE_PLAYBACK_STOP;view.setUint16(2,nodeId);view.setUint32(4,0);view.setUint32(8,0);await requestFile(TE_SYSEX_FILE,p,2000);});}

export function validateFileGetChunk(raw,page,remaining){if(raw.length<2)throw new Error(`Invalid FILE_GET response for page ${page}.`);const gotPage=u16(raw,0);if(gotPage!==page)throw new Error(`Unexpected page ${gotPage}, expected ${page}`);const chunk=raw.slice(2);if(!chunk.length)throw new Error(`Empty FILE_GET response for page ${page}.`);if(chunk.length>remaining)throw new Error(`FILE_GET page ${page} exceeds the declared file size.`);return chunk;}

async function getFileUnlocked(nodeId,onProgress){
  await initRead();
  let streamOpened=false,streamClosed=false;
  try{
    const init=new Uint8Array(8),view=new DataView(init.buffer);
    init[0]=TE_SYSEX_FILE_GET;init[1]=TE_SYSEX_FILE_GET_TYPE_INIT;view.setUint16(2,nodeId);view.setUint32(4,0);
    const start=await requestRead(TE_SYSEX_FILE,init);
    streamOpened=true;
    if(start.rawData.length<7)throw new Error('Invalid EP-series FILE_GET init response.');
    const fileSize=u32(start.rawData,3),fileName=parseNullTerminatedString(start.rawData,7),chunks=[];
    let done=0,page=0;
    while(done<fileSize){
      if(page>0xffff)throw new Error('EP-series FILE_GET page limit exceeded.');
      const requestPayload=new Uint8Array(4),requestView=new DataView(requestPayload.buffer);
      requestPayload[0]=TE_SYSEX_FILE_GET;requestPayload[1]=TE_SYSEX_FILE_GET_TYPE_DATA;requestView.setUint16(2,page);
      const response=await requestRead(TE_SYSEX_FILE,requestPayload);
      const chunk=validateFileGetChunk(response.rawData,page,fileSize-done);
      chunks.push(chunk);done+=chunk.length;onProgress?.(done,fileSize);page+=1;
    }
    if(done!==fileSize)throw new Error(`Incomplete FILE_GET: received ${done} of ${fileSize} bytes.`);
    streamClosed=true;
    const data=new Uint8Array(done);let offset=0;
    for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
    return{name:fileName,size:fileSize,data};
  }catch(error){
    if(streamOpened&&!streamClosed)markDeviceUnsafe('FILE_GET stream was interrupted before the declared byte count: '+String(error?.message||error));
    throw error;
  }
}

export async function getFile(nodeId,onProgress){return runFileOperation(()=>getFileUnlocked(nodeId,onProgress));}

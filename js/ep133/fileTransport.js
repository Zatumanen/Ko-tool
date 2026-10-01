import{
  TE_SYSEX_FILE,TE_SYSEX_FILE_CAPABILITY_READ,
  TE_SYSEX_FILE_PLAYBACK,TE_SYSEX_FILE_PLAYBACK_START,TE_SYSEX_FILE_PLAYBACK_STOP
}from './constants.js';
import{
  requestRead,requestFile,onConnectionChange,onUnexpectedFileTraffic,markDeviceUnsafe,isDeviceUnsafe,isRequestTimeoutError,withStrictFirmwareDebugGuard
}from './device.js?v=20260930-5';
import{parseNullTerminatedString}from './packing.js';
import{createFileScheduler}from './fileScheduler.js?v=20260930-5';
import{createDeviceOperationCoordinator}from './deviceOperationCoordinator.js?v=20260930-5';
import{
  readU16 as u16,readU32 as u32,
  calculateMaxPayloadLength,buildFileInitPayload,buildFileListPayload,parseMetadataResponse,
  buildMetadataGetPayload,parseFileListEntries,buildFileInfoPayload,parseFileInfoResponse,
  buildFileDeletePayload,buildFileMovePayload,parseFileMoveResponse,buildFilePutInitPayload,
  buildFilePutDataPayload,buildMetadataSetPayload,buildMetadataPagedInitPayload,
  buildMetadataPagedDataPayload,validateFileGetChunk,buildFileGetInitPayload,buildFileGetDataPayload
}from './fileProtocol.js?v=20260930-5';

const deviceChunkSizes=new Map();
const deviceOperationCoordinator=createDeviceOperationCoordinator({markUnsafe:markDeviceUnsafe,isUnsafe:isDeviceUnsafe});
onUnexpectedFileTraffic(detail=>deviceOperationCoordinator.observeUnexpectedFileTraffic(detail));
async function withBrowserFileLock(operation){
  const locks=globalThis.navigator?.locks;
  if(!locks?.request)return operation();
  const key=String(activeDeviceKey||'connected').replace(/[^a-z0-9_.:-]/gi,'_');
  return locks.request('ko-tool-ep-file:'+key,{mode:'exclusive'},operation);
}
const fileScheduler=createFileScheduler({withLock:withBrowserFileLock});
function runFileOperation(operation,label='FILE operation',options={}){
  return fileScheduler.run(label,()=>deviceOperationCoordinator.run(label,operation,options));
}
function runGuardedFileMutation(label,operation){
  return runFileOperation(()=>withStrictFirmwareDebugGuard(operation,label),label,{mode:'mutation'});
}

function createFileTransactionLease(){
  let active=true;
  const inFlight=new Set();
  const assertActive=()=>{
    if(!active)throw new Error('FILE transaction lease is no longer active.');
  };
  const track=operation=>(...args)=>{
    assertActive();
    const promise=Promise.resolve().then(()=>operation(...args));
    inFlight.add(promise);
    promise.then(()=>inFlight.delete(promise),()=>inFlight.delete(promise));
    return promise;
  };
  const lease=Object.freeze({
    initFileSystem:track(initFileSystemUnlocked),
    listDeviceFiles:track(async onProgress=>{await initRead();return listDeviceFilesUnlocked(onProgress);}),
    listDirectory:track(async(nodeId=0,path='/')=>{await initRead();return listDirectoryUnlocked(nodeId,path);}),
    getFileMetadata:track(async(nodeId,key=null)=>{await ensureFileSystemInitializedUnlocked();return getMetadataByNodeId(nodeId,key);}),
    getFileInfo:track(async fileId=>{await ensureFileSystemInitializedUnlocked();return getFileInfoUnlocked(fileId);}),
    getFile:track(getFileUnlocked),
    putFile:track(putFileUnlocked),
    setFileMetadata:track(setFileMetadataUnlocked),
    deleteFile:track(deleteFileUnlocked),
    moveFile:track(moveFileUnlocked)
  });
  return{
    lease,
    async close(){
      active=false;
      if(inFlight.size)await Promise.allSettled([...inFlight]);
    }
  };
}

export function withFileTransportTransaction(label,operation,{strict=false}={}){
  if(typeof operation!=='function')throw new TypeError('FILE transaction requires an operation.');
  const transactionLabel=String(label||'FILE transaction');
  return runFileOperation(async()=>{
    const context=createFileTransactionLease();
    try{
      const execute=()=>operation(context.lease);
      return strict
        ?await withStrictFirmwareDebugGuard(execute,transactionLabel)
        :await execute();
    }finally{
      await context.close();
    }
  },transactionLabel,{mode:strict?'mutation':'read'});
}

export function getFileOperationCoordinatorState(){return deviceOperationCoordinator.getState();}
export function resetFileTransportState(){deviceChunkSizes.clear();fileScheduler.reset();deviceOperationCoordinator.reset();}
const getDeviceKey=device=>device?.metadata?.serialNumber||device?.metadata?.serial||device?.deviceKey||null;
let activeDeviceKey=null;
onConnectionChange(({connected,unsafe,device})=>{
  activeDeviceKey=connected?getDeviceKey(device):null;
  if(!connected){
    deviceChunkSizes.clear();
    if(!unsafe)deviceOperationCoordinator.reset();
  }
});
function getCachedChunkSize(){return activeDeviceKey?deviceChunkSizes.get(activeDeviceKey)||0:0;}
async function ensureFileSystemInitializedUnlocked(){if(!getCachedChunkSize())await initFileSystemUnlocked();}


async function initFileSystemUnlocked(maxResponseLength=4*1024*1024){const response=await requestFile(TE_SYSEX_FILE,buildFileInitPayload(maxResponseLength));if(response.rawData.length<5)throw new Error('Invalid EP-series FILE_INIT response.');const chunkSize=u32(response.rawData,1);if(!chunkSize)throw new Error('EP-series returned an invalid FILE chunk size.');if(activeDeviceKey)deviceChunkSizes.set(activeDeviceKey,chunkSize);return chunkSize;}

export async function initFileSystem(maxResponseLength=4*1024*1024){return runFileOperation(()=>initFileSystemUnlocked(maxResponseLength));}
async function initRead(maxResponseLength=4*1024*1024){return initFileSystemUnlocked(maxResponseLength);}

async function getMetadataByNodeId(nodeId,key=null){
  let lastError;
  for(let attempt=0;attempt<3;attempt++){
    try{
      let page=0,text='';
      for(;;){
        if(page>0xffff)throw new Error('EP-series metadata page limit exceeded.');
        const p=buildMetadataGetPayload(nodeId,page,key);
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

export async function getFileMetadata(nodeId,key=null){return runFileOperation(async()=>{await ensureFileSystemInitializedUnlocked();return getMetadataByNodeId(nodeId,key);});}

export async function listDeviceFiles(onProgress){return runFileOperation(async()=>{await initRead();return listDeviceFilesUnlocked(onProgress);});}
async function listDirectoryUnlocked(nodeId=0,path='/'){
  const result=[];
  for(let page=0;;page++){
    if(page>0xffff)throw new Error('EP-series FILE_LIST page limit exceeded.');
    const response=await requestRead(TE_SYSEX_FILE,buildFileListPayload(page,nodeId));
    const raw=response.rawData;
    if(raw.length<=2)break;
    const pageNo=u16(raw,0);
    if(pageNo!==page)throw new Error(`Unexpected page ${pageNo}, expected ${page}`);
    for(const entry of parseFileListEntries(raw.slice(2))){
      const full=path==='/'?'/'+entry.fileName:path+'/'+entry.fileName;
      result.push({...entry,fileName:full});
    }
  }
  return result;
}
export async function listDirectory(nodeId=0,path='/'){return runFileOperation(async()=>{await initRead();return listDirectoryUnlocked(nodeId,path);});}


async function getFileInfoUnlocked(fileId){const response=await requestRead(TE_SYSEX_FILE,buildFileInfoPayload(fileId));return parseFileInfoResponse(response.rawData);}
export async function getFileInfo(fileId){return runFileOperation(async()=>{await ensureFileSystemInitializedUnlocked();return getFileInfoUnlocked(fileId);});}


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
export async function putFile(args){return runGuardedFileMutation('FILE_PUT mutation',()=>putFileUnlocked(args));}

async function listDeviceFilesUnlocked(onProgress){const result=[];async function walk(nodeId=0,path='/'){for(let page=0;;page++){if(page>0xffff)throw new Error('EP-series FILE_LIST page limit exceeded.');const response=await requestRead(TE_SYSEX_FILE,buildFileListPayload(page,nodeId));const raw=response.rawData;if(raw.length<=2)break;const pageNo=u16(raw,0);if(pageNo!==page)throw new Error(`Unexpected page ${pageNo}, expected ${page}`);for(const entry of parseFileListEntries(raw.slice(2))){const full=path==='/'?'/'+entry.fileName:path+'/'+entry.fileName;const item={...entry,fileName:full};result.push(item);onProgress?.(item,result.length);if(entry.fileType==='folder')await walk(entry.nodeId,full);}}}await walk();return result;}


async function deleteFileUnlocked(fileId,{timeout=2000}={}){
  if(!Number.isInteger(fileId)||fileId<1||fileId>0xffff)throw new Error('EP-series file id must be a 16-bit positive integer.');
  await ensureFileSystemInitializedUnlocked();
  await requestFile(TE_SYSEX_FILE,buildFileDeletePayload(fileId),timeout);
  await initFileSystemUnlocked();
}
export async function deleteFile(fileId,options={}){return runGuardedFileMutation('FILE_DELETE mutation',()=>deleteFileUnlocked(fileId,options));}

const normalizeCrc=value=>{
  const number=Number(value);
  return Number.isInteger(number)&&number>=0&&number<=0xffffffff?(number>>>0):null;
};
async function moveFileUnlocked(fileId,parentId,newFileId,{timeout=2000,verifyCrc=false}={}){
    await ensureFileSystemInitializedUnlocked();
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
}
export async function moveFile(fileId,parentId,newFileId,options={}){
  return runGuardedFileMutation('FILE_MOVE mutation',()=>moveFileUnlocked(fileId,parentId,newFileId,options));
}

async function setFileMetadataUnlocked(fileId,metadata,{timeout=2000}={}){
  const chunkSize=getCachedChunkSize()||await initFileSystemUnlocked();
  const json=JSON.stringify(metadata),jsonBytes=new TextEncoder().encode(json);
  if(json.length<=chunkSize-8){await requestFile(TE_SYSEX_FILE,buildMetadataSetPayload(fileId,metadata),timeout);return;}
  const data=jsonBytes,maxPayload=calculateMaxPayloadLength(chunkSize-8);
  let streamOpened=false,streamClosed=false;
  try{
    try{
      await requestFile(TE_SYSEX_FILE,buildMetadataPagedInitPayload(fileId,data.byteLength),timeout);
    }catch(error){
      if(isRequestTimeoutError(error))markDeviceUnsafe('Paged METADATA SET init timed out after request dispatch; device write state is unknown: '+String(error?.message||error));
      throw error;
    }
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
export async function setFileMetadata(fileId,metadata,options={}){return runGuardedFileMutation('METADATA_SET mutation',()=>setFileMetadataUnlocked(fileId,metadata,options));}

export async function startPlayback(nodeId,preview=true){return runFileOperation(async()=>{await ensureFileSystemInitializedUnlocked();const p=new Uint8Array(12),view=new DataView(p.buffer);p[0]=TE_SYSEX_FILE_PLAYBACK;p[1]=TE_SYSEX_FILE_PLAYBACK_START;view.setUint16(2,nodeId);view.setUint32(4,0);view.setUint32(8,preview?1000:0);await requestFile(TE_SYSEX_FILE,p,2000);},'FILE_PLAYBACK start',{mode:'mutation'});}
export async function stopPlayback(nodeId){return runFileOperation(async()=>{await ensureFileSystemInitializedUnlocked();const p=new Uint8Array(12),view=new DataView(p.buffer);p[0]=TE_SYSEX_FILE_PLAYBACK;p[1]=TE_SYSEX_FILE_PLAYBACK_STOP;view.setUint16(2,nodeId);view.setUint32(4,0);view.setUint32(8,0);await requestFile(TE_SYSEX_FILE,p,2000);},'FILE_PLAYBACK stop',{mode:'mutation'});}


async function getFileUnlocked(nodeId,onProgress){
  await initRead();
  let streamOpened=false,streamClosed=false;
  try{
    let start;
    try{
      start=await requestRead(TE_SYSEX_FILE,buildFileGetInitPayload(nodeId,0));
    }catch(error){
      if(isRequestTimeoutError(error))markDeviceUnsafe('FILE_GET init timed out after request dispatch; device read state is unknown: '+String(error?.message||error));
      throw error;
    }
    streamOpened=true;
    if(start.rawData.length<7)throw new Error('Invalid EP-series FILE_GET init response.');
    const fileSize=u32(start.rawData,3),fileName=parseNullTerminatedString(start.rawData,7),chunks=[];
    let done=0,page=0;
    while(done<fileSize){
      if(page>0xffff)throw new Error('EP-series FILE_GET page limit exceeded.');
      const response=await requestRead(TE_SYSEX_FILE,buildFileGetDataPayload(page));
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


export const fileTransportInternals=Object.freeze({
  runFileOperation,
  initRead,
  initFileSystem:initFileSystemUnlocked,
  listDirectory:listDirectoryUnlocked,
  listDeviceFiles:listDeviceFilesUnlocked,
  getFile:getFileUnlocked,
  putFile:putFileUnlocked,
  getFileMetadata:getMetadataByNodeId,
  setFileMetadata:setFileMetadataUnlocked
});

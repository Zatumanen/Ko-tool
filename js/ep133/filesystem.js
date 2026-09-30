import{TE_SYSEX_FILE,TE_SYSEX_FILE_INIT,TE_SYSEX_FILE_INIT_SUBSCRIBE,TE_SYSEX_FILE_PUT,TE_SYSEX_FILE_PUT_TYPE_INIT,TE_SYSEX_FILE_PUT_TYPE_DATA,TE_SYSEX_FILE_LIST,TE_SYSEX_FILE_GET,TE_SYSEX_FILE_GET_TYPE_INIT,TE_SYSEX_FILE_GET_TYPE_DATA,TE_SYSEX_FILE_FILE_TYPE_FILE,TE_SYSEX_FILE_FILE_TYPE_DIR,TE_SYSEX_FILE_CAPABILITY_READ,TE_SYSEX_FILE_CAPABILITY_WRITE,TE_SYSEX_FILE_CAPABILITY_DELETE,TE_SYSEX_FILE_CAPABILITY_MOVE,TE_SYSEX_FILE_CAPABILITY_PLAYBACK,TE_SYSEX_FILE_METADATA,TE_SYSEX_FILE_METADATA_SET,TE_SYSEX_FILE_METADATA_GET,TE_SYSEX_FILE_METADATA_SET_PAGED,TE_SYSEX_FILE_METADATA_SET_PAGED_TYPE_INIT,TE_SYSEX_FILE_METADATA_SET_PAGED_TYPE_DATA,TE_SYSEX_FILE_PLAYBACK,TE_SYSEX_FILE_PLAYBACK_START,TE_SYSEX_FILE_PLAYBACK_STOP,TE_SYSEX_FILE_DELETE,TE_SYSEX_FILE_INFO,TE_SYSEX_FILE_MOVED}from './constants.js';
import{requestRead,requestFile,onConnectionChange,markDeviceUnsafe,isDeviceUnsafe,isRequestTimeoutError,withStrictFirmwareDebugGuard,getConnectedDeviceInfo}from './device.js?v=20260930-5';
import{parseNullTerminatedString}from './packing.js';
import{parseProjectArchive,validateProjectArchive,compareProjectArchiveMembers,preflightProjectSampleDependencies}from './projectArchive.js?v=20260930-5';
import{assertProjectTransportSupported,assertProjectAuthoringSupported,assertProjectReloadSupported}from './projectProfile.js?v=20260930-5';
import{createProjectRuntimeGate}from './projectRuntime.js?v=20260930-5';
import{createFileScheduler}from './fileScheduler.js?v=20260930-5';
import{
  readU16 as u16,readU32 as u32,
  calculateMaxPayloadLength,buildFileInitPayload,buildFileListPayload,parseMetadataResponse,buildMetadataGetPayload,parseFileListEntries,buildFileInfoPayload,parseFileInfoResponse,buildFileDeletePayload,buildFileMovePayload,parseFileMoveResponse,buildFilePutInitPayload,validateFilePutPage,buildFilePutDataPayload,buildMetadataSetPayload,buildMetadataPagedInitPayload,buildMetadataPagedDataPayload,validateFileGetChunk,buildFileGetInitPayload,buildFileGetDataPayload
}from './fileProtocol.js?v=20260930-5';
import{
  normalizeFileName,prepareSampleCreateMetadata,prepareSampleWritableMetadata,prepareSampleLocalMetadata,prepareSampleTransferMetadata,createTransferFileName,
  uploadSampleToSlotWithTransport
}from './sampleFilesystem.js?v=20260930-5';
export{normalizeFileName,prepareSampleCreateMetadata,prepareSampleWritableMetadata,prepareSampleLocalMetadata,prepareSampleTransferMetadata,createTransferFileName};
export{calculateMaxPayloadLength,buildFileInitPayload,buildFileListPayload,parseMetadataResponse,buildMetadataGetPayload,parseFileListEntries,buildFileInfoPayload,parseFileInfoResponse,buildFileDeletePayload,buildFileMovePayload,parseFileMoveResponse,buildFilePutInitPayload,validateFilePutPage,buildFilePutDataPayload,buildMetadataSetPayload,buildMetadataPagedInitPayload,buildMetadataPagedDataPayload,validateFileGetChunk,buildFileGetInitPayload,buildFileGetDataPayload};

const deviceChunkSizes=new Map();
const projectRuntimeGate=createProjectRuntimeGate();
async function withBrowserFileLock(operation){
  const locks=globalThis.navigator?.locks;
  if(!locks?.request)return operation();
  const key=String(activeDeviceKey||'connected').replace(/[^a-z0-9_.:-]/gi,'_');
  return locks.request('ko-tool-ep-file:'+key,{mode:'exclusive'},operation);
}
const fileScheduler=createFileScheduler({withLock:withBrowserFileLock});
function runFileOperation(operation,label='FILE operation'){
  return fileScheduler.run(label,operation);
}
function runGuardedFileMutation(label,operation){
  return runFileOperation(()=>withStrictFirmwareDebugGuard(operation,label),label);
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
    uploadSampleToSlot:track(uploadSampleToSlotUnlocked),
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

export function withFileTransaction(label,operation,{strict=false}={}){
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
  },transactionLabel);
}

export function withSampleUploadBatch(operation){
  if(typeof operation!=='function')throw new TypeError('Sample upload batch requires an operation.');
  return withStrictFirmwareDebugGuard(operation,'sample upload batch');
}
export function resetFileSystemState(){deviceChunkSizes.clear();projectRuntimeGate.reset();fileScheduler.reset();}
export function getProjectRuntimeSettleState(){return projectRuntimeGate.getState();}
export function assertProjectRuntimeSettled(label='project operation'){return projectRuntimeGate.assertSettled(label);}
const getDeviceKey=device=>device?.metadata?.serialNumber||device?.metadata?.serial||device?.deviceKey||null;
let activeDeviceKey=null;
onConnectionChange(({connected,device})=>{
  activeDeviceKey=connected?getDeviceKey(device):null;
  if(!connected){deviceChunkSizes.clear();projectRuntimeGate.reset();}
});
function getCachedChunkSize(){return activeDeviceKey?deviceChunkSizes.get(activeDeviceKey)||0:0;}
async function ensureFileSystemInitializedUnlocked(){if(!getCachedChunkSize())await initFileSystemUnlocked();}
function connectedProjectProfile(mode='transport'){
  const info=getConnectedDeviceInfo();
  if(!info)throw new Error('EP-series device is not connected.');
  const firmware=String(info.metadata?.os_version||info.metadata?.sw_version||'');
  if(mode==='authoring')return assertProjectAuthoringSupported(info.sku,firmware);
  if(mode==='reload')return assertProjectReloadSupported(info.sku,firmware);
  return assertProjectTransportSupported(info.sku,firmware);
}


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
  const runtimeSettle=projectRuntimeGate.markReload();
  return{activeProjectFid:activeProject,activeGroupFid:groupReadback,activePadFid:padReadback,cycledProjectFid:cycledProject,runtimeSettle};
}
export async function reloadProjectArchive(projectNumber,{cycle=true}={}){
  return runFileOperation(()=>withStrictFirmwareDebugGuard(async()=>{
    assertProjectRuntimeSettled('project reload');
    connectedProjectProfile('reload');
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

export function assertProjectWriteActiveGuard({destinationFid,activeProjectFid,requireInactive=false,expectedActiveProjectFid=null}={}){
  const destination=Number(destinationFid),active=Number(activeProjectFid);
  if(!Number.isInteger(destination)||destination<=0)throw new Error('Project write guard requires a valid destination FID.');
  if(!Number.isInteger(active)||active<=0)throw new Error('Project write guard requires a valid active project FID.');
  if(requireInactive&&active===destination)throw new Error('Refusing project write: destination project is currently active.');
  if(expectedActiveProjectFid!=null&&active!==Number(expectedActiveProjectFid))
    throw new Error('Refusing project write: active project changed after preflight.');
  return active;
}

export async function uploadProjectArchive(file,{onProgress,timeout=15000,cycleReload=true,performReload=true,onBackup,requireInactive=false,expectedActiveProjectFid=null}={}){
  return runFileOperation(()=>withStrictFirmwareDebugGuard(async()=>{
    assertProjectRuntimeSettled('project write');
    const match=String(file?.name||'').match(/\w*P(\d{2})\.tar$/);
    if(!match?.[1])throw new Error(`${file?.name||'file'} is not a valid project archive`);
    const project=match[1];
    const data=new Uint8Array(await file.arrayBuffer());
    if(data.byteLength===0)throw new Error('Cannot upload an empty project archive.');
    const profile=connectedProjectProfile('transport');
    if(profile.projectAuthoring)validateProjectArchive(data,{profile});
    else parseProjectArchive(data);

    await initRead();
    const root=await listDirectoryUnlocked(0,'/');
    const parent=root.find(item=>item.fileName==='/projects'&&item.fileType==='folder');
    if(!parent)throw new Error('EP-series /projects node is not available.');
    const sounds=root.find(item=>item.fileName==='/sounds'&&item.fileType==='folder');
    const occupiedSampleSlots=sounds
      ?(await listDirectoryUnlocked(sounds.nodeId,'/sounds')).map(item=>Number(item.nodeId)).filter(id=>Number.isInteger(id)&&id>=1&&id<=999)
      :[];
    const sampleDependencies=profile.projectAuthoring
      ?preflightProjectSampleDependencies(data,occupiedSampleSlots,{profile})
      :{referencedSampleSlots:null,missingSampleSlots:null,allSamplesAvailable:null,semanticPreflight:false};
    const projects=await listDirectoryUnlocked(parent.nodeId,'/projects');
    const destination=projects.find(item=>item.fileName===`/projects/${project}`&&item.fileType==='folder');
    if(!destination)throw new Error(`EP-series project ${project} is not available.`);

    const backup=await getFileUnlocked(destination.nodeId);
    if(profile.projectAuthoring)validateProjectArchive(backup.data,{profile});
    else parseProjectArchive(backup.data);
    const activation=profile.projectReloadVerified&&performReload
      ?await captureProjectActivationUnlocked(destination.nodeId,parent.nodeId)
      :{activeProject:null,activeGroup:null,activePad:null,groupRootId:null};
    await onBackup?.({project,name:backup.name,size:backup.size,data:backup.data.slice()});

    let activeProjectBeforeWrite=null;
    if(requireInactive||expectedActiveProjectFid!=null){
      activeProjectBeforeWrite=assertProjectWriteActiveGuard({
        destinationFid:destination.nodeId,
        activeProjectFid:await getActiveNodeUnlocked(parent.nodeId),
        requireInactive,
        expectedActiveProjectFid
      });
    }

    let candidateWritten=false;
    try{
      await putFileUnlocked({data,filename:project,parentId:parent.nodeId,destinationId:destination.nodeId,metadata:null,onProgress,timeout,isDirectory:true,capabilities:[TE_SYSEX_FILE_CAPABILITY_READ]});
      candidateWritten=true;
      await initFileSystemUnlocked();

      const readback=await getFileUnlocked(destination.nodeId);
      if(profile.projectAuthoring)validateProjectArchive(readback.data,{profile});
      else parseProjectArchive(readback.data);
      const verification=compareProjectArchiveMembers(data,readback.data);
      const reload=profile.projectReloadVerified&&performReload
        ?await reloadProjectUnlocked(destination.nodeId,parent.nodeId,{
          cycle:cycleReload,
          activeGroup:activation.activeGroup,
          activePad:activation.activePad
        })
        :null;
      return{
        project,
        fileId:destination.nodeId,
        verification,
        reload,
        sampleDependencies,
        activeProjectBeforeWrite,
        backup:{name:backup.name,size:backup.size}
      };
    }catch(error){
      if(!candidateWritten||isDeviceUnsafe())throw error;
      try{
        await putFileUnlocked({data:backup.data,filename:project,parentId:parent.nodeId,destinationId:destination.nodeId,metadata:null,timeout,isDirectory:true,capabilities:[TE_SYSEX_FILE_CAPABILITY_READ]});
        await initFileSystemUnlocked();
        const restored=await getFileUnlocked(destination.nodeId);
        compareProjectArchiveMembers(backup.data,restored.data);
        if(profile.projectReloadVerified&&performReload)await reloadProjectUnlocked(destination.nodeId,parent.nodeId,{
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

async function uploadSampleToSlotUnlocked(args){
  return uploadSampleToSlotWithTransport(args,{
    putFile:putFileUnlocked,
    setFileMetadata:setFileMetadataUnlocked,
    initFileSystem:initFileSystemUnlocked
  });
}
export async function uploadSampleToSlot(args){
  return runGuardedFileMutation('sample upload transaction',()=>uploadSampleToSlotUnlocked(args));
}

export async function startPlayback(nodeId,preview=true){return runFileOperation(async()=>{await ensureFileSystemInitializedUnlocked();const p=new Uint8Array(12),view=new DataView(p.buffer);p[0]=TE_SYSEX_FILE_PLAYBACK;p[1]=TE_SYSEX_FILE_PLAYBACK_START;view.setUint16(2,nodeId);view.setUint32(4,0);view.setUint32(8,preview?1000:0);await requestFile(TE_SYSEX_FILE,p,2000);});}
export async function stopPlayback(nodeId){return runFileOperation(async()=>{await ensureFileSystemInitializedUnlocked();const p=new Uint8Array(12),view=new DataView(p.buffer);p[0]=TE_SYSEX_FILE_PLAYBACK;p[1]=TE_SYSEX_FILE_PLAYBACK_STOP;view.setUint16(2,nodeId);view.setUint32(4,0);view.setUint32(8,0);await requestFile(TE_SYSEX_FILE,p,2000);});}


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

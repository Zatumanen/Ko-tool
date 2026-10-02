import{onConnectionChange,withStrictFirmwareDebugGuard,getConnectedDeviceInfo,markDeviceUnsafe,isDeviceUnsafe}from './device.js?v=20261001-1';
import{
  withFileTransportTransaction,getFileOperationCoordinatorState,resetFileTransportState,fileTransportInternals,
  initFileSystem,getFileMetadata,listDeviceFiles,listDirectory,getFileInfo,putFile,
  deleteFile,moveFile,setFileMetadata,startPlayback,stopPlayback,getFile
}from './fileTransport.js?v=20261001-1';
import{
  normalizeFileName,prepareSampleCreateMetadata,prepareSampleWritableMetadata,
  prepareSampleLocalMetadata,prepareSampleTransferMetadata,createTransferFileName,
  uploadSampleToSlotWithTransport
}from './sampleFilesystem.js?v=20261001-1';
import{createProjectFilesystem,assertProjectWriteActiveGuard}from './projectFilesystem.js?v=20261001-1';
import{assertProjectTransportSupported}from './projectProfile.js?v=20261001-1';
import{readProjectModel}from './projectReader.js?v=20261001-1';
import{buildSampleDependencyIndex,assertSampleSlotsUnreferenced}from './projectDependencies.js?v=20261001-1';
import{createBrowserProjectRecoveryStore}from './projectRecovery.js?v=20261001-1';

export{
  calculateMaxPayloadLength,buildFileInitPayload,buildFileListPayload,parseMetadataResponse,
  buildMetadataGetPayload,parseFileListEntries,buildFileInfoPayload,parseFileInfoResponse,
  buildFileDeletePayload,buildFileMovePayload,parseFileMoveResponse,buildFilePutInitPayload,
  validateFilePutPage,buildFilePutDataPayload,buildMetadataSetPayload,buildMetadataPagedInitPayload,
  buildMetadataPagedDataPayload,validateFileGetChunk,buildFileGetInitPayload,buildFileGetDataPayload
}from './fileProtocol.js?v=20261001-1';

export{
  normalizeFileName,prepareSampleCreateMetadata,prepareSampleWritableMetadata,
  prepareSampleLocalMetadata,prepareSampleTransferMetadata,createTransferFileName,
  assertProjectWriteActiveGuard,
  getFileOperationCoordinatorState,
  initFileSystem,getFileMetadata,listDeviceFiles,listDirectory,getFileInfo,putFile,
  deleteFile,moveFile,setFileMetadata,startPlayback,stopPlayback,getFile
};

const projectRecoveryStore=createBrowserProjectRecoveryStore();

const projectFilesystem=createProjectFilesystem({
  runFileOperation:fileTransportInternals.runFileOperation,
  withStrictFirmwareDebugGuard,
  getConnectedDeviceInfo,
  markDeviceUnsafe,
  isDeviceUnsafe,
  initRead:fileTransportInternals.initRead,
  initFileSystem:fileTransportInternals.initFileSystem,
  listDirectory:fileTransportInternals.listDirectory,
  listDeviceFiles:fileTransportInternals.listDeviceFiles,
  getFile:fileTransportInternals.getFile,
  putFile:fileTransportInternals.putFile,
  getFileMetadata:fileTransportInternals.getFileMetadata,
  setFileMetadata:fileTransportInternals.setFileMetadata,
  recoveryStore:projectRecoveryStore
});

const sampleUploadForTransport=(args,fileOps)=>uploadSampleToSlotWithTransport(args,{
  putFile:fileOps.putFile,
  setFileMetadata:fileOps.setFileMetadata,
  initFileSystem:fileOps.initFileSystem
});

const normalizeDependencySlots=values=>[...new Set(
  Array.from(values||[],Number).filter(value=>Number.isInteger(value)&&value>=1&&value<=999)
)].sort((a,b)=>a-b);

const connectedDependencyProfile=()=>{
  const info=getConnectedDeviceInfo();
  if(!info)throw new Error('EP-series device is not connected.');
  const firmware=String(info.metadata?.os_version||info.metadata?.sw_version||'');
  const profile=assertProjectTransportSupported(info.sku,firmware);
  if(profile.id!=='ep133'&&profile.id!=='ep40')
    throw new Error('Sample dependency indexing is enabled only for EP-133 and EP-40.');
  return profile;
};

const buildDeviceSampleDependencyIndex=async fileOps=>{
  const profile=connectedDependencyProfile();
  const root=await fileOps.listDirectory(0,'/');
  const parent=root.find(item=>item.fileName==='/projects'&&item.fileType==='folder');
  if(!parent)throw new Error('EP-series /projects node is not available for sample dependency preflight.');
  const projects=(await fileOps.listDirectory(parent.nodeId,'/projects'))
    .filter(item=>item.fileType==='folder'&&/^\/projects\/\d{2}$/.test(item.fileName))
    .sort((a,b)=>a.fileName.localeCompare(b.fileName));
  const results=[];
  for(const node of projects){
    const archive=await fileOps.getFile(node.nodeId);
    results.push({
      project:node.fileName.slice(-2),
      nodeId:node.nodeId,
      active:false,
      model:readProjectModel(archive.data,{profile})
    });
  }
  return buildSampleDependencyIndex(results);
};

export function withFileTransaction(label,operation,{
  strict=false,
  sampleDependencySlots=null,
  sampleDependencyOperation='modify'
}={}){
  if(typeof operation!=='function')throw new TypeError('FILE transaction requires an operation.');
  const dependencySlots=normalizeDependencySlots(sampleDependencySlots);
  return withFileTransportTransaction(label,async fileOps=>{
    if(strict&&dependencySlots.length){
      const dependencyIndex=await buildDeviceSampleDependencyIndex(fileOps);
      assertSampleSlotsUnreferenced(dependencyIndex,dependencySlots,{operation:sampleDependencyOperation});
    }
    return operation(Object.freeze({
      ...fileOps,
      uploadSampleToSlot:args=>sampleUploadForTransport(args,fileOps)
    }));
  },{strict});
}

export function withSampleUploadBatch(operation){
  if(typeof operation!=='function')throw new TypeError('Sample upload batch requires an operation.');
  return withStrictFirmwareDebugGuard(operation,'sample upload batch');
}

export function uploadSampleToSlot(args){
  return withFileTransportTransaction(
    'sample upload transaction',
    fileOps=>sampleUploadForTransport(args,fileOps),
    {strict:true}
  );
}

export function resetFileSystemState(){
  projectFilesystem.resetProjectRuntime();
  resetFileTransportState();
}

export function getProjectRuntimeSettleState(){
  return projectFilesystem.getProjectRuntimeSettleState();
}

export function assertProjectRuntimeSettled(label='project operation'){
  return projectFilesystem.assertProjectRuntimeSettled(label);
}

export const listProjectArchivesReadOnly=()=>projectFilesystem.listProjectArchivesReadOnly();
export const readProjectArchiveReadOnly=(projectNumber,options={})=>projectFilesystem.readProjectArchiveReadOnly(projectNumber,options);

export function reloadProjectArchive(projectNumber,options={}){
  return projectFilesystem.reloadProjectArchive(projectNumber,options);
}

export function uploadProjectArchive(file,options={}){
  return projectFilesystem.uploadProjectArchive(file,options);
}

export function downloadProjectArchive(path,onProgress){
  return projectFilesystem.downloadProjectArchive(path,onProgress);
}

export const getProjectRecoveryCheckpoint=id=>projectFilesystem.getProjectRecoveryCheckpoint(id);
export const listProjectRecoveryCheckpoints=()=>projectFilesystem.listProjectRecoveryCheckpoints();
export const deleteProjectRecoveryCheckpoint=id=>projectFilesystem.deleteProjectRecoveryCheckpoint(id);
export const getProjectTransactionJournal=id=>projectFilesystem.getProjectTransactionJournal(id);
export const restoreProjectRecoveryCheckpoint=(id,options={})=>projectFilesystem.restoreProjectRecoveryCheckpoint(id,options);

onConnectionChange(({connected})=>{
  if(!connected)projectFilesystem.resetProjectRuntime();
});

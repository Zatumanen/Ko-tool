import{onConnectionChange,withStrictFirmwareDebugGuard,getConnectedDeviceInfo,markDeviceUnsafe,isDeviceUnsafe}from './device.js?v=20260930-5';
import{
  withFileTransportTransaction,resetFileTransportState,fileTransportInternals,
  initFileSystem,getFileMetadata,listDeviceFiles,listDirectory,getFileInfo,putFile,
  deleteFile,moveFile,setFileMetadata,startPlayback,stopPlayback,getFile
}from './fileTransport.js?v=20260930-5';
import{
  normalizeFileName,prepareSampleCreateMetadata,prepareSampleWritableMetadata,
  prepareSampleLocalMetadata,prepareSampleTransferMetadata,createTransferFileName,
  uploadSampleToSlotWithTransport
}from './sampleFilesystem.js?v=20260930-5';
import{createProjectFilesystem,assertProjectWriteActiveGuard}from './projectFilesystem.js?v=20260930-5';
import{createBrowserProjectRecoveryStore}from './projectRecovery.js?v=20260930-5';

export{
  calculateMaxPayloadLength,buildFileInitPayload,buildFileListPayload,parseMetadataResponse,
  buildMetadataGetPayload,parseFileListEntries,buildFileInfoPayload,parseFileInfoResponse,
  buildFileDeletePayload,buildFileMovePayload,parseFileMoveResponse,buildFilePutInitPayload,
  validateFilePutPage,buildFilePutDataPayload,buildMetadataSetPayload,buildMetadataPagedInitPayload,
  buildMetadataPagedDataPayload,validateFileGetChunk,buildFileGetInitPayload,buildFileGetDataPayload
}from './fileProtocol.js?v=20260930-5';

export{
  normalizeFileName,prepareSampleCreateMetadata,prepareSampleWritableMetadata,
  prepareSampleLocalMetadata,prepareSampleTransferMetadata,createTransferFileName,
  assertProjectWriteActiveGuard,
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

export function withFileTransaction(label,operation,{strict=false}={}){
  if(typeof operation!=='function')throw new TypeError('FILE transaction requires an operation.');
  return withFileTransportTransaction(label,fileOps=>operation(Object.freeze({
    ...fileOps,
    uploadSampleToSlot:args=>sampleUploadForTransport(args,fileOps)
  })),{strict});
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

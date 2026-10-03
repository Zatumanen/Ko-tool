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
import{createSampleDependencyGuard}from './sampleDependencyGuard.js?v=20261001-1';
import{createBrowserProjectRecoveryStore}from './projectRecovery.js?v=20261001-1';
import{createSampleTransactionRuntime}from './sampleTransactionRuntime.js?v=20261001-1';
import{publishSampleRecoveryEvent}from './deviceRecoveryRuntimeBridge.js';
import{toStructuredEpError,EP_ERROR_CATEGORY,EP_ERROR_CODE}from './errors.js?v=20261001-1';

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
  assertProjectWriteActiveGuard,getFileOperationCoordinatorState,
  initFileSystem,getFileMetadata,listDeviceFiles,listDirectory,getFileInfo,putFile,
  deleteFile,moveFile,setFileMetadata,startPlayback,stopPlayback,getFile
};

const projectRecoveryStore=createBrowserProjectRecoveryStore();
const sampleDependencyGuard=createSampleDependencyGuard({getConnectedDeviceInfo});
const sampleTransactionRuntime=createSampleTransactionRuntime({getConnectedDeviceInfo,onRecoveryEvent:publishSampleRecoveryEvent});
const projectFilesystem=createProjectFilesystem({
  runFileOperation:fileTransportInternals.runFileOperation,
  withStrictFirmwareDebugGuard,getConnectedDeviceInfo,markDeviceUnsafe,isDeviceUnsafe,
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
  putFile:fileOps.putFile,setFileMetadata:fileOps.setFileMetadata,initFileSystem:fileOps.initFileSystem
});
const sampleFileOps=fileOps=>Object.freeze({...fileOps,uploadSampleToSlot:args=>sampleUploadForTransport(args,fileOps)});
const structuredFileError=(error,label)=>toStructuredEpError(error,{
  code:isDeviceUnsafe()?EP_ERROR_CODE.FILE_SAFETY_LOCK:EP_ERROR_CODE.FILE_OPERATION_FAILED,
  category:isDeviceUnsafe()?EP_ERROR_CATEGORY.SAFETY:EP_ERROR_CATEGORY.TRANSPORT,
  recovery:isDeviceUnsafe()?'Power-cycle the device, then reload before sending more FILE traffic.':null,
  details:{operation:String(label||'FILE transaction')}
});

export function withFileTransaction(label,operation,{strict=false}={}){
  if(typeof operation!=='function')throw new TypeError('FILE transaction requires an operation.');
  return withFileTransportTransaction(label,async fileOps=>{
    try{
      if(strict)await sampleDependencyGuard.assertOperationSafe(fileOps,operation);
      const ops=sampleFileOps(fileOps);
      return strict?sampleTransactionRuntime.run({label,operation,fileOps:ops}):operation(ops);
    }catch(error){throw structuredFileError(error,label);}
  },{strict});
}

export function withSampleUploadBatch(operation){
  if(typeof operation!=='function')throw new TypeError('Sample upload batch requires an operation.');
  return withStrictFirmwareDebugGuard(operation,'sample upload batch');
}

export function uploadSampleToSlot(args){
  const label='sample upload transaction';
  return withFileTransportTransaction(label,async fileOps=>{
    try{return await sampleTransactionRuntime.run({
      label,fileOps:sampleFileOps(fileOps),operation:ops=>ops.uploadSampleToSlot(args)
    });}catch(error){throw structuredFileError(error,label);}
  },{strict:true});
}

const runSampleRecoveryRead=(label,operation)=>withFileTransportTransaction(label,async fileOps=>{
  try{return await operation(sampleFileOps(fileOps));}
  catch(error){throw structuredFileError(error,label);}
},{strict:false});
export const verifySampleRecoveryTransaction=id=>runSampleRecoveryRead(
  'sample recovery verification',fileOps=>sampleTransactionRuntime.verifyTransaction(id,fileOps)
);
export const acknowledgeSampleRecoveryTransaction=id=>runSampleRecoveryRead(
  'sample recovery acknowledge',fileOps=>sampleTransactionRuntime.acknowledgeTransaction(id,fileOps)
);

export function resetFileSystemState(){projectFilesystem.resetProjectRuntime();resetFileTransportState();}
export function getProjectRuntimeSettleState(){return projectFilesystem.getProjectRuntimeSettleState();}
export function assertProjectRuntimeSettled(label='project operation'){return projectFilesystem.assertProjectRuntimeSettled(label);}
export const listProjectArchivesReadOnly=()=>projectFilesystem.listProjectArchivesReadOnly();
export const readProjectArchiveReadOnly=(projectNumber,options={})=>projectFilesystem.readProjectArchiveReadOnly(projectNumber,options);
export const reloadProjectArchive=(projectNumber,options={})=>projectFilesystem.reloadProjectArchive(projectNumber,options);
export const previewProjectArchiveWrite=(file,options={})=>projectFilesystem.previewProjectArchiveWrite(file,options);
export const uploadProjectArchive=(file,options={})=>projectFilesystem.uploadProjectArchive(file,options);
Object.defineProperty(uploadProjectArchive,'preview',{value:previewProjectArchiveWrite});
export const downloadProjectArchive=(path,onProgress)=>projectFilesystem.downloadProjectArchive(path,onProgress);
export const getProjectRecoveryCheckpoint=id=>projectFilesystem.getProjectRecoveryCheckpoint(id);
export const listProjectRecoveryCheckpoints=()=>projectFilesystem.listProjectRecoveryCheckpoints();
export const deleteProjectRecoveryCheckpoint=id=>projectFilesystem.deleteProjectRecoveryCheckpoint(id);
export const getProjectTransactionJournal=id=>projectFilesystem.getProjectTransactionJournal(id);
export const restoreProjectRecoveryCheckpoint=(id,options={})=>projectFilesystem.restoreProjectRecoveryCheckpoint(id,options);
export const getSampleRecoveryTransaction=id=>sampleTransactionRuntime.getTransaction(id);
export const listSampleRecoveryTransactions=()=>sampleTransactionRuntime.listTransactions();
export const deleteSampleRecoveryTransaction=id=>sampleTransactionRuntime.deleteTransaction(id);

onConnectionChange(({connected})=>{if(!connected)projectFilesystem.resetProjectRuntime();});
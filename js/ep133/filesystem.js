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
import{createBrowserSampleRecoveryStore}from './sampleRecovery.js?v=20261001-1';
import{
  createSampleTransactionJournal,createJournaledSampleFileOps,sampleOperationFromLabel
}from './sampleTransactionJournal.js?v=20261001-1';

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
const sampleRecoveryStore=createBrowserSampleRecoveryStore();
const sampleDependencyGuard=createSampleDependencyGuard({getConnectedDeviceInfo});
const sampleTransactionJournal=createSampleTransactionJournal({
  recoveryStore:sampleRecoveryStore,getConnectedDeviceInfo
});
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
const sampleFileOps=fileOps=>Object.freeze({
  ...fileOps,
  uploadSampleToSlot:args=>sampleUploadForTransport(args,fileOps)
});

export function withFileTransaction(label,operation,{strict=false}={}){
  if(typeof operation!=='function')throw new TypeError('FILE transaction requires an operation.');
  return withFileTransportTransaction(label,async fileOps=>{
    if(strict)await sampleDependencyGuard.assertOperationSafe(fileOps,operation);
    const baseOps=sampleFileOps(fileOps);
    const sampleOperation=strict?sampleOperationFromLabel(label):null;
    if(!sampleOperation)return operation(baseOps);

    const transaction=await sampleTransactionJournal.begin({
      operation:sampleOperation,label,
      detail:{coordinator:'filesystem.withFileTransaction'}
    });
    let precheckComplete=false;
    const ensurePrecheckComplete=async()=>{
      if(precheckComplete)return;
      await sampleTransactionJournal.completePhase(transaction.id,'PRECHECK',{label});
      precheckComplete=true;
    };
    const journaledOps=createJournaledSampleFileOps({
      fileOps:baseOps,journal:sampleTransactionJournal,
      transactionId:transaction.id,ensurePrecheckComplete
    });

    try{
      const result=await operation(journaledOps);
      await ensurePrecheckComplete();
      await sampleTransactionJournal.succeed(transaction.id,{label});
      return result;
    }catch(error){
      if(!precheckComplete){
        try{await sampleTransactionJournal.failPhase(transaction.id,'PRECHECK',error,{label});}catch{}
      }
      try{await sampleTransactionJournal.fail(transaction.id,error,{label});}catch{}
      throw error;
    }
  },{strict});
}

export function withSampleUploadBatch(operation){
  if(typeof operation!=='function')throw new TypeError('Sample upload batch requires an operation.');
  return withStrictFirmwareDebugGuard(operation,'sample upload batch');
}

export function uploadSampleToSlot(args){
  return withFileTransaction('sample upload transaction',fileOps=>fileOps.uploadSampleToSlot(args),{strict:true});
}

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
export const getSampleRecoveryTransaction=id=>sampleTransactionJournal.getTransaction(id);
export const listSampleRecoveryTransactions=()=>sampleTransactionJournal.listTransactions();
export const deleteSampleRecoveryTransaction=id=>sampleTransactionJournal.deleteTransaction(id);

onConnectionChange(({connected})=>{if(!connected)projectFilesystem.resetProjectRuntime();});

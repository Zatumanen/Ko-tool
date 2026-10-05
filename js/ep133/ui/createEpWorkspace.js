import{
  connectEp133,isConnected,markDeviceUnsafe,getConnectedDeviceInfo,getDeviceSessionToken,onFileEvent,waitForFileEvent,
  listDirectory,getFile,getFileMetadata,getFileInfo,uploadSampleToSlot,withFileTransaction,
  listProjectArchivesReadOnly,readProjectArchiveReadOnly,uploadProjectArchive,
  getProjectRecoveryCheckpoint,listProjectRecoveryCheckpoints,deleteProjectRecoveryCheckpoint,
  restoreProjectRecoveryCheckpoint,
  deleteFile,moveFile,setFileMetadata,startPlayback,stopPlayback,normalizeFileName,
  prepareSampleTransferMetadata,prepareSampleLocalMetadata,createTransferFileName
}from '../index.js?v=20261001-1';
import{getDeviceRuntimeSnapshot,onDeviceRuntimeChange}from '../deviceRuntime.js';
import{TE_SYSEX_FILE_EVENT_METADATA_UPDATED}from '../constants.js';
import{createSampleMemory}from '../sampleMemory.js?v=20261001-1';
import{getEpDeviceProfile}from '../deviceProfile.js?v=20261001-1';
import{createSamplePropertiesController}from './samplePropertiesController.js?v=20261001-1';
import{createSampleStore}from '../sampleStore.js?v=20261001-1';
import{createSessionGuard}from './sessionGuard.js?v=20261001-1';
import{createFeedbackController}from './feedback.js?v=20261001-1';
import{buildFileItemFromInfo}from './fileModel.js?v=20261001-1';
import{createFileEventController}from './fileEvents.js?v=20261001-1';
import{createConnectionLifecycle}from './connectionLifecycle.js?v=20261001-1';
import{createSampleLibrarySyncController}from './sampleLibrarySync.js?v=20261001-1';
import{createSampleReadController}from './sampleReadController.js?v=20261001-1';
import{createSampleDeleteController}from './sampleDeleteController.js?v=20261001-1';
import{createSampleUploadController}from './sampleUploadController.js?v=20261001-1';
import{createSampleMoveController}from './sampleMoveController.js?v=20261001-1';
import{createSampleCopyController}from './sampleCopyController.js?v=20261001-1';
import{createSampleRenameController}from './sampleRenameController.js?v=20261001-1';
import{createSampleTransferCoordinator}from './sampleTransferCoordinator.js?v=20261001-1';
import{createSampleVerificationController}from './sampleVerification.js?v=20261001-1';
import{createDeviceView}from './deviceView.js?v=20261001-1';
import{createProjectReadOnlyController}from './projectReadOnlyController.js?v=20261001-1';
import{createVerifiedProjectEditorController}from './projectEditorController.js?v=20261001-1';
import{createProjectSequencerController}from './projectSequencerController.js?v=20261001-1';
import{createBackupRestoreController}from './backupRestoreController.js?v=20261001-1';
import{outputFileName}from '../../output-name.js';

const DEFAULT_SERVICES=Object.freeze({
  connectEp133,isConnected,markDeviceUnsafe,getConnectedDeviceInfo,getDeviceSessionToken,onFileEvent,waitForFileEvent,
  listDirectory,getFile,getFileMetadata,getFileInfo,uploadSampleToSlot,withFileTransaction,
  listProjectArchivesReadOnly,readProjectArchiveReadOnly,uploadProjectArchive,
  getProjectRecoveryCheckpoint,listProjectRecoveryCheckpoints,deleteProjectRecoveryCheckpoint,restoreProjectRecoveryCheckpoint,
  deleteFile,moveFile,setFileMetadata,startPlayback,stopPlayback,normalizeFileName,
  prepareSampleTransferMetadata,prepareSampleLocalMetadata,createTransferFileName,
  getDeviceRuntimeSnapshot,onDeviceRuntimeChange
});

export function createEpWorkspace({
  dom,services={},showError,
  documentRef=globalThis.document,windowRef=globalThis.window
}={}){
  if(!dom)throw new TypeError('EP workspace requires a DOM registry.');
  const api={...DEFAULT_SERVICES,...services};
  const{
    connectEp133,isConnected,markDeviceUnsafe,getConnectedDeviceInfo,getDeviceSessionToken,onFileEvent,waitForFileEvent,
    listDirectory,getFile,getFileMetadata,getFileInfo,uploadSampleToSlot,withFileTransaction,
    listProjectArchivesReadOnly,readProjectArchiveReadOnly,uploadProjectArchive,
    getProjectRecoveryCheckpoint,listProjectRecoveryCheckpoints,deleteProjectRecoveryCheckpoint,restoreProjectRecoveryCheckpoint,
    deleteFile,moveFile,setFileMetadata,startPlayback,stopPlayback,normalizeFileName,
    prepareSampleTransferMetadata,prepareSampleLocalMetadata,createTransferFileName,
    getDeviceRuntimeSnapshot,onDeviceRuntimeChange
  }=api;
  const{
    open,panel,close,title,list,tabs,search,searchClear,searchCount,
    deviceHead,deviceName,connectionOverlay,statusEl,memoryStats,memoryMeter,sampleCount,txIndicator,rxIndicator,
    properties,propertiesGrid,globalProgress,globalProgressLabel,globalProgressFill,globalProgressText,
    confirmDialog,confirmMessage,confirmOk,confirmCancel,
    samplesPanel,projectsPanel,samplesViewButton,projectsViewButton,
    projectList,projectInspector,projectRefresh,projectEdit,
    projectEditorDialog,projectEditorClose,projectEditorForm,projectEditorSummary,projectEditorSave,projectEditorCancel,
    projectSequencer,sequencerDialog,sequencerClose,sequencerPattern,sequencerBars,sequencerPageLabel,
    sequencerPrevPage,sequencerNextPage,sequencerGrid,sequencerNotes,sequencerAutomation,sequencerPatternSummary,
    sequencerSave,sequencerCancel,sequencerNewPattern,sequencerNewPatternBars,sequencerCreatePattern,
    sequencerDefaultVelocity,sequencerDefaultDuration,sequencerSceneIndex,sequencerSceneA,sequencerSceneB,
    sequencerSceneC,sequencerSceneD,sequencerSceneNum,sequencerSceneDen,sequencerApplyScene,
    sequencerCurrentScene,sequencerSong,sequencerApplySong,
    projectBackup,projectRecovery,backupDialog,backupClose,backupProject,backupProjectSamples,backupDevice,
    restoreFile,restoreSummary,restoreProjectSelect,restoreRun,recoveryList,recoveryDetail,recoveryRestore,recoveryDownload,recoveryDelete
  }=dom;

  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
  const humanError=message=>String(message||'OPERATION FAILED.').toUpperCase();
  const logTechnical=(label,error)=>{
    const detail=String(error?.stack||error?.message||error||'unknown error');
    console.error(label,error);
    const log=documentRef?.getElementById?.('log-tab');
    if(log)log.insertAdjacentHTML('beforeend','<div><i class="fas fa-exclamation-triangle"></i> MY EP · '+escapeHtml(label)+' · '+escapeHtml(detail)+'</div>');
  };
  const reportError=(message,error)=>{
    logTechnical(message,error);
    showError?.(humanError(message));
  };

  const deviceView=createDeviceView({
    title,deviceName,deviceHead,connectionOverlay,status:statusEl,
    memoryStats,memoryMeter,sampleCount,txIndicator,rxIndicator,
    getDeviceProfile:getEpDeviceProfile
  });
  const setStatus=text=>deviceView.setStatus(text);
  const setConnectionOverlay=text=>deviceView.setConnectionOverlay(text);
  const renderDeviceStats=(metadata,count)=>deviceView.renderStats(metadata,count);

  let synchronized=false;
  let metadataHydrating=false;
  let mutating=false;
  let legacyConnectionUnsafe=false;
  let activeDeviceProfile=deviceView.getActiveProfile();
  let propertiesController=null;
  let memory=null;
  let runtimeSnapshot=getDeviceRuntimeSnapshot();
  const runtimeUnsafe=()=>runtimeSnapshot?.status==='unsafe';
  const runtimeReady=()=>runtimeSnapshot?.status==='ready';
  const sampleStore=createSampleStore();
  const{captureBatchSession,assertBatchSession}=createSessionGuard(getDeviceSessionToken);
  const waitForMetadataUpdate=nodeId=>waitForFileEvent(
    event=>event?.type===TE_SYSEX_FILE_EVENT_METADATA_UPDATED&&Number(event?.data?.nodeId)===Number(nodeId),
    {timeout:500}
  );
  const applySoundsMetadata=metadata=>{
    const soundsMetadata=sampleStore.mergeSoundsMetadata(metadata||{});
    if(Array.isArray(metadata?.tabs)&&metadata.tabs.length)memory?.setTabs?.(metadata.tabs);
    renderDeviceStats(soundsMetadata,sampleStore.countOccupied());
    return soundsMetadata;
  };
  const syncMetadataAfterMutation=async(nodeId,eventPromise,fileOps=null)=>{
    const event=await eventPromise;
    const readMetadata=fileOps?.getFileMetadata||getFileMetadata;
    const metadata=event?.data?.metadata||await readMetadata(nodeId);
    if(Number(nodeId)===Number(sampleStore.getSoundsParentId()))return applySoundsMetadata(metadata);
    if(Number(nodeId)>=1&&Number(nodeId)<=999){
      sampleStore.setMetadata(Number(nodeId),metadata||{});
      propertiesController?.renderIfCurrent(Number(nodeId));
    }
    return metadata;
  };

  const updateMutationAvailability=()=>{
    memory?.setMutationsEnabled?.(!!(runtimeReady()&&synchronized&&!metadataHydrating&&!mutating));
  };
  const setMutating=value=>{
    mutating=!!value;
    updateMutationAvailability();
  };
  const unsubscribeRuntime=onDeviceRuntimeChange(snapshot=>{
    runtimeSnapshot=snapshot;
    updateMutationAvailability();
  });

  const{setGlobalProgress,hideGlobalProgress,confirmAction,resolveConfirm}=createFeedbackController({
    globalProgress,globalProgressLabel,globalProgressFill,globalProgressText,
    confirmDialog,confirmMessage,confirmOk,confirmCancel
  });

  let projectEditorController=null;
  let projectSequencerController=null;
  const projectReadOnlyController=createProjectReadOnlyController({
    samplesPanel,projectsPanel,
    samplesButton:samplesViewButton,projectsButton:projectsViewButton,
    projectList,projectInspector,refreshButton:projectRefresh,
    listProjectArchivesReadOnly,readProjectArchiveReadOnly,
    getSampleSlot:slot=>sampleStore.getSlot(slot),
    onProjectLoaded:result=>{
      projectEditorController?.setProject(result);
      projectSequencerController?.setProject(result);
    },
    onProjectCleared:()=>{
      projectEditorController?.setProject(null);
      projectSequencerController?.setProject(null);
    },
    isConnected,setStatus,setGlobalProgress,hideGlobalProgress,reportError
  });

  projectEditorController=createVerifiedProjectEditorController({
    dialog:projectEditorDialog,openButton:projectEdit,closeButton:projectEditorClose,
    form:projectEditorForm,summaryEl:projectEditorSummary,
    saveButton:projectEditorSave,cancelButton:projectEditorCancel,
    uploadProjectArchive,confirmAction,setStatus,setGlobalProgress,hideGlobalProgress,
    refreshProjects:()=>projectReadOnlyController.refresh(),reportError
  });

  projectSequencerController=createProjectSequencerController({
    dialog:sequencerDialog,openButton:projectSequencer,closeButton:sequencerClose,
    patternSelect:sequencerPattern,barsInput:sequencerBars,pageLabel:sequencerPageLabel,
    prevPageButton:sequencerPrevPage,nextPageButton:sequencerNextPage,
    grid:sequencerGrid,rawEvents:sequencerNotes,automationPanel:sequencerAutomation,
    patternSummary:sequencerPatternSummary,saveButton:sequencerSave,cancelButton:sequencerCancel,
    newPatternInput:sequencerNewPattern,newPatternBars:sequencerNewPatternBars,newPatternButton:sequencerCreatePattern,
    defaultVelocity:sequencerDefaultVelocity,defaultDuration:sequencerDefaultDuration,
    sceneIndexInput:sequencerSceneIndex,sceneA:sequencerSceneA,sceneB:sequencerSceneB,
    sceneC:sequencerSceneC,sceneD:sequencerSceneD,
    sceneNumerator:sequencerSceneNum,sceneDenominator:sequencerSceneDen,sceneApplyButton:sequencerApplyScene,
    currentSceneInput:sequencerCurrentScene,songInput:sequencerSong,songApplyButton:sequencerApplySong,
    uploadProjectArchive,confirmAction,setStatus,setGlobalProgress,hideGlobalProgress,
    refreshProjects:()=>projectReadOnlyController.refresh(),reportError
  });

  const fileItemFromInfo=info=>buildFileItemFromInfo(info,sampleStore.getFiles());
  const sampleVerification=createSampleVerificationController({sampleStore,listDirectory});
  const{assertSlotsEmpty,assertSlotsDeleted}=sampleVerification;
  const getDroppedFiles=event=>{
    const resultId=event.dataTransfer?.getData('application/x-speeduppercut-result');
    if(resultId){
      const sourceWindows=[windowRef,windowRef?.opener].filter(Boolean);
      const item=sourceWindows.map(w=>w.__speedUpperCutFiles?.get(resultId)).find(Boolean);
      if(item?.result?.blob){
        return[new File([item.result.blob],item.outputName||outputFileName(item.file.name),{type:'audio/wav'})];
      }
    }
    return Array.from(event.dataTransfer?.files||[]);
  };
  const getClipboardAudioFiles=event=>Array.from(event.clipboardData?.items||[])
    .filter(item=>String(item.type||'').includes('audio'))
    .map(item=>item.getAsFile?.())
    .filter(Boolean);

  propertiesController=createSamplePropertiesController({
    properties,propertiesGrid,sampleStore,
    getActiveDeviceProfile:()=>activeDeviceProfile,
    isConnected,isSynchronized:()=>synchronized,
    isMetadataHydrating:()=>metadataHydrating,isMutating:()=>mutating,
    withFileTransaction,setFileMetadata,getFileMetadata,
    showError:message=>showError?.(message),logTechnical,escapeHtml
  });
  const closeProperties=()=>propertiesController.close();
  const openProperties=(slot,event)=>propertiesController.open(slot,event);
  const sampleRenameController=createSampleRenameController({
    sampleStore,isConnected,isSynchronized:()=>synchronized,
    withFileTransaction,setFileMetadata,getFileMetadata,normalizeFileName
  });

  const sampleReadController=createSampleReadController({
    sampleStore,getMemory:()=>memory,isConnected,
    startPlayback,stopPlayback,withFileTransaction,getFile,getFileMetadata,
    captureBatchSession,assertBatchSession,setGlobalProgress,hideGlobalProgress,reportError
  });
  const stopCurrentPreview=()=>sampleReadController.stopPreview();
  const auditionSample=slot=>sampleReadController.audition(slot);
  const sampleDeleteController=createSampleDeleteController({
    sampleStore,getSoundsParentId:()=>sampleStore.getSoundsParentId(),
    getSoundsMetadata:()=>sampleStore.getSoundsMetadata(),isConnected,
    isSynchronized:()=>synchronized,
    hasPendingPropertyWrites:()=>propertiesController.hasPendingWrites(),
    confirmAction,withFileTransaction,captureBatchSession,assertBatchSession,getDeviceSessionToken,
    setMutating,setGlobalProgress,hideGlobalProgress,getFileInfo,getFileMetadata,deleteFile,
    waitForMetadataUpdate,syncMetadataAfterMutation,assertSlotsDeleted,renderDeviceStats,
    readDevice:()=>readDevice(),logTechnical
  });
  const deleteSamples=targets=>sampleDeleteController.deleteSamples(targets);
  const fileEventController=createFileEventController({
    isConnected,sampleStore,getSoundsParentId:()=>sampleStore.getSoundsParentId(),
    getSoundsMetadata:()=>sampleStore.getSoundsMetadata(),
    getCurrentPropertySlotId:()=>propertiesController.getCurrentSlotId(),
    withFileTransaction,getFileInfo,getFileMetadata,fileItemFromInfo,applySoundsMetadata,
    renderProperties:slot=>propertiesController.render(slot),renderDeviceStats,closeProperties,logTechnical
  });
  const{suppressNativeMoveEvent,clearNativeMoveSuppression,markUploadPending,clearUploadPending}=fileEventController;
  const refreshSoundsRuntimeMetadata=async(fileOps=null)=>{
    const soundsParentId=sampleStore.getSoundsParentId();
    if(!soundsParentId)return sampleStore.getSoundsMetadata();
    const readMetadata=fileOps?.getFileMetadata||getFileMetadata;
    const latest=await readMetadata(soundsParentId);
    const soundsMetadata=latest&&typeof latest==='object'
      ?sampleStore.mergeSoundsMetadata(latest):sampleStore.getSoundsMetadata();
    if(Array.isArray(soundsMetadata?.tabs)&&soundsMetadata.tabs.length)memory?.setTabs(soundsMetadata.tabs);
    renderDeviceStats(soundsMetadata,sampleStore.countOccupied());
    return soundsMetadata;
  };
  const sampleUploadController=createSampleUploadController({
    sampleStore,getMemory:()=>memory,getSoundsParentId:()=>sampleStore.getSoundsParentId(),
    getSoundFormats:()=>sampleStore.getSoundFormats(),getSoundsMetadata:()=>sampleStore.getSoundsMetadata(),
    setSoundsMetadata:value=>sampleStore.setSoundsMetadata(value),getActiveDeviceProfile:()=>activeDeviceProfile,
    isConnected,isSynchronized:()=>synchronized,isDeviceUnsafe:()=>runtimeUnsafe()||legacyConnectionUnsafe,
    captureBatchSession,assertBatchSession,setMutating,setGlobalProgress,hideGlobalProgress,
    withFileTransaction,assertSlotsEmpty,refreshSoundsRuntimeMetadata,
    uploadSampleToSlot,prepareSampleLocalMetadata,normalizeFileName,fileItemFromInfo,getFileInfo,getFileMetadata,
    renderDeviceStats,markUploadPending,clearUploadPending,waitForMetadataUpdate,deleteFile,
    syncMetadataAfterMutation,assertSlotsDeleted,logTechnical,showError:message=>showError?.(message)
  });
  const uploadFilesToSlot=(slot,files)=>sampleUploadController.uploadFilesToSlot(slot,files);
  const sampleMoveController=createSampleMoveController({
    sampleStore,getSoundsParentId:()=>sampleStore.getSoundsParentId(),getSoundsMetadata:()=>sampleStore.getSoundsMetadata(),
    fileItemFromInfo,remapCurrentPropertySlot:(oldId,newId)=>propertiesController.remapCurrentSlot(oldId,newId),
    renderDeviceStats,withFileTransaction,captureBatchSession,assertBatchSession,getDeviceSessionToken,
    isConnected,setMutating,setGlobalProgress,hideGlobalProgress,suppressNativeMoveEvent,clearNativeMoveSuppression,
    moveFile,readDevice:()=>readDevice(),logTechnical
  });
  const sampleCopyController=createSampleCopyController({
    sampleStore,getSoundsParentId:()=>sampleStore.getSoundsParentId(),getSoundsMetadata:()=>sampleStore.getSoundsMetadata(),
    getActiveDeviceProfile:()=>activeDeviceProfile,isConnected,withFileTransaction,captureBatchSession,assertBatchSession,getDeviceSessionToken,
    setMutating,setGlobalProgress,hideGlobalProgress,assertSlotsEmpty,refreshSoundsRuntimeMetadata,
    getFile,getFileMetadata,prepareSampleTransferMetadata,createTransferFileName,uploadSampleToSlot,
    waitForMetadataUpdate,syncMetadataAfterMutation,getFileInfo,fileItemFromInfo,prepareSampleLocalMetadata,
    renderDeviceStats,deleteFile,readDevice:()=>readDevice(),logTechnical
  });
  const sampleTransferCoordinator=createSampleTransferCoordinator({
    sampleStore,getActiveDeviceProfile:()=>activeDeviceProfile,isConnected,isSynchronized:()=>synchronized,
    getSoundsParentId:()=>sampleStore.getSoundsParentId(),hasPendingPropertyWrites:()=>propertiesController.hasPendingWrites(),
    moveTransfer:(plan,sourceById)=>sampleMoveController.nativeMoveTransfer(plan,sourceById),
    copyTransfer:(plan,sourceById,sources)=>sampleCopyController.copyTransfer(plan,sourceById,sources)
  });
  const transactionalTransfer=(sources,dropSlot,options)=>sampleTransferCoordinator.transfer(sources,dropSlot,options);

  memory=createSampleMemory({
    listEl:list,tabsEl:tabs,searchEl:search,searchClearEl:searchClear,searchCountEl:searchCount,
    onSelect:slot=>{closeProperties();setStatus(slot?'SLOT '+String(slot.id).padStart(3,'0')+' SELECTED':'');},
    onPlay:auditionSample,onDelete:deleteSamples,onRename:(slot,value)=>sampleRenameController.rename(slot,value),
    onDownload:slot=>sampleReadController.downloadOne(slot),
    onDownloadMany:selectedSlots=>sampleReadController.downloadMany(selectedSlots),onTransfer:transactionalTransfer,
    onDrop:async(slot,event)=>uploadFilesToSlot(slot,getDroppedFiles(event)),onContext:(slot,event)=>openProperties(slot,event),
    onDragStart:closeProperties,onUserError:(message,error)=>reportError(message,error)
  });
  sampleStore.bindMemory(memory);
  updateMutationAvailability();

  const sampleLibrarySync=createSampleLibrarySyncController({
    captureBatchSession,assertBatchSession,getMemory:()=>memory,getActiveDeviceProfile:()=>activeDeviceProfile,
    sampleStore,withFileTransaction,listDirectory,getFileMetadata,
    setSynchronized:value=>{synchronized=!!value;updateMutationAvailability();},
    setMetadataHydrating:value=>{metadataHydrating=!!value;updateMutationAvailability();},
    setSoundsMetadata:value=>sampleStore.setSoundsMetadata(value),updateMutationAvailability,closeProperties,
    setGlobalProgress,hideGlobalProgress,renderDeviceStats,setStatus,reportError,logTechnical
  });
  const{readDevice}=sampleLibrarySync;

  const backupRestoreController=createBackupRestoreController({
    dialog:backupDialog,openButton:projectBackup,recoveryButton:projectRecovery,closeButton:backupClose,
    backupProjectButton:backupProject,backupProjectSamplesButton:backupProjectSamples,backupDeviceButton:backupDevice,
    restoreInput:restoreFile,restoreSummary,restoreProjectSelect,restoreButton:restoreRun,
    recoveryList,recoveryDetail,recoveryRestoreButton:recoveryRestore,recoveryDownloadButton:recoveryDownload,recoveryDeleteButton:recoveryDelete,
    getSelectedProject:()=>projectReadOnlyController.getState().selectedProject,getConnectedDeviceInfo,
    getActiveDeviceProfile:()=>activeDeviceProfile,sampleStore,withFileTransaction,uploadProjectArchive,restoreProjectRecoveryCheckpoint,
    listProjectRecoveryCheckpoints,getProjectRecoveryCheckpoint,deleteProjectRecoveryCheckpoint,prepareSampleTransferMetadata,
    readDevice:()=>readDevice(),refreshProjects:()=>projectReadOnlyController.refresh(),markDeviceUnsafe,
    confirmAction,setStatus,setGlobalProgress,hideGlobalProgress,reportError
  });

  onFileEvent(event=>{void fileEventController.handleFileEvent(event);});

  const renderConnection=state=>{
    legacyConnectionUnsafe=!!state?.unsafe;
    activeDeviceProfile=deviceView.renderIdentity(state);
    const unsafe=runtimeUnsafe()||legacyConnectionUnsafe;
    if(unsafe){
      metadataHydrating=false;synchronized=false;updateMutationAvailability();
      void stopCurrentPreview();closeProperties();hideGlobalProgress();
      panel.classList.add('device-disconnected');
      setConnectionOverlay('POWER CYCLE EP · THEN RELOAD');
      setStatus('EP FILE SAFETY LOCK · POWER CYCLE DEVICE AND RELOAD PAGE');
      if(state?.unsafeReason)logTechnical('EP FILE SAFETY LOCK',state.unsafeReason);
      return;
    }
    if(state?.connected){
      panel.classList.remove('device-disconnected');setConnectionOverlay('');setStatus('CONNECTED');return;
    }
    metadataHydrating=false;synchronized=false;updateMutationAvailability();
    void stopCurrentPreview();closeProperties();hideGlobalProgress();panel.classList.add('device-disconnected');
    const hadConnection=deviceView.hasEverConnected();
    setConnectionOverlay(hadConnection?'DEVICE DISCONNECTED':'CONNECT EP SERIES');
    if(!hadConnection)renderDeviceStats({},0);
    sampleStore.clear();projectReadOnlyController.reset();projectEditorController.close();projectSequencerController.close();backupRestoreController.close();
    setStatus(hadConnection?'DEVICE DISCONNECTED':'CONNECT EP SERIES');
  };

  const connectionLifecycle=createConnectionLifecycle({
    connectEp133,isConnected,isUnsafe:()=>runtimeUnsafe()||legacyConnectionUnsafe,
    setConnectionOverlay,setSessionNotice:message=>setStatus(message),showError:message=>showError?.(message),logTechnical
  });
  connectionLifecycle.start();

  const closePanel=()=>{
    closeProperties();void stopCurrentPreview();panel.style.display='none';panel.setAttribute('aria-hidden','true');
  };
  const openPanel=()=>{
    connectionLifecycle.arm();panel.style.display='flex';panel.setAttribute('aria-hidden','false');
    if(!isConnected())void connectionLifecycle.autoConnect();
  };
  const handleConnection=state=>{
    renderConnection(state);
    if(state?.connected&&!state?.unsafe){
      void readDevice();
      if(projectReadOnlyController.getState().mode==='projects')void projectReadOnlyController.refresh();
    }
  };
  const handlePaste=event=>{
    if(panel.style.display==='none'||!synchronized||mutating)return;
    const files=getClipboardAudioFiles(event);const slot=memory.getSelected();
    if(files.length&&slot)void uploadFilesToSlot(slot,files).catch(error=>reportError('COULD NOT UPLOAD SAMPLE.',error));
  };
  const handlePointerDown=event=>{
    if(properties&&!properties.hidden&&!properties.contains(event.target)&&!event.target.closest?.('.ep133-sample-row'))closeProperties();
  };
  const handleKeyDown=event=>{
    if(event.key!=='Escape'||event.defaultPrevented)return;
    if(confirmDialog&&!confirmDialog.hidden){event.preventDefault();resolveConfirm(false);return;}
    if(projectEditorDialog&&!projectEditorDialog.hidden){event.preventDefault();projectEditorController.close();return;}
    if(sequencerDialog&&!sequencerDialog.hidden){event.preventDefault();projectSequencerController.close();return;}
    if(backupDialog&&!backupDialog.hidden){event.preventDefault();backupRestoreController.close();return;}
    if(properties&&!properties.hidden){event.preventDefault();closeProperties();return;}
    if(panel.style.display!=='none'){event.preventDefault();closePanel();}
  };
  const handleMidiActivity=({direction})=>deviceView.pulseMidiActivity(direction);
  const dispose=()=>{unsubscribeRuntime?.();connectionLifecycle.dispose?.();};

  renderConnection({connected:false});
  return Object.freeze({
    openPanel,closePanel,closeProperties,handleConnection,handlePaste,handlePointerDown,handleKeyDown,handleMidiActivity,dispose,
    isSynchronized:()=>synchronized,isMutating:()=>mutating
  });
}

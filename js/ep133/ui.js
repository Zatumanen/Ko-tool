import{
  connectEp133,isConnected,isDeviceUnsafe,getDeviceSessionToken,onConnectionChange,onFileEvent,waitForFileEvent,onMidiActivity,
  listDirectory,getFile,getFileMetadata,getFileInfo,uploadSampleToSlot,withFileTransaction,
  listProjectArchivesReadOnly,readProjectArchiveReadOnly,
  deleteFile,moveFile,setFileMetadata,startPlayback,stopPlayback,normalizeFileName,
  prepareSampleTransferMetadata,prepareSampleLocalMetadata,createTransferFileName
}from './index.js?v=20260930-5';
import{
  TE_SYSEX_FILE_CAPABILITY_READ,TE_SYSEX_FILE_CAPABILITY_WRITE,
  TE_SYSEX_FILE_CAPABILITY_DELETE,TE_SYSEX_FILE_CAPABILITY_MOVE,
  TE_SYSEX_FILE_CAPABILITY_PLAYBACK,TE_SYSEX_FILE_FILE_TYPE_FILE,
  TE_SYSEX_FILE_EVENT_METADATA_UPDATED,TE_SYSEX_FILE_EVENT_FILE_ADDED,
  TE_SYSEX_FILE_EVENT_FILE_UPDATED,TE_SYSEX_FILE_EVENT_FILE_DELETED,
  TE_SYSEX_FILE_EVENT_FILE_MOVED
}from './constants.js';
import{createSampleMemory}from './sampleMemory.js?v=20260930-5';
import{getEpDeviceProfile}from './deviceProfile.js?v=20260930-5';
import{createSamplePropertiesController}from './ui/samplePropertiesController.js?v=20260930-5';
import{createSampleStore}from './sampleStore.js?v=20260930-5';
import{createSessionGuard}from './ui/sessionGuard.js?v=20260930-5';
import{createFeedbackController}from './ui/feedback.js?v=20260930-5';
import{getSoundsParentId,buildFileItemFromInfo}from './ui/fileModel.js?v=20260930-5';
import{createFileEventController}from './ui/fileEvents.js?v=20260930-5';
import{createConnectionLifecycle}from './ui/connectionLifecycle.js?v=20260930-5';
import{createSampleLibrarySyncController}from './ui/sampleLibrarySync.js?v=20260930-5';
import{createSampleReadController}from './ui/sampleReadController.js?v=20260930-5';
import{createSampleDeleteController}from './ui/sampleDeleteController.js?v=20260930-5';
import{createSampleUploadController}from './ui/sampleUploadController.js?v=20260930-5';
import{createSampleMoveController}from './ui/sampleMoveController.js?v=20260930-5';
import{createSampleCopyController}from './ui/sampleCopyController.js?v=20260930-5';
import{createSampleRenameController}from './ui/sampleRenameController.js?v=20260930-5';
import{createSampleTransferCoordinator}from './ui/sampleTransferCoordinator.js?v=20260930-5';
import{createSampleVerificationController}from './ui/sampleVerification.js?v=20260930-5';
import{createDeviceView}from './ui/deviceView.js?v=20260930-5';
import{createProjectReadOnlyController}from './ui/projectReadOnlyController.js?v=20260930-5';
import{outputFileName}from '../output-name.js';

export function initEp133Browser({showError}={}){
  const open=document.getElementById('my-ep-icon');
  const panel=document.getElementById('ep133-browser');
  const close=document.getElementById('ep133-close');
  const title=document.getElementById('ep133-browser-title');
  const list=document.getElementById('ep133-sample-list');
  const tabs=document.getElementById('ep133-sample-tabs');
  const search=document.getElementById('ep133-sample-search');
  const searchClear=document.getElementById('ep133-search-clear');
  const searchCount=document.getElementById('ep133-search-count');
  const deviceHead=document.getElementById('ep133-device-head');
  const deviceName=document.getElementById('ep133-device');
  const connectionOverlay=document.getElementById('ep133-connection-overlay');
  const statusEl=document.getElementById('ep133-status');
  const memoryStats=document.getElementById('ep133-memory-stats');
  const memoryMeter=document.getElementById('ep133-memory-meter-fill');
  const sampleCount=document.getElementById('ep133-sample-count');
  const txIndicator=document.getElementById('ep133-tx-indicator');
  const rxIndicator=document.getElementById('ep133-rx-indicator');
  const properties=document.getElementById('ep133-properties');
  const propertiesGrid=document.getElementById('ep133-properties-grid');
  const globalProgress=document.getElementById('ep133-global-progress');
  const globalProgressLabel=document.getElementById('ep133-global-progress-label');
  const globalProgressFill=document.getElementById('ep133-global-progress-fill');
  const globalProgressText=document.getElementById('ep133-global-progress-text');
  const confirmDialog=document.getElementById('ep133-confirm-dialog');
  const confirmMessage=document.getElementById('ep133-confirm-message');
  const confirmOk=document.getElementById('ep133-confirm-ok');
  const confirmCancel=document.getElementById('ep133-confirm-cancel');
  const samplesPanel=document.getElementById('ep133-samples-panel');
  const projectsPanel=document.getElementById('ep133-projects-panel');
  const samplesViewButton=document.getElementById('ep133-view-samples');
  const projectsViewButton=document.getElementById('ep133-view-projects');
  const projectList=document.getElementById('ep133-project-list');
  const projectInspector=document.getElementById('ep133-project-inspector');
  const projectRefresh=document.getElementById('ep133-project-refresh');
  if(!open||!panel||!close||!list||!tabs||!search||!samplesPanel||!projectsPanel)return;

  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
  const humanError=message=>String(message||'OPERATION FAILED.').toUpperCase();
  const logTechnical=(label,error)=>{
    const detail=String(error?.stack||error?.message||error||'unknown error');
    console.error(label,error);
    const log=document.getElementById('log-tab');
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
  let deviceUnsafe=false;
  let activeDeviceProfile=deviceView.getActiveProfile();
  let propertiesController=null;
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
    memory?.setMutationsEnabled?.(!!(isConnected()&&!deviceUnsafe&&synchronized&&!metadataHydrating&&!mutating));
  };
  const setMutating=value=>{
    mutating=!!value;
    updateMutationAvailability();
  };

  const{setGlobalProgress,hideGlobalProgress,confirmAction,resolveConfirm}=createFeedbackController({
    globalProgress,globalProgressLabel,globalProgressFill,globalProgressText,
    confirmDialog,confirmMessage,confirmOk,confirmCancel
  });

  const projectReadOnlyController=createProjectReadOnlyController({
    samplesPanel,projectsPanel,
    samplesButton:samplesViewButton,projectsButton:projectsViewButton,
    projectList,projectInspector,refreshButton:projectRefresh,
    listProjectArchivesReadOnly,readProjectArchiveReadOnly,
    isConnected,setStatus,setGlobalProgress,hideGlobalProgress,reportError
  });

  const fileItemFromInfo=info=>buildFileItemFromInfo(info,sampleStore.getFiles());
  const sampleVerification=createSampleVerificationController({sampleStore,listDirectory});
  const{assertSlotsEmpty,assertSlotsDeleted}=sampleVerification;
  const getDroppedFiles=event=>{
    const resultId=event.dataTransfer?.getData('application/x-speeduppercut-result');
    if(resultId){
      const sourceWindows=[window,window.opener].filter(Boolean);
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
    properties,propertiesGrid,
    sampleStore,
    getActiveDeviceProfile:()=>activeDeviceProfile,
    isConnected,
    isSynchronized:()=>synchronized,
    isMetadataHydrating:()=>metadataHydrating,
    isMutating:()=>mutating,
    withFileTransaction,setFileMetadata,getFileMetadata,
    showError:message=>showError?.(message),
    logTechnical,escapeHtml
  });
  const closeProperties=()=>propertiesController.close();
  const openProperties=(slot,event)=>propertiesController.open(slot,event);
  const sampleRenameController=createSampleRenameController({
    sampleStore,isConnected,isSynchronized:()=>synchronized,
    withFileTransaction,setFileMetadata,getFileMetadata,normalizeFileName
  });

  let memory;
  const sampleReadController=createSampleReadController({
    sampleStore,getMemory:()=>memory,
    isConnected,
    startPlayback,stopPlayback,
    withFileTransaction,getFile,getFileMetadata,
    captureBatchSession,assertBatchSession,
    setGlobalProgress,hideGlobalProgress,
    reportError
  });
  const stopCurrentPreview=()=>sampleReadController.stopPreview();
  const auditionSample=slot=>sampleReadController.audition(slot);
  const sampleDeleteController=createSampleDeleteController({
    sampleStore,
    getSoundsParentId:()=>sampleStore.getSoundsParentId(),
    getSoundsMetadata:()=>sampleStore.getSoundsMetadata(),
    isConnected,
    isSynchronized:()=>synchronized,
    hasPendingPropertyWrites:()=>propertiesController.hasPendingWrites(),
    confirmAction,withFileTransaction,captureBatchSession,assertBatchSession,getDeviceSessionToken,
    setMutating,setGlobalProgress,hideGlobalProgress,
    getFileInfo,getFileMetadata,deleteFile,
    waitForMetadataUpdate,syncMetadataAfterMutation,
    assertSlotsDeleted,renderDeviceStats,
    readDevice:()=>readDevice(),
    logTechnical
  });
  const deleteSamples=targets=>sampleDeleteController.deleteSamples(targets);
  const fileEventController=createFileEventController({
    isConnected,
    sampleStore,
    getSoundsParentId:()=>sampleStore.getSoundsParentId(),
    getSoundsMetadata:()=>sampleStore.getSoundsMetadata(),
    getCurrentPropertySlotId:()=>propertiesController.getCurrentSlotId(),
    withFileTransaction,getFileInfo,
    getFileMetadata,
    fileItemFromInfo,
    applySoundsMetadata,
    renderProperties:slot=>propertiesController.render(slot),
    renderDeviceStats,
    closeProperties,
    logTechnical
  });
  const{
    suppressNativeMoveEvent,clearNativeMoveSuppression,
    markUploadPending,clearUploadPending
  }=fileEventController;
  const refreshSoundsRuntimeMetadata=async(fileOps=null)=>{
    const soundsParentId=sampleStore.getSoundsParentId();
    if(!soundsParentId)return sampleStore.getSoundsMetadata();
    const readMetadata=fileOps?.getFileMetadata||getFileMetadata;
    const latest=await readMetadata(soundsParentId);
    const soundsMetadata=latest&&typeof latest==='object'
      ?sampleStore.mergeSoundsMetadata(latest)
      :sampleStore.getSoundsMetadata();
    if(Array.isArray(soundsMetadata?.tabs)&&soundsMetadata.tabs.length)memory?.setTabs(soundsMetadata.tabs);
    renderDeviceStats(soundsMetadata,sampleStore.countOccupied());
    return soundsMetadata;
  };
  const sampleUploadController=createSampleUploadController({
    sampleStore,getMemory:()=>memory,
    getSoundsParentId:()=>sampleStore.getSoundsParentId(),
    getSoundFormats:()=>sampleStore.getSoundFormats(),
    getSoundsMetadata:()=>sampleStore.getSoundsMetadata(),
    setSoundsMetadata:value=>sampleStore.setSoundsMetadata(value),
    getActiveDeviceProfile:()=>activeDeviceProfile,
    isConnected,
    isSynchronized:()=>synchronized,
    isDeviceUnsafe:()=>deviceUnsafe,
    captureBatchSession,assertBatchSession,
    setMutating,setGlobalProgress,hideGlobalProgress,
    withFileTransaction,assertSlotsEmpty,refreshSoundsRuntimeMetadata,
    uploadSampleToSlot,prepareSampleLocalMetadata,normalizeFileName,
    fileItemFromInfo,getFileInfo,getFileMetadata,
    renderDeviceStats,
    markUploadPending,clearUploadPending,
    waitForMetadataUpdate,deleteFile,syncMetadataAfterMutation,assertSlotsDeleted,
    logTechnical,
    showError:message=>showError?.(message)
  });
  const uploadFilesToSlot=(slot,files)=>sampleUploadController.uploadFilesToSlot(slot,files);
  const sampleMoveController=createSampleMoveController({
    sampleStore,
    getSoundsParentId:()=>sampleStore.getSoundsParentId(),
    getSoundsMetadata:()=>sampleStore.getSoundsMetadata(),
    fileItemFromInfo,
    remapCurrentPropertySlot:(oldId,newId)=>propertiesController.remapCurrentSlot(oldId,newId),
    renderDeviceStats,
    withFileTransaction,captureBatchSession,assertBatchSession,getDeviceSessionToken,
    isConnected,setMutating,setGlobalProgress,hideGlobalProgress,
    suppressNativeMoveEvent,clearNativeMoveSuppression,
    moveFile,
    readDevice:()=>readDevice(),
    logTechnical
  });
  const sampleCopyController=createSampleCopyController({
    sampleStore,
    getSoundsParentId:()=>sampleStore.getSoundsParentId(),
    getSoundsMetadata:()=>sampleStore.getSoundsMetadata(),
    getActiveDeviceProfile:()=>activeDeviceProfile,
    isConnected,withFileTransaction,captureBatchSession,assertBatchSession,getDeviceSessionToken,
    setMutating,setGlobalProgress,hideGlobalProgress,
    assertSlotsEmpty,refreshSoundsRuntimeMetadata,
    getFile,getFileMetadata,
    prepareSampleTransferMetadata,createTransferFileName,
    uploadSampleToSlot,waitForMetadataUpdate,syncMetadataAfterMutation,
    getFileInfo,fileItemFromInfo,
    prepareSampleLocalMetadata,renderDeviceStats,
    deleteFile,
    readDevice:()=>readDevice(),
    logTechnical
  });
  const sampleTransferCoordinator=createSampleTransferCoordinator({
    sampleStore,getActiveDeviceProfile:()=>activeDeviceProfile,
    isConnected,isSynchronized:()=>synchronized,
    getSoundsParentId:()=>sampleStore.getSoundsParentId(),
    hasPendingPropertyWrites:()=>propertiesController.hasPendingWrites(),
    moveTransfer:(plan,sourceById)=>sampleMoveController.nativeMoveTransfer(plan,sourceById),
    copyTransfer:(plan,sourceById,sources)=>sampleCopyController.copyTransfer(plan,sourceById,sources)
  });
  const transactionalTransfer=(sources,dropSlot,options)=>
    sampleTransferCoordinator.transfer(sources,dropSlot,options);

  memory=createSampleMemory({
    listEl:list,
    tabsEl:tabs,
    searchEl:search,
    searchClearEl:searchClear,
    searchCountEl:searchCount,
    onSelect:slot=>{
      closeProperties();
      setStatus(slot?'SLOT '+String(slot.id).padStart(3,'0')+' SELECTED':'');
    },
    onPlay:auditionSample,
    onDelete:deleteSamples,
    onRename:(slot,value)=>sampleRenameController.rename(slot,value),
    onDownload:slot=>sampleReadController.downloadOne(slot),
    onDownloadMany:selectedSlots=>sampleReadController.downloadMany(selectedSlots),
    onTransfer:transactionalTransfer,
    onDrop:async(slot,event)=>uploadFilesToSlot(slot,getDroppedFiles(event)),
    onContext:(slot,event)=>openProperties(slot,event),
    onDragStart:closeProperties,
    onUserError:(message,error)=>reportError(message,error)
  });
  sampleStore.bindMemory(memory);
  updateMutationAvailability();

  const sampleLibrarySync=createSampleLibrarySyncController({
    captureBatchSession,assertBatchSession,
    getMemory:()=>memory,
    getActiveDeviceProfile:()=>activeDeviceProfile,
    sampleStore,
    withFileTransaction,listDirectory,getFileMetadata,
    setSynchronized:value=>{synchronized=!!value;},
    setMetadataHydrating:value=>{metadataHydrating=!!value;},
    setSoundsMetadata:value=>sampleStore.setSoundsMetadata(value),
    updateMutationAvailability,closeProperties,
    setGlobalProgress,hideGlobalProgress,renderDeviceStats,setStatus,
    reportError,logTechnical
  });
  const{readDevice}=sampleLibrarySync;

  onFileEvent(event=>{void fileEventController.handleFileEvent(event);});


  const renderConnection=state=>{
    deviceUnsafe=!!state?.unsafe;
    activeDeviceProfile=deviceView.renderIdentity(state);
    if(deviceUnsafe){
      metadataHydrating=false;
      synchronized=false;
      updateMutationAvailability();
      void stopCurrentPreview();
      closeProperties();
      hideGlobalProgress();
      panel.classList.add('device-disconnected');
      setConnectionOverlay('POWER CYCLE EP · THEN RELOAD');
      setStatus('EP FILE SAFETY LOCK · POWER CYCLE DEVICE AND RELOAD PAGE');
      if(state?.unsafeReason)logTechnical('EP FILE SAFETY LOCK',state.unsafeReason);
      return;
    }
    if(state.connected){
      panel.classList.remove('device-disconnected');
      setConnectionOverlay('');
      setStatus('CONNECTED');
      return;
    }
    metadataHydrating=false;
    synchronized=false;
    updateMutationAvailability();
    void stopCurrentPreview();
    closeProperties();
    hideGlobalProgress();
    panel.classList.add('device-disconnected');
    const hadConnection=deviceView.hasEverConnected();
    setConnectionOverlay(hadConnection?'DEVICE DISCONNECTED':'CONNECT EP SERIES');
    if(!hadConnection)renderDeviceStats({},0);
    sampleStore.clear();
    projectReadOnlyController.reset();
    setStatus(hadConnection?'DEVICE DISCONNECTED':'CONNECT EP SERIES');
  };

  onMidiActivity(({direction})=>deviceView.pulseMidiActivity(direction));

  const connectionLifecycle=createConnectionLifecycle({
    connectEp133,
    isConnected,
    isUnsafe:()=>deviceUnsafe,
    setConnectionOverlay,
    setSessionNotice:message=>setStatus(message),
    showError:message=>showError?.(message),
    logTechnical
  });
  connectionLifecycle.start();

  const isMobileDevice=()=>/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'');
  const closePanel=()=>{
    closeProperties();
    void stopCurrentPreview();
    panel.style.display='none';
    panel.setAttribute('aria-hidden','true');
  };
  open.addEventListener('click',()=>{
    if(isMobileDevice()){
      showError?.('MY EP WORKS ON DESKTOP COMPUTERS ONLY.');
      return;
    }
    connectionLifecycle.arm();
    panel.style.display='flex';
    panel.setAttribute('aria-hidden','false');
    if(!isConnected())void connectionLifecycle.autoConnect();
  });
  open.addEventListener('keydown',event=>{
    if(event.key!=='Enter'&&event.key!==' ')return;
    event.preventDefault();
    open.click();
  });
  close.addEventListener('click',closePanel);

  const makeDraggable=windowEl=>{
    const bar=windowEl?.querySelector('.title-bar');
    if(!windowEl||!bar||bar.dataset.dragReady)return;
    bar.dataset.dragReady='1';
    let dragging=false,dx=0,dy=0;
    bar.addEventListener('pointerdown',event=>{
      if(event.button!==0||event.target.closest('button'))return;
      const rect=windowEl.getBoundingClientRect();
      windowEl.style.position='fixed';
      windowEl.style.transform='none';
      windowEl.style.left=rect.left+'px';
      windowEl.style.top=rect.top+'px';
      dx=event.clientX-rect.left;
      dy=event.clientY-rect.top;
      dragging=true;
      closeProperties();
      bar.setPointerCapture?.(event.pointerId);
    });
    bar.addEventListener('pointermove',event=>{
      if(!dragging)return;
      const maxX=Math.max(0,window.innerWidth-windowEl.offsetWidth);
      const maxY=Math.max(0,window.innerHeight-windowEl.offsetHeight);
      windowEl.style.left=Math.min(maxX,Math.max(0,event.clientX-dx))+'px';
      windowEl.style.top=Math.min(maxY,Math.max(0,event.clientY-dy))+'px';
    });
    const stop=event=>{
      if(!dragging)return;
      dragging=false;
      if(bar.hasPointerCapture?.(event.pointerId))bar.releasePointerCapture(event.pointerId);
    };
    bar.addEventListener('pointerup',stop);
    bar.addEventListener('pointercancel',stop);
  };
  makeDraggable(panel.querySelector('.ep133-browser-window'));

  onConnectionChange(state=>{
    renderConnection(state);
    if(state.connected&&!state.unsafe){
      void readDevice();
      if(projectReadOnlyController.getState().mode==='projects')void projectReadOnlyController.refresh();
    }
  });
  window.addEventListener('paste',event=>{
    if(panel.style.display==='none'||!synchronized||mutating)return;
    const files=getClipboardAudioFiles(event);
    const slot=memory.getSelected();
    if(files.length&&slot)void uploadFilesToSlot(slot,files).catch(error=>reportError('COULD NOT UPLOAD SAMPLE.',error));
  });

  document.addEventListener('pointerdown',event=>{
    if(properties&&!properties.hidden&&!properties.contains(event.target)&&!event.target.closest?.('.ep133-sample-row'))closeProperties();
  });
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||event.defaultPrevented)return;
    if(confirmDialog&&!confirmDialog.hidden){event.preventDefault();resolveConfirm(false);return;}
    if(properties&&!properties.hidden){event.preventDefault();closeProperties();return;}
    if(panel.style.display!=='none'){event.preventDefault();closePanel();}
  });

  renderConnection({connected:false});
}

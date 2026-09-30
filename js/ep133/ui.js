import{
  connectEp133,isConnected,isDeviceUnsafe,getDeviceSessionToken,onConnectionChange,onFileEvent,waitForFileEvent,onMidiActivity,
  listDirectory,getFile,getFileMetadata,getFileInfo,uploadSampleToSlot,withSampleUploadBatch,
  deleteFile,moveFile,setFileMetadata,startPlayback,stopPlayback,normalizeFileName,
  prepareSampleTransferMetadata,prepareSampleWritableMetadata,prepareSampleCreateMetadata,prepareSampleLocalMetadata,createTransferFileName
}from './index.js?v=20260930-5';
import{
  TE_SYSEX_FILE_CAPABILITY_READ,TE_SYSEX_FILE_CAPABILITY_WRITE,
  TE_SYSEX_FILE_CAPABILITY_DELETE,TE_SYSEX_FILE_CAPABILITY_MOVE,
  TE_SYSEX_FILE_CAPABILITY_PLAYBACK,TE_SYSEX_FILE_FILE_TYPE_FILE,
  TE_SYSEX_FILE_EVENT_METADATA_UPDATED,TE_SYSEX_FILE_EVENT_FILE_ADDED,
  TE_SYSEX_FILE_EVENT_FILE_UPDATED,TE_SYSEX_FILE_EVENT_FILE_DELETED,
  TE_SYSEX_FILE_EVENT_FILE_MOVED
}from './constants.js';
import{
  createSampleMemory,planSampleTransferTargets
}from './sampleMemory.js?v=20260930-5';
import{getEpDeviceProfile}from './deviceProfile.js?v=20260930-5';
import{createSamplePropertiesController}from './ui/samplePropertiesController.js?v=20260930-5';
import{createSampleStore}from './sampleStore.js?v=20260930-5';
import{createSessionGuard}from './ui/sessionGuard.js?v=20260930-5';
import{createFeedbackController}from './ui/feedback.js?v=20260930-5';
import{getSoundsParentId,buildFileItemFromInfo,soundSlotIds}from './ui/fileModel.js?v=20260930-5';
import{createFileEventController}from './ui/fileEvents.js?v=20260930-5';
import{createConnectionLifecycle}from './ui/connectionLifecycle.js?v=20260930-5';
import{createSampleLibrarySyncController}from './ui/sampleLibrarySync.js?v=20260930-5';
import{createSampleReadController}from './ui/sampleReadController.js?v=20260930-5';
import{createSampleDeleteController}from './ui/sampleDeleteController.js?v=20260930-5';
import{createSampleUploadController}from './ui/sampleUploadController.js?v=20260930-5';
import{createSampleMoveController}from './ui/sampleMoveController.js?v=20260930-5';
import{createSampleCopyController}from './ui/sampleCopyController.js?v=20260930-5';
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
  const deviceHead=document.getElementById('ep133-device-head');
  const deviceName=document.getElementById('ep133-device');
  const connectionOverlay=document.getElementById('ep133-connection-overlay');
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
  if(!open||!panel||!close||!list||!tabs||!search)return;

  const setStatus=text=>{
    const el=document.getElementById('ep133-status');
    if(el)el.textContent=String(text||'');
  };
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

  let synchronized=false;
  let metadataHydrating=false;
  let mutating=false;
  let deviceUnsafe=false;
  let everConnected=false;
  let activeDeviceProfile=getEpDeviceProfile();
  let lastDeviceInfo={title:'MY EP',name:''};
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
  const syncMetadataAfterMutation=async(nodeId,eventPromise)=>{
    const event=await eventPromise;
    const metadata=event?.data?.metadata||await getFileMetadata(nodeId);
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

  const modelInfo=state=>{
    const profile=getEpDeviceProfile(state?.device?.sku);
    return{title:profile.title,name:profile.name};
  };
  const setTitleDevice=state=>{
    if(state?.connected){
      activeDeviceProfile=getEpDeviceProfile(state?.device?.sku);
      lastDeviceInfo={title:activeDeviceProfile.title,name:activeDeviceProfile.name};
    }
    const info=state?.connected?lastDeviceInfo:(everConnected?lastDeviceInfo:modelInfo(state));
    if(title)title.textContent=info.title;
    if(deviceName)deviceName.textContent=info.name;
  };
  const setConnectionOverlay=text=>{
    if(!deviceHead||!connectionOverlay)return;
    const disconnected=!!text;
    deviceHead.classList.toggle('disconnected',disconnected);
    connectionOverlay.textContent=text||'';
  };

  const formatMb=value=>{
    const mb=Number(value)/1e6;
    if(!Number.isFinite(mb)||mb<0)return'—';
    const fixed=mb.toFixed(1);
    return fixed.endsWith('.0')?fixed.slice(0,-2):fixed;
  };
  const renderDeviceStats=(metadata={},sampleCount=0)=>{
    const maxCapacity=Number(metadata?.max_capacity)||0;
    const freeSpace=Number(metadata?.free_space_in_bytes);
    const used=maxCapacity>0&&Number.isFinite(freeSpace)?Math.max(0,maxCapacity-freeSpace):NaN;
    const stats=document.getElementById('ep133-memory-stats');
    const meter=document.getElementById('ep133-memory-meter-fill');
    const count=document.getElementById('ep133-sample-count');
    if(stats)stats.textContent=maxCapacity>0&&Number.isFinite(used)
      ?formatMb(used)+' / '+formatMb(maxCapacity)+' MB'
      :'—';
    if(meter){
      const ratio=maxCapacity>0&&Number.isFinite(used)?Math.max(0,Math.min(1,used/maxCapacity)):0;
      meter.style.width=(ratio*100).toFixed(1)+'%';
    }
    if(count)count.textContent=String(Math.max(0,Number(sampleCount)||0));
  };

  const{setGlobalProgress,hideGlobalProgress,confirmAction,resolveConfirm}=createFeedbackController({
    globalProgress,globalProgressLabel,globalProgressFill,globalProgressText,
    confirmDialog,confirmMessage,confirmOk,confirmCancel
  });

  const fileItemFromInfo=info=>buildFileItemFromInfo(info,sampleStore.getFiles());
  const replaceSoundFiles=files=>{
    const sounds=Array.isArray(files)?files:[];
    sampleStore.replaceFiles([
      ...sampleStore.getFiles().filter(item=>!/^\/sounds\/[^/]+$/.test(item?.fileName||'')),
      ...sounds
    ]);
    return sounds;
  };
  const readAuthoritativeFiles=async()=>{
    const soundsParentId=sampleStore.getSoundsParentId();
    if(!soundsParentId)return[];
    return replaceSoundFiles(await listDirectory(soundsParentId,'/sounds'));
  };
  const assertSlotsEmpty=async ids=>{
    const requested=[...new Set((ids||[]).map(Number))];
    const files=await readAuthoritativeFiles();
    const occupied=soundSlotIds(files);
    const collisions=requested.filter(id=>occupied.has(id));
    if(collisions.length)throw new Error('Target sample slot changed on the device: '+collisions.map(id=>String(id).padStart(3,'0')).join(', ')+'. Reload before retrying.');
    return files;
  };
  const assertSlotsDeleted=async ids=>{
    const requested=[...new Set((ids||[]).map(Number))];
    const files=await readAuthoritativeFiles();
    const occupied=soundSlotIds(files);
    const remaining=requested.filter(id=>occupied.has(id));
    if(remaining.length)throw new Error('EP-series delete was not confirmed by /sounds LIST for slot(s): '+remaining.map(id=>String(id).padStart(3,'0')).join(', '));
    return files;
  };
  const verifyPcmReadback=async(fileId,expected,onProgress)=>{
    const readback=await getFile(fileId,onProgress);
    const actual=readback?.data instanceof Uint8Array?readback.data:new Uint8Array(readback?.data||[]);
    if(actual.byteLength!==expected.byteLength)throw new Error('PCM readback size mismatch for slot '+String(fileId).padStart(3,'0')+'.');
    for(let i=0;i<actual.byteLength;i++){
      if(actual[i]!==expected[i])throw new Error('PCM readback mismatch for slot '+String(fileId).padStart(3,'0')+' at byte '+i+'.');
    }
    return readback;
  };
  const assertMetadataReadback=(slotId,expected,actual)=>{
    const expectedCreate=prepareSampleCreateMetadata(expected);
    const expectedWritable=prepareSampleWritableMetadata(expected,{
      allowedPlayModes:activeDeviceProfile.playModes,
      allowAdvancedMetadata:activeDeviceProfile.advancedSampleMetadataWrites
    });
    const fields={...expectedCreate,...expectedWritable};
    for(const[key,value]of Object.entries(fields)){
      if(key==='crc')continue;
      const got=actual?.[key];
      const numeric=typeof value==='number';
      const matches=numeric?Number(got)===Number(value):String(got)===String(value);
      if(!matches)throw new Error('Metadata readback mismatch for slot '+String(slotId).padStart(3,'0')+' field '+key+'.');
    }
  };
  const assertSourceSnapshot=async(slot,snapshot)=>{
    await verifyPcmReadback(slot.nodeId||slot.id,snapshot.bytes);
    const currentMetadata=await getFileMetadata(slot.nodeId||slot.id);
    if(snapshot.metadata?.crc!=null&&Number(currentMetadata?.crc)!==Number(snapshot.metadata.crc))
      throw new Error('Source sample changed before MOVE delete: CRC mismatch in slot '+String(slot.id).padStart(3,'0')+'.');
    assertMetadataReadback(slot.id,snapshot.metadata,currentMetadata);
  };
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
    setFileMetadata,getFileMetadata,
    showError:message=>showError?.(message),
    logTechnical,escapeHtml
  });
  const closeProperties=()=>propertiesController.close();
  const openProperties=(slot,event)=>propertiesController.open(slot,event);

  let memory;
  const sampleReadController=createSampleReadController({
    sampleStore,getMemory:()=>memory,
    isConnected,
    startPlayback,stopPlayback,
    getFile,getFileMetadata,
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
    confirmAction,captureBatchSession,assertBatchSession,getDeviceSessionToken,
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
    getFileInfo,
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
  const refreshSoundsRuntimeMetadata=async()=>{
    const soundsParentId=sampleStore.getSoundsParentId();
    if(!soundsParentId)return sampleStore.getSoundsMetadata();
    const latest=await getFileMetadata(soundsParentId);
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
    withSampleUploadBatch,assertSlotsEmpty,refreshSoundsRuntimeMetadata,
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
    captureBatchSession,assertBatchSession,getDeviceSessionToken,
    isConnected,setMutating,setGlobalProgress,hideGlobalProgress,
    suppressNativeMoveEvent,clearNativeMoveSuppression,
    moveFile,
    readDevice:()=>readDevice(),
    logTechnical
  });
  const nativeMoveTransfer=(plan,sourceById)=>
    sampleMoveController.nativeMoveTransfer(plan,sourceById);

  const sampleCopyController=createSampleCopyController({
    sampleStore,
    getSoundsParentId:()=>sampleStore.getSoundsParentId(),
    getSoundsMetadata:()=>sampleStore.getSoundsMetadata(),
    getActiveDeviceProfile:()=>activeDeviceProfile,
    isConnected,captureBatchSession,assertBatchSession,getDeviceSessionToken,
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
  const copyTransfer=(plan,sourceById,sources)=>
    sampleCopyController.copyTransfer(plan,sourceById,sources);

  const transactionalTransfer=async(sources,dropSlot,{copy=false,draggedId}={})=>{
    if(!isConnected())throw new Error('EP device is disconnected.');
    if(!synchronized||!sampleStore.getSoundsParentId())throw new Error('Sample library is still synchronizing.');
    if(!activeDeviceProfile.sampleTransfers)
      throw new Error('MOVE/COPY SAMPLE METADATA IS NOT VERIFIED FOR '+(activeDeviceProfile.name||'THIS EP')+'.');
    if(propertiesController.hasPendingWrites())
      throw new Error('Wait for the pending sample property write to finish before moving or copying samples.');

    const sourceIds=sources.map(item=>item.id);
    const canonicalSources=sourceIds.map(id=>sampleStore.getSlot(id)).filter(slot=>slot?.file);
    const plan=planSampleTransferTargets(sampleStore.getSlots(),sourceIds,draggedId,dropSlot.id);
    if(plan.length!==sources.length||canonicalSources.length!==sources.length)
      throw new Error('No valid free destination slots are available.');

    const sourceById=new Map(canonicalSources.map(item=>[item.id,item]));
    if(!copy)return nativeMoveTransfer(plan,sourceById);
    return copyTransfer(plan,sourceById,canonicalSources);
  };

  memory=createSampleMemory({
    listEl:list,
    tabsEl:tabs,
    searchEl:search,
    searchClearEl:searchClear,
    onSelect:slot=>{
      closeProperties();
      setStatus(slot?'SLOT '+String(slot.id).padStart(3,'0')+' SELECTED':'');
    },
    onPlay:auditionSample,
    onDelete:deleteSamples,
    onRename:async(slot,value)=>{
      if(!isConnected()||!synchronized)throw new Error('Sample library is not ready.');
      const canonical=sampleStore.getSlot(slot?.id);
      if(!canonical?.file)throw new Error('This sample is no longer available.');
      if(canonical.node?.isWritable!==true)throw new Error('This sample is not writable.');
      const name=normalizeFileName(value);
      if(!name)return null;
      await setFileMetadata(canonical.nodeId||canonical.id,{name});
      const readback=await getFileMetadata(canonical.nodeId||canonical.id);
      sampleStore.setMetadata(canonical.id,readback,{verification:'verified'});
      return String(readback?.name||name);
    },
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
    listDirectory,getFileMetadata,
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
    setTitleDevice(state);
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
      everConnected=true;
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
    setConnectionOverlay(everConnected?'DEVICE DISCONNECTED':'CONNECT EP SERIES');
    if(!everConnected)renderDeviceStats({},0);
    sampleStore.clear();
    setStatus(everConnected?'DEVICE DISCONNECTED':'CONNECT EP SERIES');
  };

  const activityTimers={tx:null,rx:null};
  onMidiActivity(({direction})=>{
    const element=direction==='tx'?txIndicator:direction==='rx'?rxIndicator:null;
    if(!element)return;
    element.classList.add('active');
    clearTimeout(activityTimers[direction]);
    activityTimers[direction]=setTimeout(()=>element.classList.remove('active'),direction==='rx'?275:250);
  });

  const connectionLifecycle=createConnectionLifecycle({
    connectEp133,
    isConnected,
    isUnsafe:()=>deviceUnsafe,
    setConnectionOverlay,
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
    if(state.connected&&!state.unsafe)void readDevice();
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

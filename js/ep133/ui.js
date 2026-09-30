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
import{prepareEp133Sample}from './audio.js?v=20260930-5';
import{
  createSampleSlots,createSampleMemory,
  planSampleTransferTargets
}from './sampleMemory.js?v=20260930-5';
import{getEpDeviceProfile}from './deviceProfile.js?v=20260930-5';
import{createSamplePropertiesController}from './ui/samplePropertiesController.js?v=20260930-5';
import{createSampleMetadataCache}from './sampleMetadataCache.js?v=20260930-5';
import{createSessionGuard}from './ui/sessionGuard.js?v=20260930-5';
import{createFeedbackController}from './ui/feedback.js?v=20260930-5';
import{getSoundsParentId,buildFileItemFromInfo,buildProvisionalUploadedFileItem,soundSlotIds}from './ui/fileModel.js?v=20260930-5';
import{createFileEventController}from './ui/fileEvents.js?v=20260930-5';
import{createConnectionLifecycle}from './ui/connectionLifecycle.js?v=20260930-5';
import{createSampleLibrarySyncController}from './ui/sampleLibrarySync.js?v=20260930-5';
import{createSampleReadController}from './ui/sampleReadController.js?v=20260930-5';
import{createSampleDeleteController}from './ui/sampleDeleteController.js?v=20260930-5';
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

  let soundsParentId=0;
  let soundFormats=[];
  let soundsMetadata={};
  let deviceFiles=[];
  let synchronized=false;
  let metadataHydrating=false;
  let mutating=false;
  let deviceUnsafe=false;
  let everConnected=false;
  let activeDeviceProfile=getEpDeviceProfile();
  let lastDeviceInfo={title:'MY EP',name:''};
  let propertiesController=null;
  const sampleMetadataCache=createSampleMetadataCache();
  const{captureBatchSession,assertBatchSession}=createSessionGuard(getDeviceSessionToken);
  const waitForMetadataUpdate=nodeId=>waitForFileEvent(
    event=>event?.type===TE_SYSEX_FILE_EVENT_METADATA_UPDATED&&Number(event?.data?.nodeId)===Number(nodeId),
    {timeout:500}
  );
  const applySoundsMetadata=metadata=>{
    soundsMetadata={...soundsMetadata,...(metadata||{})};
    if(Array.isArray(soundsMetadata?.formats))soundFormats=soundsMetadata.formats;
    if(Array.isArray(metadata?.tabs)&&metadata.tabs.length)memory?.setTabs?.(metadata.tabs);
    renderDeviceStats(soundsMetadata,memory?.countOccupied?.()||0);
    return soundsMetadata;
  };
  const syncMetadataAfterMutation=async(nodeId,eventPromise)=>{
    const event=await eventPromise;
    const metadata=event?.data?.metadata||await getFileMetadata(nodeId);
    if(Number(nodeId)===Number(soundsParentId))return applySoundsMetadata(metadata);
    if(Number(nodeId)>=1&&Number(nodeId)<=999){
      memory.setMetadata(Number(nodeId),metadata||{});
      sampleMetadataCache.set(memory.getSlot(Number(nodeId)),metadata||{});
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

  const fileItemFromInfo=info=>buildFileItemFromInfo(info,deviceFiles);
  const provisionalUploadedFileItem=args=>buildProvisionalUploadedFileItem(args,{deviceFiles,normalizeFileName});
  const updateDeviceFile=item=>{
    if(!item)return;
    const index=deviceFiles.findIndex(file=>Number(file.nodeId)===Number(item.nodeId));
    if(index>=0)deviceFiles[index]=item;
    else deviceFiles.push(item);
  };
  const hydrateUploadedFileItem=async nodeId=>{
    try{
      const info=await getFileInfo(nodeId);
      const item=fileItemFromInfo(info);
      if(!item)return;
      updateDeviceFile(item);
      memory.setSlot(item);
      const metadata=await getFileMetadata(nodeId);
      memory.setMetadata(nodeId,metadata||{});
      sampleMetadataCache.set(memory.getSlot(nodeId),metadata||{});
      renderDeviceStats(soundsMetadata,memory.countOccupied());
    }catch(error){logTechnical('UPLOAD HYDRATE SLOT '+nodeId,error);}
  };
  const replaceSoundFiles=files=>{
    const sounds=Array.isArray(files)?files:[];
    deviceFiles=[
      ...deviceFiles.filter(item=>!/^\/sounds\/[^/]+$/.test(item?.fileName||'')),
      ...sounds
    ];
    return sounds;
  };
  const readAuthoritativeFiles=async()=>{
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
    getMemory:()=>memory,
    getActiveDeviceProfile:()=>activeDeviceProfile,
    isConnected,
    isSynchronized:()=>synchronized,
    isMetadataHydrating:()=>metadataHydrating,
    isMutating:()=>mutating,
    setFileMetadata,getFileMetadata,sampleMetadataCache,
    showError:message=>showError?.(message),
    logTechnical,escapeHtml
  });
  const closeProperties=()=>propertiesController.close();
  const openProperties=(slot,event)=>propertiesController.open(slot,event);

  let memory;
  const sampleReadController=createSampleReadController({
    getMemory:()=>memory,
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
    getMemory:()=>memory,
    getSoundsParentId:()=>soundsParentId,
    getSoundsMetadata:()=>soundsMetadata,
    isConnected,
    isSynchronized:()=>synchronized,
    hasPendingPropertyWrites:()=>propertiesController.hasPendingWrites(),
    confirmAction,captureBatchSession,assertBatchSession,getDeviceSessionToken,
    setMutating,setGlobalProgress,hideGlobalProgress,
    getFileInfo,getFileMetadata,deleteFile,
    waitForMetadataUpdate,syncMetadataAfterMutation,
    assertSlotsDeleted,
    removeDeviceFile:nodeId=>{
      deviceFiles=deviceFiles.filter(item=>Number(item.nodeId)!==Number(nodeId));
    },
    renderDeviceStats,
    readDevice:()=>readDevice(),
    logTechnical
  });
  const deleteSamples=targets=>sampleDeleteController.deleteSamples(targets);
  const fileEventController=createFileEventController({
    isConnected,
    getMemory:()=>memory,
    sampleMetadataCache,
    getSoundsParentId:()=>soundsParentId,
    getSoundsMetadata:()=>soundsMetadata,
    getDeviceFiles:()=>deviceFiles,
    setDeviceFiles:files=>{deviceFiles=files;},
    getCurrentPropertySlotId:()=>propertiesController.getCurrentSlotId(),
    getFileInfo,
    getFileMetadata,
    fileItemFromInfo,
    updateDeviceFile,
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
    if(!soundsParentId)return soundsMetadata;
    const latest=await getFileMetadata(soundsParentId);
    if(latest&&typeof latest==='object')soundsMetadata={...soundsMetadata,...latest};
    if(Array.isArray(soundsMetadata?.formats))soundFormats=soundsMetadata.formats;
    if(Array.isArray(soundsMetadata?.tabs)&&soundsMetadata.tabs.length)memory?.setTabs(soundsMetadata.tabs);
    renderDeviceStats(soundsMetadata,memory?.countOccupied?.()||0);
    return soundsMetadata;
  };
  const assertSampleFitsAvailableMemory=async byteLength=>{
    const latest=await refreshSoundsRuntimeMetadata();
    const freeSpace=Number(latest?.free_space_in_bytes);
    if(Number.isFinite(freeSpace)&&freeSpace>=0&&Number(byteLength)>freeSpace)
      throw new Error('Not enough free sample memory on the connected EP.');
  };
  const applyNativeMoveLocally=(source,target,moved)=>{
    const oldId=Number(moved.oldFileId),newId=Number(moved.newFileId);
    const oldMeta=moved.metadata||source.meta||memory.getSlot(oldId)?.meta||null;
    const item=fileItemFromInfo(moved.info);
    if(!item||Number(item.nodeId)!==newId)throw new Error('The native FILE_MOVE destination could not be resolved.');
    deviceFiles=deviceFiles.filter(file=>Number(file.nodeId)!==oldId&&Number(file.nodeId)!==newId);
    deviceFiles.push(item);
    sampleMetadataCache.invalidate(oldId);
    sampleMetadataCache.invalidate(newId);
    if(oldId!==newId)memory.clearSlot(oldId);
    memory.setSlot(item);
    if(oldMeta){
      memory.setMetadata(newId,oldMeta);
      sampleMetadataCache.set(memory.getSlot(newId),oldMeta);
    }
    propertiesController.remapCurrentSlot(oldId,newId);
    renderDeviceStats(soundsMetadata,memory.countOccupied());
  };

  const nativeMoveTransfer=async(plan,sourceById)=>{
    const completed=[];
    const sessionToken=captureBatchSession();
    setMutating(true);
    try{
      for(let index=0;index<plan.length;index++){
        assertBatchSession(sessionToken);
        const pair=plan[index];
        const source=sourceById.get(pair.sourceId);
        const target=memory.getSlot(pair.targetId);
        if(!source||!target)throw new Error('Invalid native MOVE plan.');
        if(target.file)throw new Error('Target sample slot is no longer empty.');
        const sourceNodeId=Number(source.nodeId||source.id);
        memory.setOperation(target.id,{status:'moving',label:'MOVING',progress:0});
        setGlobalProgress('MOVE',(index/plan.length)*100);
        const releaseSuppression=suppressNativeMoveEvent(sourceNodeId,target.id);
        let moved;
        try{
          moved=await moveFile(sourceNodeId,soundsParentId,target.id,{verifyCrc:true});
        }catch(error){
          clearNativeMoveSuppression(sourceNodeId,target.id);
          throw error;
        }
        releaseSuppression();
        completed.push({sourceId:source.id,targetId:target.id,source,crc:moved.sourceCrc});
        if(moved.crcVerified!==true)
          throw new Error('Native FILE_MOVE CRC verification failed for slot '+source.id+' -> '+target.id+'.');
        applyNativeMoveLocally(source,target,moved);
        memory.setOperation(target.id,{status:'complete',label:'MOVED',progress:100});
        setGlobalProgress('MOVE',((index+1)/plan.length)*100);
      }
      for(const pair of plan)memory.clearOperation(pair.targetId);
      setGlobalProgress('MOVE',100);
      return{targetIds:plan.map(pair=>pair.targetId)};
    }catch(error){
      if(completed.length&&isConnected()&&getDeviceSessionToken()===sessionToken){
        for(const pair of [...completed].reverse()){
          try{
            assertBatchSession(sessionToken);
            const releaseSuppression=suppressNativeMoveEvent(pair.targetId,pair.sourceId);
            const restored=await moveFile(pair.targetId,soundsParentId,pair.sourceId,{verifyCrc:true});
            releaseSuppression();
            if(restored.crcVerified!==true||Number(restored.destinationCrc)!==Number(pair.crc))
              throw new Error('Rollback CRC verification failed.');
          }catch(rollbackError){
            clearNativeMoveSuppression(pair.targetId,pair.sourceId);
            logTechnical('NATIVE MOVE ROLLBACK '+pair.targetId+'->'+pair.sourceId,rollbackError);
          }
        }
        try{await readDevice();}
        catch(syncError){logTechnical('RESYNC AFTER NATIVE MOVE ERROR',syncError);}
      }
      memory.clearOperations();
      throw error;
    }finally{
      hideGlobalProgress();
      setMutating(false);
    }
  };

  const transactionalTransfer=async(sources,dropSlot,{copy=false,draggedId}={})=>{
    if(!isConnected())throw new Error('EP device is disconnected.');
    if(!synchronized||!soundsParentId)throw new Error('Sample library is still synchronizing.');
    if(!activeDeviceProfile.sampleTransfers)
      throw new Error('MOVE/COPY SAMPLE METADATA IS NOT VERIFIED FOR '+(activeDeviceProfile.name||'THIS EP')+'.');
    if(propertiesController.hasPendingWrites())throw new Error('Wait for the pending sample property write to finish before moving or copying samples.');
    const sourceIds=sources.map(item=>item.id);
    const plan=planSampleTransferTargets(memory.getSlots(),sourceIds,draggedId,dropSlot.id);
    if(plan.length!==sources.length)throw new Error('No valid free destination slots are available.');
    const sourceById=new Map(sources.map(item=>[item.id,item]));
    if(!copy)return nativeMoveTransfer(plan,sourceById);
    const sessionToken=captureBatchSession();
    if(sources.some(item=>item.node?.isReadable!==true))throw new Error('One or more source samples cannot be read.');
    const created=[];
    setMutating(true);
    try{
      await assertSlotsEmpty(plan.map(pair=>pair.targetId));
      for(let index=0;index<plan.length;index++){
        assertBatchSession(sessionToken);
        const pair=plan[index];
        const source=sourceById.get(pair.sourceId);
        const target=memory.getSlot(pair.targetId);
        if(!source||!target)throw new Error('Invalid transfer plan.');
        const operationLabel='COPYING';
        memory.setOperation(target.id,{status:'uploading',label:operationLabel,progress:0});
        const downloaded=await getFile(source.nodeId||source.id,(done,total)=>{
          const local=total?done/total:0;
          setGlobalProgress('COPY',((index+local*.35)/plan.length)*100);
        });
        assertBatchSession(sessionToken);
        const bytes=downloaded?.data instanceof Uint8Array?downloaded.data:new Uint8Array(downloaded?.data||[]);
        if(!bytes.byteLength)throw new Error('The device returned an empty sample.');
        const sourceMetadata=await getFileMetadata(source.nodeId||source.id);
        assertBatchSession(sessionToken);
        const metadata=prepareSampleTransferMetadata(sourceMetadata,{
          allowedPlayModes:activeDeviceProfile.playModes
        });
        const displayName=metadata?.name||downloaded?.name||source.file?.name||'sample';
        const transferName=createTransferFileName(source.id,target.id);
        const expectedMetadata={...metadata,name:displayName};
        await assertSampleFitsAvailableMemory(bytes.byteLength);
        await assertSlotsEmpty([target.id]);
        const metadataUpdate=waitForMetadataUpdate(soundsParentId);
        const fileId=await uploadSampleToSlot({
          data:bytes,
          filename:transferName,
          parentId:soundsParentId,
          destinationId:target.id,
          metadata:expectedMetadata,
          allowedPlayModes:activeDeviceProfile.playModes,
          allowAdvancedMetadata:activeDeviceProfile.advancedSampleMetadataWrites,
          barWriteMode:'preserve',
          onCreated:id=>{const createdId=Number(id)||target.id;if(!created.includes(createdId))created.push(createdId);},
          onProgress:(done,total)=>{
            const local=total?done/total:0;
            const rowProgress=Math.round(local*100);
            memory.setOperation(target.id,{status:'uploading',label:operationLabel,progress:rowProgress});
            setGlobalProgress('COPY',((index+.35+local*.55)/plan.length)*100);
          }
        });
        assertBatchSession(sessionToken);
        await syncMetadataAfterMutation(soundsParentId,metadataUpdate);
        if(Number(fileId)!==Number(target.id))throw new Error('The device wrote a sample to an unexpected slot.');
        const info=await getFileInfo(fileId);
        const item=fileItemFromInfo(info);
        if(!item||Number(item.nodeId)!==Number(target.id))throw new Error('The destination slot could not be verified.');
        updateDeviceFile(item);
        memory.setSlot(item);
        const localMetadata=prepareSampleLocalMetadata(expectedMetadata,{
          allowedPlayModes:activeDeviceProfile.playModes,
          allowAdvancedMetadata:activeDeviceProfile.advancedSampleMetadataWrites,
          barWriteMode:'preserve'
        });
        memory.setMetadata(target.id,localMetadata);
        sampleMetadataCache.set(memory.getSlot(target.id),localMetadata);
        memory.setOperation(target.id,{status:'complete',label:'COPIED',progress:100});
        setGlobalProgress('COPY',((index+.95)/plan.length)*100);
      }

      renderDeviceStats(soundsMetadata,memory.countOccupied());
      for(const id of created)memory.clearOperation(id);
      setGlobalProgress('COPY',100);
      return{targetIds:plan.map(pair=>pair.targetId)};
    }catch(error){
      if(isConnected()){
        for(const id of [...created].reverse()){
          try{
            assertBatchSession(sessionToken);
            const rollbackMetadataUpdate=waitForMetadataUpdate(soundsParentId);
            await deleteFile(id);
            await syncMetadataAfterMutation(soundsParentId,rollbackMetadataUpdate);
          }
          catch(rollbackError){logTechnical('TRANSFER ROLLBACK SLOT '+id,rollbackError);}
          memory.clearSlot(id);
          deviceFiles=deviceFiles.filter(item=>Number(item.nodeId)!==Number(id));
        }
      }
      memory.clearOperations();
      if(isConnected()&&getDeviceSessionToken()===sessionToken){
        try{await readDevice();}
        catch(syncError){logTechnical('RESYNC AFTER TRANSFER ERROR',syncError);}
      }
      throw error;
    }finally{
      hideGlobalProgress();
      setMutating(false);
    }
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
      if(slot.node?.isWritable!==true)throw new Error('This sample is not writable.');
      const name=normalizeFileName(value);
      if(!name)return null;
      await setFileMetadata(slot.nodeId||slot.id,{name});
      const readback=await getFileMetadata(slot.nodeId||slot.id);
      memory.setMetadata(slot.id,readback);
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
  updateMutationAvailability();

  async function uploadFilesToSlot(slot,files){
    if(!isConnected())throw new Error('EP device is disconnected.');
    if(!synchronized||!soundsParentId)throw new Error('Sample library is still synchronizing.');
    if(!slot||!files?.length)return;
    const audioFiles=Array.from(files).filter(file=>file&&(/\.(wav|mp3|aac|ogg|flac|m4a|aif|aiff)$/i.test(file.name)||String(file.type||'').startsWith('audio/')));
    if(!audioFiles.length)throw new Error('No supported audio files were found.');

    const targets=[];
    let searchFrom=slot.id;
    for(const file of audioFiles){
      const destinationId=memory.findNextFree(searchFrom);
      if(destinationId===-1)break;
      targets.push({file,slot:memory.getSlot(destinationId)});
      searchFrom=destinationId+1;
    }
    if(targets.length<audioFiles.length)throw new Error('Not enough free sample slots above the drop position.');

    const sessionToken=captureBatchSession();
    setMutating(true);
    const successes=[];
    const failures=[];
    try{
      await withSampleUploadBatch(async()=>{
        await assertSlotsEmpty(targets.map(item=>item.slot.id));
        let remainingFreeSpace=Number(soundsMetadata?.free_space_in_bytes);
        if(!Number.isFinite(remainingFreeSpace)||remainingFreeSpace<0){
          const latestSounds=await refreshSoundsRuntimeMetadata();
          remainingFreeSpace=Number(latestSounds?.free_space_in_bytes);
        }
        if(!Number.isFinite(remainingFreeSpace)||remainingFreeSpace<0)remainingFreeSpace=null;

        for(let index=0;index<targets.length;index++){
          assertBatchSession(sessionToken);
          const item=targets[index];
          const target=item.slot;
          try{
            memory.setOperation(target.id,{status:'preparing',label:'PREPARING',progress:0});
            const prepared=await prepareEp133Sample(item.file,{
              formats:soundFormats,
              onProgress:(value,info)=>{
                const progress=Math.max(0,Math.min(100,Number(value)||0));
                const phase=String(info?.status||'preparing').toUpperCase();
                memory.setOperation(target.id,{status:String(info?.status||'preparing'),label:phase,progress});
                setGlobalProgress('UPLOAD',((index+(progress/100)*.35)/targets.length)*100);
              }
            });
            assertBatchSession(sessionToken);
            const metadata={
              channels:prepared.channels,
              samplerate:prepared.samplerate,
              format:prepared.format,
              ...(prepared.metadata||{})
            };
            if(remainingFreeSpace!=null&&prepared.data.byteLength>remainingFreeSpace)
              throw new Error('Not enough free sample memory on the connected EP.');

            memory.setOperation(target.id,{status:'uploading',label:'UPLOADING',progress:0});
            let createdId=null;
            markUploadPending(target.id);
            const fileId=await uploadSampleToSlot({
              file:item.file,
              data:prepared.data,
              filename:item.file.name,
              parentId:soundsParentId,
              destinationId:target.id,
              metadata,
              allowedPlayModes:activeDeviceProfile.playModes,
              allowAdvancedMetadata:activeDeviceProfile.advancedSampleMetadataWrites,
              barWriteMode:'omit',
              onCreated:id=>{createdId=Number(id)||target.id;item.createdId=createdId;},
              onProgress:(done,total)=>{
                const local=total?done/total:0;
                memory.setOperation(target.id,{status:'uploading',label:'UPLOADING',progress:local*100});
                setGlobalProgress('UPLOAD',((index+.35+local*.65)/targets.length)*100);
              }
            });
            assertBatchSession(sessionToken);
            if(Number(fileId)!==Number(target.id))
              throw new Error('The device wrote a sample to an unexpected slot.');

            const fileItem=provisionalUploadedFileItem({
              nodeId:fileId,
              parentId:soundsParentId,
              fileSize:prepared.data.byteLength,
              fileName:item.file.name
            });
            updateDeviceFile(fileItem);
            memory.setSlot(fileItem);

            const localMetadata=prepareSampleLocalMetadata({...metadata,name:normalizeFileName(item.file.name)},{
              allowedPlayModes:activeDeviceProfile.playModes,
              allowAdvancedMetadata:activeDeviceProfile.advancedSampleMetadataWrites,
              barWriteMode:'omit'
            });
            memory.setMetadata(target.id,localMetadata);
            sampleMetadataCache.set(memory.getSlot(target.id),localMetadata);

            if(remainingFreeSpace!=null){
              remainingFreeSpace=Math.max(0,remainingFreeSpace-prepared.data.byteLength);
              soundsMetadata={...soundsMetadata,free_space_in_bytes:remainingFreeSpace};
            }
            renderDeviceStats(soundsMetadata,memory.countOccupied());
            memory.setOperation(target.id,{status:'complete',label:'WRITTEN',progress:100});
            successes.push(target.id);
            setGlobalProgress('UPLOAD',((index+1)/targets.length)*100);
          }catch(error){
            clearUploadPending(target.id);
            failures.push({file:item.file,error});
            memory.setOperation(target.id,{status:'failed',label:'FAILED',progress:0});
            logTechnical('UPLOAD '+item.file.name,error);
            const createdId=Number(item.createdId)||0;
            if(createdId&&isConnected()&&!deviceUnsafe){
              try{
                const rollbackMetadataUpdate=waitForMetadataUpdate(soundsParentId);
                await deleteFile(createdId);
                await syncMetadataAfterMutation(soundsParentId,rollbackMetadataUpdate);
                await assertSlotsDeleted([createdId]);
                memory.clearSlot(createdId);
              }catch(rollbackError){
                logTechnical('UPLOAD ROLLBACK SLOT '+createdId,rollbackError);
              }
            }
            if(deviceUnsafe)break;
          }
        }
      });

      renderDeviceStats(soundsMetadata,memory.countOccupied());
      if(successes.length){
        memory.selectSlots(successes,{activeId:successes[0],preview:false,navigate:true});
        setTimeout(()=>{
          for(const id of successes){
            const current=memory.getSlot(id)?.node;
            if(current?.isWritable||current?.isDeletable||current?.isMovable||current?.isPlayable)continue;
            void hydrateUploadedFileItem(id);
          }
        },250);
      }
      if(failures.length){
        const names=failures.map(item=>'• '+item.file.name).join('\n');
        showError?.('COULD NOT UPLOAD:\n'+names);
      }
      if(successes.length)void refreshSoundsRuntimeMetadata().catch(error=>logTechnical('UPLOAD FREE SPACE REFRESH',error));
    }finally{
      for(const item of targets)clearUploadPending(item.slot.id);
      setTimeout(()=>{for(const item of targets)memory.clearOperation(item.slot.id);},900);
      hideGlobalProgress();
      setMutating(false);
    }
  }

  const sampleLibrarySync=createSampleLibrarySyncController({
    captureBatchSession,assertBatchSession,
    getMemory:()=>memory,
    getActiveDeviceProfile:()=>activeDeviceProfile,
    sampleMetadataCache,
    listDirectory,getFileMetadata,
    setSynchronized:value=>{synchronized=!!value;},
    setMetadataHydrating:value=>{metadataHydrating=!!value;},
    setSoundsParentId:value=>{soundsParentId=Number(value)||0;},
    setSoundFormats:value=>{soundFormats=Array.isArray(value)?value:[];},
    setSoundsMetadata:value=>{soundsMetadata=value&&typeof value==='object'?value:{};},
    setDeviceFiles:value=>{deviceFiles=Array.isArray(value)?value:[];},
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
    if(!everConnected){
      renderDeviceStats({},0);
      memory.setSlots(createSampleSlots([]));
    }
    soundsParentId=0;
    soundFormats=[];
    soundsMetadata={};
    deviceFiles=[];
    sampleMetadataCache.clear();
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

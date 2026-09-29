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
import{prepareEp133Sample,createEp133Wav}from './audio.js?v=20260930-5';
import{
  createSampleSlots,createSampleMemory,
  planSampleTransferTargets
}from './sampleMemory.js?v=20260928-4';
import{getEpDeviceProfile}from './deviceProfile.js?v=20260930-5';
import{PROPERTY_DEBOUNCE_MS,renderSampleProperties,getSamplePropertyChange}from './sampleProperties.js?v=20260930-5';
import{createSampleMetadataCache,prioritizeMetadataSlots}from './sampleMetadataCache.js?v=20260930-5';
import{createSessionGuard}from './ui/sessionGuard.js?v=20260930-5';
import{createFeedbackController}from './ui/feedback.js?v=20260930-5';
import{getSoundsParentId,buildFileItemFromInfo,buildProvisionalUploadedFileItem,soundSlotIds}from './ui/fileModel.js?v=20260930-5';
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
  let playingSlotId=null;
  let previewTimer=null;
  let currentPropertySlotId=null;
  const propertyStates=new Map();
  const pendingPropertyKeys=new Set();
  const sampleMetadataCache=createSampleMetadataCache();
  const pendingNativeMoveEvents=new Set();
  const pendingUploadEvents=new Set();
  const nativeMoveEventKey=(oldNodeId,newNodeId)=>Number(oldNodeId)+':'+Number(newNodeId);
  const suppressNativeMoveEvent=(oldNodeId,newNodeId)=>{
    const key=nativeMoveEventKey(oldNodeId,newNodeId);
    pendingNativeMoveEvents.add(key);
    return()=>{
      setTimeout(()=>pendingNativeMoveEvents.delete(key),1000);
    };
  };
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
      if(currentPropertySlotId===Number(nodeId))renderProperties(memory.getSlot(currentPropertySlotId));
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
  const assertDeleteTargetUnchanged=async slot=>{
    const info=await getFileInfo(slot.nodeId||slot.id);
    if(Number(info.nodeId)!==Number(slot.id)||Number(info.parentId)!==Number(soundsParentId)||Number(info.fileSize)!==Number(slot.file?.size||0))
      throw new Error('Sample slot changed before delete; reload the library and confirm again.');
    const currentMetadata=await getFileMetadata(slot.nodeId||slot.id);
    if(slot.meta?.crc!=null&&Number(currentMetadata?.crc)!==Number(slot.meta.crc))
      throw new Error('Sample slot changed before delete; CRC no longer matches the selected sample.');
    if(slot.meta?.name!=null&&String(currentMetadata?.name)!==String(slot.meta.name))
      throw new Error('Sample slot changed before delete; name no longer matches the selected sample.');
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

  const fallbackDownload=(blob,name)=>{
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;
    anchor.download=name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1200);
  };
  const saveBlobAs=async(blob,name)=>{
    if(window.showSaveFilePicker){
      try{
        const handle=await window.showSaveFilePicker({
          suggestedName:name,
          types:[{description:'WAV audio',accept:{'audio/wav':['.wav']}}]
        });
        const writable=await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
      }catch(error){
        if(error?.name==='AbortError')return false;
        if(error?.name!=='NotAllowedError'&&error?.name!=='SecurityError')throw error;
      }
    }
    fallbackDownload(blob,name);
    return true;
  };
  const downloadName=(slot,result)=>{
    const raw=String(slot?.meta?.name||slot?.file?.name||result?.name||'sample')
      .replace(/\.[^.]+$/,'')
      .replace(/[\\/:*?"<>|]/g,'_')
      .trim()||'sample';
    return raw+'.wav';
  };
  const makeWav=async slot=>{
    const result=await getFile(slot.nodeId||slot.id);
    const bytes=result?.data instanceof Uint8Array?result.data:new Uint8Array(result?.data||[]);
    const meta=slot.meta||await getFileMetadata(slot.nodeId||slot.id);
    const wav=await createEp133Wav(bytes,{name:result?.name||slot.file?.name||'sample',metadata:meta});
    return{wav,result};
  };

  const closeProperties=()=>{
    if(properties)properties.hidden=true;
    currentPropertySlotId=null;
  };
  const propertyStateId=(slotId,key)=>String(slotId)+':'+key;
  const isPropertyPending=(slotId,key)=>pendingPropertyKeys.has(propertyStateId(slotId,key));

  const renderProperties=slot=>{
    if(!propertiesGrid||!slot?.file)return;
    propertiesGrid.innerHTML=renderSampleProperties(slot,{
      playModes:activeDeviceProfile.playModes,
      barPolicy:activeDeviceProfile.sampleBars,
      isPending:key=>isPropertyPending(slot.id,key),
      escapeHtml
    });
  };
  const positionProperties=event=>{
    if(!properties)return;
    properties.hidden=false;
    const gap=8;
    const rect=properties.getBoundingClientRect();
    let left=event.clientX+gap;
    let top=event.clientY+gap;
    if(left+rect.width>window.innerWidth-gap)left=event.clientX-rect.width-gap;
    if(top+rect.height>window.innerHeight-gap)top=window.innerHeight-rect.height-gap;
    properties.style.left=Math.max(gap,left)+'px';
    properties.style.top=Math.max(gap,top)+'px';
  };
  const openProperties=(slot,event)=>{
    if(!slot?.file||!isConnected()||!synchronized||metadataHydrating||mutating)return;
    if(!activeDeviceProfile.advancedSampleMetadataWrites){
      closeProperties();
      showError?.('SAMPLE PROPERTIES ARE NOT VERIFIED FOR '+(activeDeviceProfile.name||'THIS EP')+'.');
      return;
    }
    currentPropertySlotId=slot.id;
    renderProperties(slot);
    positionProperties(event);
  };

  const schedulePropertyWrite=(slot,key,value,extra={})=>{
    if(!slot?.file||!isConnected()||!synchronized||mutating||!activeDeviceProfile.advancedSampleMetadataWrites)return;
    const id=propertyStateId(slot.id,key);
    let state=propertyStates.get(id);
    if(!state){
      state={
        slotId:slot.id,key,
        committed:slot.meta?.[key],
        desired:value,
        extra:{...extra},
        timer:null,
        inFlight:false,
        version:0
      };
      propertyStates.set(id,state);
    }
    state.desired=value;
    state.extra={...extra};
    state.version+=1;
    clearTimeout(state.timer);
    pendingPropertyKeys.add(id);
    memory.mergeMetadata(slot.id,{[key]:value,...extra});
    const updated=memory.getSlot(slot.id);
    if(currentPropertySlotId===slot.id)renderProperties(updated);
    state.timer=setTimeout(()=>{void flushPropertyWrite(id);},PROPERTY_DEBOUNCE_MS);
  };

  const flushPropertyWrite=async id=>{
    const state=propertyStates.get(id);
    if(!state)return;
    if(state.inFlight){
      state.timer=setTimeout(()=>{void flushPropertyWrite(id);},PROPERTY_DEBOUNCE_MS);
      return;
    }
    const slot=memory.getSlot(state.slotId);
    if(!slot?.file||!isConnected()){
      pendingPropertyKeys.delete(id);
      propertyStates.delete(id);
      return;
    }
    state.inFlight=true;
    const version=state.version;
    const sentValue=state.desired;
    const sentExtra={...state.extra};
    try{
      const payload={[state.key]:sentValue,...sentExtra};
      if(state.key==='sound.playmode'){
        const release=Number(slot.meta?.['envelope.release']);
        payload['envelope.release']=Number.isFinite(release)?release:255;
      }
      await setFileMetadata(slot.nodeId||slot.id,payload);
      const readback=await getFileMetadata(slot.nodeId||slot.id);
      for(const[key,value]of Object.entries(payload)){
        const got=readback?.[key];
        const matches=typeof value==='number'?Number(got)===Number(value):String(got)===String(value);
        if(!matches)throw new Error('EP did not confirm sample property '+key+'.');
      }
      memory.setMetadata(slot.id,readback);
      sampleMetadataCache.set(memory.getSlot(slot.id),readback);
      state.committed=readback?.[state.key]??sentValue;
      if(state.version!==version){
        memory.mergeMetadata(slot.id,{[state.key]:state.desired,...state.extra});
        state.inFlight=false;
        clearTimeout(state.timer);
        state.timer=setTimeout(()=>{void flushPropertyWrite(id);},40);
        if(currentPropertySlotId===slot.id)renderProperties(memory.getSlot(slot.id));
        return;
      }
      pendingPropertyKeys.delete(id);
      propertyStates.delete(id);
    }catch(error){
      logTechnical('PROPERTY '+state.key,error);
      let restored=null;
      try{restored=await getFileMetadata(slot.nodeId||slot.id);}
      catch(readbackError){logTechnical('PROPERTY READBACK '+state.key,readbackError);}
      if(restored){
        memory.setMetadata(slot.id,restored);
        sampleMetadataCache.set(memory.getSlot(slot.id),restored);
      }else memory.mergeMetadata(slot.id,{[state.key]:state.committed});
      pendingPropertyKeys.delete(id);
      propertyStates.delete(id);
      showError?.('COULD NOT UPDATE SAMPLE PROPERTY.');
    }finally{
      const latest=propertyStates.get(id);
      if(latest)latest.inFlight=false;
      if(currentPropertySlotId===slot.id)renderProperties(memory.getSlot(slot.id));
    }
  };

  const changeProperty=(slot,key,direction)=>{
    if(!slot?.file||slot.node?.isWritable!==true||!activeDeviceProfile.advancedSampleMetadataWrites)return;
    if(key==='sound.bars'&&activeDeviceProfile.sampleBars?.authoring!==true)return;
    const change=getSamplePropertyChange(slot,key,direction,{playModes:activeDeviceProfile.playModes,barPolicy:activeDeviceProfile.sampleBars});
    if(change)schedulePropertyWrite(slot,key,change.value,change.extra);
  };

  propertiesGrid?.addEventListener('click',event=>{
    const button=event.target.closest('[data-property]');
    if(!button||!currentPropertySlotId)return;
    const slot=memory.getSlot(currentPropertySlotId);
    changeProperty(slot,button.dataset.property,Number(button.dataset.direction)||0);
  });
  propertiesGrid?.addEventListener('pointerdown',event=>{
    const value=event.target.closest('[data-drag="bpm"]');
    if(!value||!currentPropertySlotId)return;
    event.preventDefault();
    const slotId=currentPropertySlotId;
    const slot=memory.getSlot(slotId);
    const startY=event.clientY;
    const startValue=Number(slot?.meta?.['sound.bpm'])>0?Math.round(Number(slot.meta['sound.bpm'])):120;
    let lastValue=startValue;
    const move=moveEvent=>{
      const delta=Math.round((startY-moveEvent.clientY)/3);
      const next=Math.max(1,Math.min(200,startValue+delta));
      if(next===lastValue)return;
      lastValue=next;
      const current=memory.getSlot(slotId);
      if(current) schedulePropertyWrite(current,'sound.bpm',next);
    };
    const stop=()=>{
      document.removeEventListener('pointermove',move);
      document.removeEventListener('pointerup',stop);
      document.removeEventListener('pointercancel',stop);
    };
    document.addEventListener('pointermove',move);
    document.addEventListener('pointerup',stop,{once:true});
    document.addEventListener('pointercancel',stop,{once:true});
  });

  let memory;
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
  const stopCurrentPreview=async()=>{
    clearTimeout(previewTimer);
    previewTimer=null;
    const nodeId=playingSlotId;
    playingSlotId=null;
    memory?.setPreviewing?.(null);
    if(nodeId&&isConnected()){
      try{await stopPlayback(nodeId);}
      catch(error){console.warn('EP preview stop failed',error);}
    }
  };
  const auditionSample=async slot=>{
    if(!slot?.file||!isConnected())return;
    const nodeId=slot.nodeId||slot.id;
    try{
      if(playingSlotId)await stopCurrentPreview();
      await startPlayback(nodeId,true);
      playingSlotId=nodeId;
      memory.setPreviewing(slot.id);
      previewTimer=setTimeout(()=>{
        if(playingSlotId===nodeId){
          playingSlotId=null;
          memory.setPreviewing(null);
        }
      },1050);
    }catch(error){
      reportError('COULD NOT PREVIEW SAMPLE.',error);
    }
  };

  const performDownload=async(slot,{saveAs=false,index=0,total=1}={})=>{
    const base=(index/Math.max(1,total))*100;
    setGlobalProgress('DOWNLOAD',base);
    const result=await getFile(slot.nodeId||slot.id,(done,size)=>{
      const local=size?done/size:0;
      setGlobalProgress('DOWNLOAD',((index+local)/Math.max(1,total))*100);
    });
    const bytes=result?.data instanceof Uint8Array?result.data:new Uint8Array(result?.data||[]);
    const meta=slot.meta||await getFileMetadata(slot.nodeId||slot.id);
    const wav=await createEp133Wav(bytes,{name:result?.name||slot.file?.name||'sample',metadata:meta});
    const filename=downloadName(slot,result);
    if(saveAs)await saveBlobAs(wav,filename);
    else fallbackDownload(wav,filename);
    setGlobalProgress('DOWNLOAD',((index+1)/Math.max(1,total))*100);
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
    if(currentPropertySlotId===oldId&&oldId!==newId)currentPropertySlotId=newId;
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
          pendingNativeMoveEvents.delete(nativeMoveEventKey(sourceNodeId,target.id));
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
            pendingNativeMoveEvents.delete(nativeMoveEventKey(pair.targetId,pair.sourceId));
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
    if(pendingPropertyKeys.size)throw new Error('Wait for the pending sample property write to finish before moving or copying samples.');
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

  const deleteSamples=async targets=>{
    if(!targets?.length||!isConnected()||!synchronized)return false;
    if(pendingPropertyKeys.size)throw new Error('Wait for the pending sample property write to finish before deleting samples.');
    const message=targets.length>1
      ?'DELETE '+targets.length+' SELECTED SAMPLES?'
      :'DELETE "'+String(targets[0]?.meta?.name||targets[0]?.file?.name||'SAMPLE').toUpperCase()+'"?';
    if(!await confirmAction(message))return false;
    const sessionToken=captureBatchSession();
    setMutating(true);
    try{
      for(let index=0;index<targets.length;index++){
        assertBatchSession(sessionToken);
        const slot=targets[index];
        setGlobalProgress('DELETE',(index/targets.length)*100);
        await assertDeleteTargetUnchanged(slot);
        const metadataUpdate=waitForMetadataUpdate(soundsParentId);
        await deleteFile(slot.nodeId||slot.id);
        assertBatchSession(sessionToken);
        await syncMetadataAfterMutation(soundsParentId,metadataUpdate);
        deviceFiles=deviceFiles.filter(item=>Number(item.nodeId)!==Number(slot.nodeId||slot.id));
        memory.clearSlot(slot.id);
        setGlobalProgress('DELETE',((index+1)/targets.length)*100);
      }
      await assertSlotsDeleted(targets.map(slot=>slot.id));
      renderDeviceStats(soundsMetadata,memory.countOccupied());
      return true;
    }catch(error){
      if(isConnected()&&getDeviceSessionToken()===sessionToken){
        try{await readDevice();}
        catch(syncError){logTechnical('RESYNC AFTER DELETE ERROR',syncError);}
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
    onDownload:async slot=>{
      try{await performDownload(slot,{saveAs:true,index:0,total:1});}
      finally{hideGlobalProgress();}
    },
    onDownloadMany:async selectedSlots=>{
      const sessionToken=captureBatchSession();
      try{
        for(let index=0;index<selectedSlots.length;index++){
          assertBatchSession(sessionToken);
          await performDownload(selectedSlots[index],{saveAs:false,index,total:selectedSlots.length});
        }
      }finally{hideGlobalProgress();}
    },
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
            pendingUploadEvents.add(Number(target.id));
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
            pendingUploadEvents.delete(Number(target.id));
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
      for(const item of targets)pendingUploadEvents.delete(Number(item.slot.id));
      setTimeout(()=>{for(const item of targets)memory.clearOperation(item.slot.id);},900);
      hideGlobalProgress();
      setMutating(false);
    }
  }

  const readDevice=async()=>{
    const sessionToken=captureBatchSession();
    const preferredSelectedId=memory.getSelected()?.id||null;
    const preferredTabIndex=memory.getActiveTab();
    synchronized=false;
    metadataHydrating=false;
    updateMutationAvailability();
    closeProperties();
    setGlobalProgress('SYNC',0);
    try{
      memory.setTabs(activeDeviceProfile.fallbackTabs);
      memory.setSlots(createSampleSlots([]));
      renderDeviceStats({},0);
      soundsParentId=0;
      soundFormats=[];
      soundsMetadata={};
      deviceFiles=[];
      const rootEntries=await listDirectory(0,'/');
      assertBatchSession(sessionToken);
      const soundsRoot=rootEntries.find(item=>item.fileName==='/sounds'&&item.fileType==='folder');
      soundsParentId=Number(soundsRoot?.nodeId)||0;
      if(!soundsParentId)throw new Error('The /sounds library was not found on the device.');
      setGlobalProgress('SYNC',4);
      const soundEntries=await listDirectory(soundsParentId,'/sounds');
      assertBatchSession(sessionToken);
      deviceFiles=[...rootEntries,...soundEntries];
      memory.setEntries(soundEntries);
      renderDeviceStats(soundsMetadata,memory.countOccupied());
      setGlobalProgress('SYNC',8);
      soundsMetadata=await getFileMetadata(soundsParentId);
      assertBatchSession(sessionToken);
      soundFormats=Array.isArray(soundsMetadata?.formats)?soundsMetadata.formats:[];
      memory.setTabs(Array.isArray(soundsMetadata?.tabs)&&soundsMetadata.tabs.length?soundsMetadata.tabs:activeDeviceProfile.fallbackTabs);
      const occupied=createSampleSlots(deviceFiles).filter(slot=>slot.file);
      renderDeviceStats(soundsMetadata,occupied.length);
      const activeTabs=Array.isArray(soundsMetadata?.tabs)&&soundsMetadata.tabs.length?soundsMetadata.tabs:activeDeviceProfile.fallbackTabs;
      const activeRange=activeTabs?.[preferredTabIndex]?.range||null;
      const ordered=prioritizeMetadataSlots(occupied,{selectedId:preferredSelectedId,activeRange});
      const pending=[];
      let loaded=0,cached=0;
      for(const slot of ordered){
        const metadata=sampleMetadataCache.get(slot);
        if(metadata){
          memory.setMetadata(slot.id,metadata);
          loaded+=1;cached+=1;
        }else pending.push(slot);
      }
      metadataHydrating=pending.length>0;
      synchronized=true;
      updateMutationAvailability();
      setGlobalProgress('SYNC',8+(loaded/Math.max(1,occupied.length))*92);
      if(metadataHydrating)setStatus('SYNCED · '+occupied.length+' SAMPLES · LOADING '+pending.length+' METADATA · '+cached+' CACHED');
      for(const slot of pending){
        assertBatchSession(sessionToken);
        try{
          const metadata=await getFileMetadata(slot.nodeId);
          memory.setMetadata(slot.id,metadata);
          sampleMetadataCache.set(memory.getSlot(slot.id),metadata);
        }catch(error){logTechnical('METADATA SLOT '+slot.id,error);}
        loaded+=1;
        setGlobalProgress('SYNC',8+(loaded/Math.max(1,occupied.length))*92);
        if(loaded%8===0)await new Promise(resolve=>setTimeout(resolve,0));
      }
      metadataHydrating=false;
      updateMutationAvailability();
      setGlobalProgress('SYNC',100);
      setStatus('SYNCED · '+occupied.length+' SAMPLES');
    }catch(error){
      metadataHydrating=false;
      synchronized=false;
      updateMutationAvailability();
      reportError('COULD NOT READ EP SAMPLE LIBRARY.',error);
    }finally{
      setTimeout(hideGlobalProgress,180);
    }
  };

  const syncMovedFile=async({oldNodeId,parentId,nodeId})=>{
    const oldId=Number(oldNodeId),newId=Number(nodeId),destinationParentId=Number(parentId);
    if(!Number.isInteger(oldId)||!Number.isInteger(newId)||!Number.isInteger(destinationParentId))return;
    const oldItem=deviceFiles.find(item=>Number(item.nodeId)===oldId)||null;
    const oldWasSound=!!oldItem&&/^\/sounds\/[^/]+$/.test(oldItem.fileName||'');
    const oldMeta=oldId>=1&&oldId<=999?memory.getSlot(oldId)?.meta||null:null;
    sampleMetadataCache.invalidate(oldId);
    sampleMetadataCache.invalidate(newId);
    if(oldId!==newId)deviceFiles=deviceFiles.filter(item=>Number(item.nodeId)!==oldId);
    const info=await getFileInfo(newId);
    const item=fileItemFromInfo(info);
    if(!item)return;
    updateDeviceFile(item);
    if(oldWasSound&&oldId>=1&&oldId<=999&&oldId!==newId)memory.clearSlot(oldId);
    const newIsSound=destinationParentId===Number(soundsParentId)&&/^\/sounds\/[^/]+$/.test(item.fileName||'')&&newId>=1&&newId<=999;
    if(newIsSound){
      memory.setSlot(item);
      try{
        const metadata=await getFileMetadata(newId);
        memory.setMetadata(newId,metadata);
        sampleMetadataCache.set(memory.getSlot(newId),metadata);
      }catch(error){
        if(oldMeta){
          memory.setMetadata(newId,oldMeta);
          sampleMetadataCache.set(memory.getSlot(newId),oldMeta);
        }else logTechnical('MOVED SAMPLE METADATA '+newId,error);
      }
    }
    if(oldWasSound||newIsSound)renderDeviceStats(soundsMetadata,memory.countOccupied());
  };

  const handleFileEvent=async event=>{
    if(!event?.data||!isConnected())return;
    const payload=event.data;
    try{
      if(event.type===TE_SYSEX_FILE_EVENT_METADATA_UPDATED){
        if(Number(payload.nodeId)===Number(soundsParentId)){
          applySoundsMetadata(payload.metadata||{});
        }else if(Number(payload.nodeId)>=1&&Number(payload.nodeId)<=999){
          const nodeId=Number(payload.nodeId);
          memory.mergeMetadata(nodeId,payload.metadata||{});
          sampleMetadataCache.merge(memory.getSlot(nodeId),payload.metadata||{});
          if(currentPropertySlotId===nodeId)renderProperties(memory.getSlot(currentPropertySlotId));
        }
        return;
      }
      if(event.type===TE_SYSEX_FILE_EVENT_FILE_ADDED||event.type===TE_SYSEX_FILE_EVENT_FILE_UPDATED){
        if(pendingUploadEvents.has(Number(payload.nodeId)))return;
        sampleMetadataCache.invalidate(Number(payload.nodeId));
        const info=await getFileInfo(Number(payload.nodeId));
        const item=fileItemFromInfo(info);
        if(!item)return;
        updateDeviceFile(item);
        if(/^\/sounds\/[^/]+$/.test(item.fileName)&&item.nodeId>=1&&item.nodeId<=999){
          memory.setSlot(item);
          try{
            const metadata=await getFileMetadata(item.nodeId);
            memory.setMetadata(item.nodeId,metadata);
            sampleMetadataCache.set(memory.getSlot(item.nodeId),metadata);
          }catch(error){logTechnical('SAMPLE EVENT METADATA '+item.nodeId,error);}
          renderDeviceStats(soundsMetadata,memory.countOccupied());
        }
        return;
      }
      if(event.type===TE_SYSEX_FILE_EVENT_FILE_DELETED){
        const nodeId=Number(payload.nodeId);
        sampleMetadataCache.invalidate(nodeId);
        const existing=deviceFiles.find(item=>Number(item.nodeId)===nodeId);
        deviceFiles=deviceFiles.filter(item=>Number(item.nodeId)!==nodeId);
        if(existing&&/^\/sounds\/[^/]+$/.test(existing.fileName)&&nodeId>=1&&nodeId<=999){
          memory.clearSlot(nodeId);
          renderDeviceStats(soundsMetadata,memory.countOccupied());
          if(currentPropertySlotId===nodeId)closeProperties();
        }
        return;
      }
      if(event.type===TE_SYSEX_FILE_EVENT_FILE_MOVED){
        const key=nativeMoveEventKey(payload.oldNodeId,payload.nodeId);
        if(pendingNativeMoveEvents.has(key))return;
        await syncMovedFile(payload);
      }
    }catch(error){
      logTechnical('FILE EVENT',error);
    }
  };
  onFileEvent(event=>{void handleFileEvent(event);});

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
    connectionArmed=true;
    panel.style.display='flex';
    panel.setAttribute('aria-hidden','false');
    if(!isConnected())void autoConnect();
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

  let connectionArmed=false;
  let midiPermissionBlocked=false;
  let instanceLockBlocked=false;
  let resolveInstanceLock;
  const instanceLockGate=new Promise(resolve=>{resolveInstanceLock=resolve;});
  if(globalThis.navigator?.locks?.request){
    navigator.locks.request('ep-sample-util',{ifAvailable:true},lock=>{
      if(!lock){
        instanceLockBlocked=true;
        resolveInstanceLock(false);
        setConnectionOverlay('OPEN IN ANOTHER TAB');
        return;
      }
      resolveInstanceLock(true);
      return new Promise(()=>{});
    }).catch(error=>{
      logTechnical('INSTANCE LOCK',error);
      resolveInstanceLock(true);
    });
  }else resolveInstanceLock(true);

  const autoConnect=async()=>{
    if(!connectionArmed||deviceUnsafe||isConnected()||midiPermissionBlocked||instanceLockBlocked)return;
    if(!await instanceLockGate){
      setConnectionOverlay('OPEN IN ANOTHER TAB');
      return;
    }
    try{
      await connectEp133();
    }catch(error){
      const message=String(error?.message||error);
      if(error?.name==='NotAllowedError'||/permission|denied/i.test(message)){
        midiPermissionBlocked=true;
        showError?.('MIDI ACCESS DENIED. ALLOW SYSEX AND RELOAD.');
        return;
      }
      if(/not supported/i.test(message)){
        midiPermissionBlocked=true;
        showError?.('WEB MIDI IS NOT SUPPORTED IN THIS BROWSER.');
        return;
      }
      if(!/No MIDI ports|was not found/i.test(message))logTechnical('AUTO CONNECT',error);
    }
  };

  onConnectionChange(state=>{
    renderConnection(state);
    if(state.connected&&!state.unsafe)void readDevice();
  });
  const autoConnectTimer=setInterval(()=>{if(connectionArmed&&!deviceUnsafe&&!isConnected())void autoConnect();},4000);
  window.addEventListener('beforeunload',()=>clearInterval(autoConnectTimer),{once:true});

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

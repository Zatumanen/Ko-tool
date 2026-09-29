import{
  TE_SYSEX_FILE_EVENT_METADATA_UPDATED,TE_SYSEX_FILE_EVENT_FILE_ADDED,
  TE_SYSEX_FILE_EVENT_FILE_UPDATED,TE_SYSEX_FILE_EVENT_FILE_DELETED,
  TE_SYSEX_FILE_EVENT_FILE_MOVED
}from '../constants.js?v=20260930-5';

export function createFileEventController({
  isConnected,
  getMemory,
  sampleMetadataCache,
  getSoundsParentId,
  getSoundsMetadata,
  getDeviceFiles,
  setDeviceFiles,
  getCurrentPropertySlotId,
  getFileInfo,
  getFileMetadata,
  fileItemFromInfo,
  updateDeviceFile,
  applySoundsMetadata,
  renderProperties,
  renderDeviceStats,
  closeProperties,
  logTechnical
}={}){
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
  const clearNativeMoveSuppression=(oldNodeId,newNodeId)=>
    pendingNativeMoveEvents.delete(nativeMoveEventKey(oldNodeId,newNodeId));
  const markUploadPending=nodeId=>pendingUploadEvents.add(Number(nodeId));
  const clearUploadPending=nodeId=>pendingUploadEvents.delete(Number(nodeId));

  const syncMovedFile=async({oldNodeId,parentId,nodeId})=>{
    const memory=getMemory?.();
    if(!memory)return;
    const oldId=Number(oldNodeId),newId=Number(nodeId),destinationParentId=Number(parentId);
    if(!Number.isInteger(oldId)||!Number.isInteger(newId)||!Number.isInteger(destinationParentId))return;
    const deviceFiles=getDeviceFiles?.()||[];
    const oldItem=deviceFiles.find(item=>Number(item.nodeId)===oldId)||null;
    const oldWasSound=!!oldItem&&/^\/sounds\/[^/]+$/.test(oldItem.fileName||'');
    const oldMeta=oldId>=1&&oldId<=999?memory.getSlot(oldId)?.meta||null:null;
    sampleMetadataCache.invalidate(oldId);
    sampleMetadataCache.invalidate(newId);
    if(oldId!==newId)setDeviceFiles?.(deviceFiles.filter(item=>Number(item.nodeId)!==oldId));
    const info=await getFileInfo(newId);
    const item=fileItemFromInfo(info);
    if(!item)return;
    updateDeviceFile(item);
    if(oldWasSound&&oldId>=1&&oldId<=999&&oldId!==newId)memory.clearSlot(oldId);
    const newIsSound=destinationParentId===Number(getSoundsParentId?.())&&/^\/sounds\/[^/]+$/.test(item.fileName||'')&&newId>=1&&newId<=999;
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
        }else logTechnical?.('MOVED SAMPLE METADATA '+newId,error);
      }
    }
    if(oldWasSound||newIsSound)renderDeviceStats?.(getSoundsMetadata?.()||{},memory.countOccupied());
  };

  const handleFileEvent=async event=>{
    if(!event?.data||!isConnected?.())return;
    const memory=getMemory?.();
    if(!memory)return;
    const payload=event.data;
    try{
      if(event.type===TE_SYSEX_FILE_EVENT_METADATA_UPDATED){
        if(Number(payload.nodeId)===Number(getSoundsParentId?.())){
          applySoundsMetadata?.(payload.metadata||{});
        }else if(Number(payload.nodeId)>=1&&Number(payload.nodeId)<=999){
          const nodeId=Number(payload.nodeId);
          memory.mergeMetadata(nodeId,payload.metadata||{});
          sampleMetadataCache.merge(memory.getSlot(nodeId),payload.metadata||{});
          if(getCurrentPropertySlotId?.()===nodeId)renderProperties?.(memory.getSlot(nodeId));
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
          }catch(error){logTechnical?.('SAMPLE EVENT METADATA '+item.nodeId,error);}
          renderDeviceStats?.(getSoundsMetadata?.()||{},memory.countOccupied());
        }
        return;
      }
      if(event.type===TE_SYSEX_FILE_EVENT_FILE_DELETED){
        const nodeId=Number(payload.nodeId);
        sampleMetadataCache.invalidate(nodeId);
        const deviceFiles=getDeviceFiles?.()||[];
        const existing=deviceFiles.find(item=>Number(item.nodeId)===nodeId);
        setDeviceFiles?.(deviceFiles.filter(item=>Number(item.nodeId)!==nodeId));
        if(existing&&/^\/sounds\/[^/]+$/.test(existing.fileName)&&nodeId>=1&&nodeId<=999){
          memory.clearSlot(nodeId);
          renderDeviceStats?.(getSoundsMetadata?.()||{},memory.countOccupied());
          if(getCurrentPropertySlotId?.()===nodeId)closeProperties?.();
        }
        return;
      }
      if(event.type===TE_SYSEX_FILE_EVENT_FILE_MOVED){
        const key=nativeMoveEventKey(payload.oldNodeId,payload.nodeId);
        if(pendingNativeMoveEvents.has(key))return;
        await syncMovedFile(payload);
      }
    }catch(error){
      logTechnical?.('FILE EVENT',error);
    }
  };

  return{
    suppressNativeMoveEvent,
    clearNativeMoveSuppression,
    markUploadPending,
    clearUploadPending,
    handleFileEvent
  };
}

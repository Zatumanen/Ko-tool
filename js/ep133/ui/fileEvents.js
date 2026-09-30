import{
  TE_SYSEX_FILE_EVENT_METADATA_UPDATED,TE_SYSEX_FILE_EVENT_FILE_ADDED,
  TE_SYSEX_FILE_EVENT_FILE_UPDATED,TE_SYSEX_FILE_EVENT_FILE_DELETED,
  TE_SYSEX_FILE_EVENT_FILE_MOVED
}from '../constants.js?v=20260930-5';

export function createFileEventController({
  isConnected,
  sampleStore,
  getSoundsParentId,
  getSoundsMetadata,
  getCurrentPropertySlotId,
  getFileInfo,
  getFileMetadata,
  fileItemFromInfo,
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
    if(!sampleStore)return;
    const oldId=Number(oldNodeId),newId=Number(nodeId),destinationParentId=Number(parentId);
    if(!Number.isInteger(oldId)||!Number.isInteger(newId)||!Number.isInteger(destinationParentId))return;

    const files=sampleStore.getFiles();
    const oldItem=files.find(item=>Number(item.nodeId)===oldId)||null;
    const oldWasSound=!!oldItem&&/^\/sounds\/[^/]+$/.test(oldItem.fileName||'');
    const oldMeta=oldId>=1&&oldId<=999?sampleStore.getMetadata(oldId):null;

    const info=await getFileInfo(newId);
    const item=fileItemFromInfo(info);
    if(!item)return;

    const newIsSound=
      destinationParentId===Number(getSoundsParentId?.())&&
      /^\/sounds\/[^/]+$/.test(item.fileName||'')&&
      newId>=1&&newId<=999;

    let metadata=null;
    if(newIsSound){
      try{
        metadata=await getFileMetadata(newId);
      }catch(error){
        if(oldMeta)metadata=oldMeta;
        else logTechnical?.('MOVED SAMPLE METADATA '+newId,error);
      }
      sampleStore.moveLocal(oldId,item,{
        metadata,
        verification:metadata?'verified':'unknown'
      });
    }else{
      sampleStore.removeFile(oldId);
      sampleStore.upsertFile(item);
    }

    if(oldWasSound||newIsSound)
      renderDeviceStats?.(getSoundsMetadata?.()||{},sampleStore.countOccupied());
  };

  const handleFileEvent=async event=>{
    if(!event?.data||!isConnected?.()||!sampleStore)return;
    const payload=event.data;
    try{
      if(event.type===TE_SYSEX_FILE_EVENT_METADATA_UPDATED){
        if(Number(payload.nodeId)===Number(getSoundsParentId?.())){
          applySoundsMetadata?.(payload.metadata||{});
        }else if(Number(payload.nodeId)>=1&&Number(payload.nodeId)<=999){
          const nodeId=Number(payload.nodeId);
          sampleStore.mergeMetadata(nodeId,payload.metadata||{});
          if(getCurrentPropertySlotId?.()===nodeId)
            renderProperties?.(sampleStore.getSlot(nodeId));
        }
        return;
      }

      if(event.type===TE_SYSEX_FILE_EVENT_FILE_ADDED||event.type===TE_SYSEX_FILE_EVENT_FILE_UPDATED){
        if(pendingUploadEvents.has(Number(payload.nodeId)))return;
        const nodeId=Number(payload.nodeId);
        sampleStore.invalidateMetadata(nodeId);
        const info=await getFileInfo(nodeId);
        const item=fileItemFromInfo(info);
        if(!item)return;
        sampleStore.upsertFile(item,{preserveMetadata:false});
        if(/^\/sounds\/[^/]+$/.test(item.fileName)&&item.nodeId>=1&&item.nodeId<=999){
          try{
            const metadata=await getFileMetadata(item.nodeId);
            sampleStore.setMetadata(item.nodeId,metadata);
          }catch(error){
            logTechnical?.('SAMPLE EVENT METADATA '+item.nodeId,error);
          }
          renderDeviceStats?.(getSoundsMetadata?.()||{},sampleStore.countOccupied());
        }
        return;
      }

      if(event.type===TE_SYSEX_FILE_EVENT_FILE_DELETED){
        const nodeId=Number(payload.nodeId);
        const existing=sampleStore.getFiles().find(item=>Number(item.nodeId)===nodeId);
        sampleStore.removeFile(nodeId);
        if(existing&&/^\/sounds\/[^/]+$/.test(existing.fileName)&&nodeId>=1&&nodeId<=999){
          renderDeviceStats?.(getSoundsMetadata?.()||{},sampleStore.countOccupied());
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

const tagDependencyGuard=(operation,slots,action)=>{
  Object.defineProperty(operation,'sampleDependencyGuard',{
    value:Object.freeze({slots:Object.freeze([...slots]),operation:action}),
    configurable:false
  });
  return operation;
};

export function createSampleDeleteController({
  sampleStore,
  getSoundsParentId,getSoundsMetadata,
  isConnected,isSynchronized,hasPendingPropertyWrites,
  confirmAction,withFileTransaction,captureBatchSession,assertBatchSession,getDeviceSessionToken,
  setMutating,setGlobalProgress,hideGlobalProgress,
  getFileInfo,getFileMetadata,deleteFile,
  waitForMetadataUpdate,syncMetadataAfterMutation,
  assertSlotsDeleted,renderDeviceStats,
  readDevice,logTechnical
}={}){
  const assertDeleteTargetUnchanged=async(slot,fileOps=null)=>{
    const soundsParentId=Number(getSoundsParentId())||0;
    const readInfo=fileOps?.getFileInfo||getFileInfo;
    const readMetadata=fileOps?.getFileMetadata||getFileMetadata;
    const info=await readInfo(slot.nodeId||slot.id);
    if(
      Number(info.nodeId)!==Number(slot.id)||
      Number(info.parentId)!==soundsParentId||
      Number(info.fileSize)!==Number(slot.file?.size||0)
    )throw new Error('Sample slot changed before delete; reload the library and confirm again.');

    const currentMetadata=await readMetadata(slot.nodeId||slot.id);
    if(slot.meta?.crc!=null&&Number(currentMetadata?.crc)!==Number(slot.meta.crc))
      throw new Error('Sample slot changed before delete; CRC no longer matches the selected sample.');
    if(slot.meta?.name!=null&&String(currentMetadata?.name)!==String(slot.meta.name))
      throw new Error('Sample slot changed before delete; name no longer matches the selected sample.');
  };

  const deleteSamples=async targets=>{
    if(!targets?.length||!isConnected()||!isSynchronized())return false;
    if(hasPendingPropertyWrites())
      throw new Error('Wait for the pending sample property write to finish before deleting samples.');
    const canonicalTargets=targets.map(target=>sampleStore.getSlot(target.id)).filter(slot=>slot?.file);
    if(!canonicalTargets.length)return false;
    const message=canonicalTargets.length>1
      ?'DELETE '+canonicalTargets.length+' SELECTED SAMPLES?'
      :'DELETE "'+String(canonicalTargets[0]?.meta?.name||canonicalTargets[0]?.file?.name||'SAMPLE').toUpperCase()+'"?';
    if(!await confirmAction(message))return false;

    const sessionToken=captureBatchSession();
    const soundsParentId=Number(getSoundsParentId())||0;
    const runDeleteTransaction=operation=>{
      tagDependencyGuard(operation,canonicalTargets.map(slot=>slot.id),'delete');
      return typeof withFileTransaction==='function'
        ?withFileTransaction('sample delete transaction',operation,{strict:true})
        :operation({getFileInfo,getFileMetadata,deleteFile});
    };
    setMutating(true);
    try{
      return await runDeleteTransaction(async fileOps=>{
        for(let index=0;index<canonicalTargets.length;index++){
          assertBatchSession(sessionToken);
          const slot=canonicalTargets[index];
          setGlobalProgress('DELETE',(index/canonicalTargets.length)*100);
          await assertDeleteTargetUnchanged(slot,fileOps);
          const metadataUpdate=waitForMetadataUpdate(soundsParentId);
          await fileOps.deleteFile(slot.nodeId||slot.id);
          assertBatchSession(sessionToken);
          await syncMetadataAfterMutation(soundsParentId,metadataUpdate,fileOps);
          sampleStore.removeFile(slot.nodeId||slot.id);
          setGlobalProgress('DELETE',((index+1)/canonicalTargets.length)*100);
        }
        await assertSlotsDeleted(canonicalTargets.map(slot=>slot.id),fileOps);
        renderDeviceStats(getSoundsMetadata(),sampleStore.countOccupied());
        return true;
      });
    }catch(error){
      if(isConnected()&&getDeviceSessionToken()===sessionToken){
        try{await readDevice();}catch(syncError){logTechnical('RESYNC AFTER DELETE ERROR',syncError);}
      }
      throw error;
    }finally{
      hideGlobalProgress();
      setMutating(false);
    }
  };

  return{deleteSamples,assertDeleteTargetUnchanged};
}

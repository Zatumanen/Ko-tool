export function createSampleDeleteController({
  getMemory,getSoundsParentId,getSoundsMetadata,
  isConnected,isSynchronized,hasPendingPropertyWrites,
  confirmAction,captureBatchSession,assertBatchSession,getDeviceSessionToken,
  setMutating,setGlobalProgress,hideGlobalProgress,
  getFileInfo,getFileMetadata,deleteFile,
  waitForMetadataUpdate,syncMetadataAfterMutation,
  assertSlotsDeleted,removeDeviceFile,renderDeviceStats,
  readDevice,logTechnical
}={}){
  const assertDeleteTargetUnchanged=async slot=>{
    const soundsParentId=Number(getSoundsParentId())||0;
    const info=await getFileInfo(slot.nodeId||slot.id);
    if(
      Number(info.nodeId)!==Number(slot.id)||
      Number(info.parentId)!==soundsParentId||
      Number(info.fileSize)!==Number(slot.file?.size||0)
    ){
      throw new Error('Sample slot changed before delete; reload the library and confirm again.');
    }

    const currentMetadata=await getFileMetadata(slot.nodeId||slot.id);
    if(slot.meta?.crc!=null&&Number(currentMetadata?.crc)!==Number(slot.meta.crc))
      throw new Error('Sample slot changed before delete; CRC no longer matches the selected sample.');
    if(slot.meta?.name!=null&&String(currentMetadata?.name)!==String(slot.meta.name))
      throw new Error('Sample slot changed before delete; name no longer matches the selected sample.');
  };

  const deleteSamples=async targets=>{
    if(!targets?.length||!isConnected()||!isSynchronized())return false;
    if(hasPendingPropertyWrites())
      throw new Error('Wait for the pending sample property write to finish before deleting samples.');

    const message=targets.length>1
      ?'DELETE '+targets.length+' SELECTED SAMPLES?'
      :'DELETE "'+String(targets[0]?.meta?.name||targets[0]?.file?.name||'SAMPLE').toUpperCase()+'"?';
    if(!await confirmAction(message))return false;

    const sessionToken=captureBatchSession();
    const soundsParentId=Number(getSoundsParentId())||0;
    const memory=getMemory();
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

        removeDeviceFile(slot.nodeId||slot.id);
        memory.clearSlot(slot.id);
        setGlobalProgress('DELETE',((index+1)/targets.length)*100);
      }

      await assertSlotsDeleted(targets.map(slot=>slot.id));
      renderDeviceStats(getSoundsMetadata(),memory.countOccupied());
      return true;
    }catch(error){
      if(isConnected()&&getDeviceSessionToken()===sessionToken){
        try{
          await readDevice();
        }catch(syncError){
          logTechnical('RESYNC AFTER DELETE ERROR',syncError);
        }
      }
      throw error;
    }finally{
      hideGlobalProgress();
      setMutating(false);
    }
  };

  return{deleteSamples,assertDeleteTargetUnchanged};
}

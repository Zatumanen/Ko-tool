export function createSampleMoveController({
  sampleStore,
  getSoundsParentId,getSoundsMetadata,
  fileItemFromInfo,
  remapCurrentPropertySlot,renderDeviceStats,
  captureBatchSession,assertBatchSession,getDeviceSessionToken,
  isConnected,setMutating,setGlobalProgress,hideGlobalProgress,
  suppressNativeMoveEvent,clearNativeMoveSuppression,
  moveFile,readDevice,logTechnical
}={}){
  const applyNativeMoveLocally=(source,target,moved)=>{
    const oldId=Number(moved.oldFileId);
    const newId=Number(moved.newFileId);
    const oldMeta=moved.metadata||source.meta||sampleStore.getMetadata(oldId)||null;
    const item=fileItemFromInfo(moved.info);
    if(!item||Number(item.nodeId)!==newId)
      throw new Error('The native FILE_MOVE destination could not be resolved.');

    sampleStore.moveLocal(oldId,item,{
      metadata:oldMeta,
      state:'ready',
      verification:'verified'
    });

    remapCurrentPropertySlot(oldId,newId);
    renderDeviceStats(getSoundsMetadata(),sampleStore.countOccupied());
  };

  const nativeMoveTransfer=async(plan,sourceById)=>{
    const completed=[];
    const sessionToken=captureBatchSession();
    const soundsParentId=Number(getSoundsParentId())||0;

    setMutating(true);
    try{
      for(let index=0;index<plan.length;index++){
        assertBatchSession(sessionToken);
        const pair=plan[index];
        const source=sourceById.get(pair.sourceId);
        const target=sampleStore.getSlot(pair.targetId);
        if(!source||!target)throw new Error('Invalid native MOVE plan.');
        if(target.file)throw new Error('Target sample slot is no longer empty.');

        const sourceNodeId=Number(source.nodeId||source.id);
        sampleStore.setOperation(target.id,{status:'moving',label:'MOVING',progress:0});
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

        completed.push({
          sourceId:source.id,
          targetId:target.id,
          source,
          crc:moved.sourceCrc
        });

        if(moved.crcVerified!==true)
          throw new Error('Native FILE_MOVE CRC verification failed for slot '+source.id+' -> '+target.id+'.');

        applyNativeMoveLocally(source,target,moved);
        sampleStore.setOperation(target.id,{status:'complete',label:'MOVED',progress:100});
        setGlobalProgress('MOVE',((index+1)/plan.length)*100);
      }

      for(const pair of plan)sampleStore.clearOperation(pair.targetId);
      setGlobalProgress('MOVE',100);
      return{targetIds:plan.map(pair=>pair.targetId)};
    }catch(error){
      if(completed.length&&isConnected()&&getDeviceSessionToken()===sessionToken){
        for(const pair of [...completed].reverse()){
          try{
            assertBatchSession(sessionToken);
            const releaseSuppression=suppressNativeMoveEvent(pair.targetId,pair.sourceId);
            const restored=await moveFile(
              pair.targetId,
              soundsParentId,
              pair.sourceId,
              {verifyCrc:true}
            );
            releaseSuppression();

            if(
              restored.crcVerified!==true||
              Number(restored.destinationCrc)!==Number(pair.crc)
            ){
              throw new Error('Rollback CRC verification failed.');
            }
          }catch(rollbackError){
            clearNativeMoveSuppression(pair.targetId,pair.sourceId);
            logTechnical(
              'NATIVE MOVE ROLLBACK '+pair.targetId+'->'+pair.sourceId,
              rollbackError
            );
          }
        }

        try{
          await readDevice();
        }catch(syncError){
          logTechnical('RESYNC AFTER NATIVE MOVE ERROR',syncError);
        }
      }

      sampleStore.clearOperations();
      throw error;
    }finally{
      hideGlobalProgress();
      setMutating(false);
    }
  };

  return{nativeMoveTransfer,applyNativeMoveLocally};
}

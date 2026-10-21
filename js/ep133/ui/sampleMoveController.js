export function createSampleMoveController({
  sampleStore,
  getSoundsParentId,getSoundsMetadata,
  fileItemFromInfo,
  remapCurrentPropertySlot,renderDeviceStats,
  withFileTransaction,captureBatchSession,assertBatchSession,getDeviceSessionToken,
  isConnected,setMutating,setGlobalProgress,hideGlobalProgress,markDeviceUnsafe,verifyNativeProjectSlotMove,
  suppressNativeMoveEvent,clearNativeMoveSuppression,
  readDevice,logTechnical
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

  const runMoveTransaction=(operation,plan,onMovePreflight)=>{
    if(typeof withFileTransaction!=='function')
      throw new Error('MOVE requires a strict FILE transaction with project dependency preflight.');
    Object.defineProperty(operation,'sampleDependencyGuard',{
      value:Object.freeze({
        slots:Object.freeze(plan.map(pair=>pair.sourceId)),
        moves:Object.freeze(plan.map(pair=>Object.freeze({sourceId:pair.sourceId,targetId:pair.targetId}))),
        operation:'move',
        onMovePreflight
      })
    });
    return withFileTransaction('sample move transaction',operation,{strict:true});
  };

  const nativeMoveTransfer=async(plan,sourceById)=>{
    // An immutable execution plan must match the exact sources scanned by the guard.
    plan=plan.map(pair=>Object.freeze({...pair}));
    let mutationStarted=false;
    let verifiedPreflight=null;
    const projectSnapshots=new Map();
    const sessionToken=captureBatchSession();
    const soundsParentId=Number(getSoundsParentId())||0;

    setMutating(true);
    try{
      return await runMoveTransaction(async fileOps=>{
        try{
          for(let index=0;index<plan.length;index++){
            assertBatchSession(sessionToken);
            const pair=plan[index];
            const source=sourceById.get(pair.sourceId);
            const target=sampleStore.getSlot(pair.targetId);
            if(!source||!target)throw new Error('Invalid native MOVE plan.');
            if(target.file)throw new Error('Target sample slot is no longer empty.');

            const sourceNodeId=Number(source.nodeId||source.id);
            const trustedCrc=source.verification?.file==='verified'&&
              source.verification?.metadata==='verified'?source.meta?.crc:null;
            const expectedSourceCrc=Number.isInteger(Number(trustedCrc))&&
              trustedCrc!==null&&trustedCrc!==undefined&&
              Number(trustedCrc)>=0&&Number(trustedCrc)<=0xffffffff
              ?Number(trustedCrc):null;

            sampleStore.setOperation(target.id,{status:'moving',label:'MOVING',progress:0});
            setGlobalProgress('MOVE',(index/plan.length)*100);
            if(verifiedPreflight&&typeof verifyNativeProjectSlotMove!=='function')
              throw new Error('Verified firmware MOVE requires project TAR readback verification.');
            const releaseSuppression=suppressNativeMoveEvent(sourceNodeId,target.id);
            let moved;
            try{
              // Even a timeout may mean that the hardware changed every project.
              // Never retry FILE_MOVE or automatically MOVE back on ambiguity.
              mutationStarted=true;
              moved=await fileOps.moveFile(sourceNodeId,soundsParentId,target.id,{verifyCrc:true,expectedSourceCrc});
            }catch(error){
              clearNativeMoveSuppression(sourceNodeId,target.id);
              throw error;
            }
            releaseSuppression();

            if(moved.crcVerified!==true)
              throw new Error('Native FILE_MOVE CRC verification failed for slot '+source.id+' -> '+target.id+'.');

            // For the exact verified firmware, re-read every affected saved TAR.
            // No project upload, pad METADATA_SET or manual remap is performed.
            if(verifiedPreflight){
              const affected=new Set(verifiedPreflight.references
                .filter(reference=>reference.slot===pair.sourceId)
                .map(reference=>reference.project));
              for(const project of affected){
                assertBatchSession(sessionToken);
                const snapshot=projectSnapshots.get(project);
                if(!snapshot)throw new Error('MOVE project P'+project+' preflight snapshot missing.');
                const readback=await fileOps.getFile(snapshot.nodeId);
                const verification=verifyNativeProjectSlotMove(snapshot.data,readback.data,{
                  project,sourceId:pair.sourceId,targetId:pair.targetId
                });
                snapshot.data=verification.data;
              }
            }

            applyNativeMoveLocally(source,target,moved);
            sampleStore.setOperation(target.id,{status:'complete',label:'MOVED',progress:100});
            setGlobalProgress('MOVE',((index+1)/plan.length)*100);
          }
          for(const pair of plan)sampleStore.clearOperation(pair.targetId);
          setGlobalProgress('MOVE',100);
          return{targetIds:plan.map(pair=>pair.targetId)};
        }catch(error){
          sampleStore.clearOperations();
          if(mutationStarted){
            const reason='Native MOVE may have changed sample slots and saved projects; '+
              'verification or execution failed. Do not retry or reverse MOVE automatically. '+
              String(error?.message||error);
            if(typeof markDeviceUnsafe==='function'){
              try{markDeviceUnsafe(reason);}
              catch(lockError){logTechnical('MOVE SAFETY LOCK FAILED',lockError);}
            }
            throw new Error(reason,{cause:error});
          }
          throw error;
        }
      },plan,preflight=>{
        verifiedPreflight=preflight;
        for(const snapshot of preflight.projectSnapshots){
          projectSnapshots.set(snapshot.project,{
            project:snapshot.project,nodeId:snapshot.nodeId,data:snapshot.data.slice()
          });
        }
      });
    }finally{
      hideGlobalProgress();
      setMutating(false);
    }
  };
  return{nativeMoveTransfer,applyNativeMoveLocally};
}

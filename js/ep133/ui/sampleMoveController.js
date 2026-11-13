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

  const runMoveTransaction=(operation,plan,onMovePreflight,onProjectRead)=>{
    if(typeof withFileTransaction!=='function')
      throw new Error('MOVE requires a strict FILE transaction with project dependency preflight.');
    Object.defineProperty(operation,'sampleDependencyGuard',{
      value:Object.freeze({
        slots:Object.freeze(plan.map(pair=>pair.sourceId)),
        moves:Object.freeze(plan.map(pair=>Object.freeze({sourceId:pair.sourceId,targetId:pair.targetId}))),
        operation:'move',
        nativeFirmwareMove:true,
        onMovePreflight,
        onProjectRead
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
    const knownCrc=value=>{
      if(value===null||value===undefined||value==='')return null;
      const crc=Number(value);
      return Number.isInteger(crc)&&crc>=0&&crc<=0xffffffff?crc:null;
    };

    // FILE_LIST is authoritative; the sampleStore/UI snapshot may be stale.
    // All reads run under the same strict FILE lease as the subsequent mutation.
    const readSoundInventory=async fileOps=>{
      if(!soundsParentId||typeof fileOps?.listDirectory!=='function')
        throw new Error('MOVE requires lease-bound /sounds FILE_LIST verification.');
      const files=await fileOps.listDirectory(soundsParentId,'/sounds');
      if(!Array.isArray(files))throw new Error('MOVE /sounds FILE_LIST was not available.');
      const inventory=new Map();
      for(const item of files){
        const id=Number(item?.nodeId);
        if(!Number.isInteger(id)||id<1||id>999)continue;
        if(!/^\/sounds\/[^/]+$/.test(String(item?.fileName||''))||inventory.has(id))
          throw new Error('MOVE /sounds FILE_LIST contains an ambiguous sample slot '+id+'.');
        inventory.set(id,item);
      }
      return inventory;
    };

    setMutating(true);
    setGlobalProgress('MOVE',0);
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

            const before=await readSoundInventory(fileOps);
            assertBatchSession(sessionToken);
            const deviceSource=before.get(pair.sourceId);
            if(!deviceSource)
              throw new Error('MOVE source sample is missing on the device, slot '+pair.sourceId+'.');
            if(before.has(pair.targetId))
              throw new Error('MOVE target slot is occupied on the device, slot '+pair.targetId+'.');
            if(!source.file||deviceSource.fileName!==source.file.path)
              throw new Error('MOVE source sample changed on the device, slot '+pair.sourceId+'.');
            // On EP-133 2.5.1 FILE_INFO can briefly report 15 bytes after
            // a native MOVE. Never trust that size without live CRC readback.
            const cachedSize=Number(source.file.size);
            const deviceSize=Number(deviceSource.fileSize);
            if(!Number.isSafeInteger(deviceSize)||deviceSize<=0||
               (cachedSize!==deviceSize&&!(cachedSize===15&&deviceSize>15)))
              throw new Error('MOVE source sample size changed on the device, slot '+pair.sourceId+'.');

            const sourceNodeId=Number(source.nodeId||source.id);
            const expectedSourceCrc=knownCrc(source.meta?.crc);
            if(expectedSourceCrc===null||typeof fileOps?.getFileMetadata!=='function')
              throw new Error('MOVE source CRC cannot be verified before mutation, slot '+pair.sourceId+'.');
            const liveMetadata=await fileOps.getFileMetadata(sourceNodeId);
            assertBatchSession(sessionToken);
            const liveCrc=knownCrc(liveMetadata?.crc);
            if(liveCrc===null||liveCrc!==expectedSourceCrc)
              throw new Error('MOVE source sample CRC changed on the device, slot '+pair.sourceId+'.');

            sampleStore.setOperation(target.id,{status:'moving',label:'MOVING',progress:0});
            setGlobalProgress('MOVE',30+(index/plan.length)*65);
            if(verifiedPreflight&&!verifiedPreflight.nativeFirmwareMove&&
               typeof verifyNativeProjectSlotMove!=='function')
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

            setGlobalProgress('VERIFY',30+((index+0.55)/plan.length)*65);
            if(moved.timedOut===true)
              throw new Error('Native FILE_MOVE timed out; destination CRC alone cannot confirm the source was removed.');
            if(moved.crcVerified!==true)
              throw new Error('Native FILE_MOVE CRC verification failed for slot '+source.id+' -> '+target.id+'.');

            const after=await readSoundInventory(fileOps);
            assertBatchSession(sessionToken);
            if(after.has(pair.sourceId))
              throw new Error('Native FILE_MOVE source is still present on the device, slot '+pair.sourceId+'.');
            const destination=after.get(pair.targetId);
            if(!destination)
              throw new Error('Native FILE_MOVE destination is missing on the device, slot '+pair.targetId+'.');
            if(Number(destination.fileSize)!==deviceSize)
              throw new Error('Native FILE_MOVE destination size differs from the source on the device, slot '+pair.targetId+'.');

            // FILE_INFO may transiently return 15 bytes after an acknowledged
            // MOVE; the verified post-MOVE FILE_LIST is the display source.
            moved={...moved,info:{...moved.info,fileSize:deviceSize}};

            // For the exact verified firmware, re-read every affected saved TAR.
            // No project upload, pad METADATA_SET or manual remap is performed.
            if(verifiedPreflight&&!verifiedPreflight.nativeFirmwareMove){
              const affected=new Set(verifiedPreflight.references
                .filter(reference=>reference.slot===pair.sourceId)
                .map(reference=>reference.project));
              let verified=0;
              for(const project of affected){
                assertBatchSession(sessionToken);
                const snapshot=projectSnapshots.get(project);
                if(!snapshot)throw new Error('MOVE project P'+project+' preflight snapshot missing.');
                const readback=verifiedPreflight.verifiedFastRead&&
                  typeof fileOps.getFileInInitializedSession==='function'
                  ?await fileOps.getFileInInitializedSession(snapshot.nodeId)
                  :await fileOps.getFile(snapshot.nodeId);
                const verification=verifyNativeProjectSlotMove(snapshot.data,readback.data,{
                  project,sourceId:pair.sourceId,targetId:pair.targetId
                });
                snapshot.data=verification.data;
                verified++;
                setGlobalProgress('VERIFY',30+((index+0.55+0.4*verified/affected.size)/plan.length)*65);
              }
            }

            applyNativeMoveLocally(source,target,moved);
            sampleStore.setOperation(target.id,{status:'complete',label:'MOVED',progress:100});
            setGlobalProgress('VERIFY',30+((index+1)/plan.length)*65);
          }
          for(const pair of plan)sampleStore.clearOperation(pair.targetId);
          setGlobalProgress('VERIFY',100);
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
      },(done,total)=>{
        setGlobalProgress('CHECK PROJECTS',total?30*done/total:30);
      });
    }finally{
      hideGlobalProgress();
      setMutating(false);
    }
  };
  return{nativeMoveTransfer,applyNativeMoveLocally};
}

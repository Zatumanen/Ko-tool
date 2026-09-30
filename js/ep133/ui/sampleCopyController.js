export function createSampleCopyController({
  sampleStore,
  getSoundsParentId,getSoundsMetadata,getActiveDeviceProfile,
  isConnected,withFileTransaction,captureBatchSession,assertBatchSession,getDeviceSessionToken,
  setMutating,setGlobalProgress,hideGlobalProgress,
  assertSlotsEmpty,refreshSoundsRuntimeMetadata,
  getFile,getFileMetadata,
  prepareSampleTransferMetadata,createTransferFileName,
  uploadSampleToSlot,waitForMetadataUpdate,syncMetadataAfterMutation,
  getFileInfo,fileItemFromInfo,
  prepareSampleLocalMetadata,renderDeviceStats,
  deleteFile,readDevice,logTechnical
}={}){
  const runCopyTransaction=operation=>typeof withFileTransaction==='function'
    ?withFileTransaction('sample copy transaction',operation,{strict:true})
    :operation({getFile,getFileMetadata,uploadSampleToSlot,getFileInfo,deleteFile});
  const assertSampleFitsAvailableMemory=async(byteLength,fileOps=null)=>{
    const latest=await refreshSoundsRuntimeMetadata(fileOps);
    const freeSpace=Number(latest?.free_space_in_bytes);
    if(Number.isFinite(freeSpace)&&freeSpace>=0&&Number(byteLength)>freeSpace)
      throw new Error('Not enough free sample memory on the connected EP.');
  };

  const copyTransfer=async(plan,sourceById,sources)=>{
    const sessionToken=captureBatchSession();
    if((sources||[]).some(item=>item.node?.isReadable!==true))
      throw new Error('One or more source samples cannot be read.');

    const soundsParentId=Number(getSoundsParentId())||0;
    const profile=getActiveDeviceProfile();
    const created=[];
    let needsResync=false;

    setMutating(true);
    try{
      return await runCopyTransaction(async fileOps=>{
        try{
      await assertSlotsEmpty(plan.map(pair=>pair.targetId),fileOps);

      for(let index=0;index<plan.length;index++){
        assertBatchSession(sessionToken);
        const pair=plan[index];
        const source=sourceById.get(pair.sourceId);
        const target=sampleStore.getSlot(pair.targetId);
        if(!source||!target)throw new Error('Invalid transfer plan.');

        const operationLabel='COPYING';
        sampleStore.setOperation(target.id,{
          status:'uploading',
          label:operationLabel,
          progress:0
        });

        const downloaded=await fileOps.getFile(source.nodeId||source.id,(done,total)=>{
          const local=total?done/total:0;
          setGlobalProgress('COPY',((index+local*.35)/plan.length)*100);
        });
        assertBatchSession(sessionToken);

        const bytes=downloaded?.data instanceof Uint8Array
          ?downloaded.data
          :new Uint8Array(downloaded?.data||[]);
        if(!bytes.byteLength)throw new Error('The device returned an empty sample.');

        const sourceMetadata=await fileOps.getFileMetadata(source.nodeId||source.id);
        assertBatchSession(sessionToken);

        const metadata=prepareSampleTransferMetadata(sourceMetadata,{
          allowedPlayModes:profile.playModes
        });
        const displayName=metadata?.name||downloaded?.name||source.file?.name||'sample';
        const transferName=createTransferFileName(source.id,target.id);
        const expectedMetadata={...metadata,name:displayName};

        await assertSampleFitsAvailableMemory(bytes.byteLength,fileOps);
        await assertSlotsEmpty([target.id],fileOps);

        const metadataUpdate=waitForMetadataUpdate(soundsParentId);
        const fileId=await fileOps.uploadSampleToSlot({
          data:bytes,
          filename:transferName,
          parentId:soundsParentId,
          destinationId:target.id,
          metadata:expectedMetadata,
          allowedPlayModes:profile.playModes,
          allowAdvancedMetadata:profile.advancedSampleMetadataWrites,
          barWriteMode:'preserve',
          onCreated:id=>{
            const createdId=Number(id)||target.id;
            if(!created.includes(createdId))created.push(createdId);
          },
          onProgress:(done,total)=>{
            const local=total?done/total:0;
            const rowProgress=Math.round(local*100);
            sampleStore.setOperation(target.id,{
              status:'uploading',
              label:operationLabel,
              progress:rowProgress
            });
            setGlobalProgress('COPY',((index+.35+local*.55)/plan.length)*100);
          }
        });

        assertBatchSession(sessionToken);
        await syncMetadataAfterMutation(soundsParentId,metadataUpdate,fileOps);

        if(Number(fileId)!==Number(target.id))
          throw new Error('The device wrote a sample to an unexpected slot.');

        const info=await fileOps.getFileInfo(fileId);
        const item=fileItemFromInfo(info);
        if(!item||Number(item.nodeId)!==Number(target.id))
          throw new Error('The destination slot could not be verified.');

        sampleStore.upsertFile(item,{state:'ready',verification:'verified',preserveMetadata:false});

        const localMetadata=prepareSampleLocalMetadata(expectedMetadata,{
          allowedPlayModes:profile.playModes,
          allowAdvancedMetadata:profile.advancedSampleMetadataWrites,
          barWriteMode:'preserve'
        });
        sampleStore.setMetadata(target.id,localMetadata,{verification:'expected'});

        sampleStore.setOperation(target.id,{
          status:'complete',
          label:'COPIED',
          progress:100
        });
        setGlobalProgress('COPY',((index+.95)/plan.length)*100);
      }

      renderDeviceStats(getSoundsMetadata(),sampleStore.countOccupied());
      for(const id of created)sampleStore.clearOperation(id);
      setGlobalProgress('COPY',100);
      return{targetIds:plan.map(pair=>pair.targetId)};
        }catch(error){
      if(isConnected()){
        for(const id of [...created].reverse()){
          try{
            assertBatchSession(sessionToken);
            const rollbackMetadataUpdate=waitForMetadataUpdate(soundsParentId);
            await fileOps.deleteFile(id);
            await syncMetadataAfterMutation(soundsParentId,rollbackMetadataUpdate,fileOps);
          }catch(rollbackError){
            logTechnical('TRANSFER ROLLBACK SLOT '+id,rollbackError);
          }
          sampleStore.removeFile(id);
        }
      }

      sampleStore.clearOperations();

      needsResync=true;

      throw error;
        }
      });
    }catch(error){
      if(needsResync&&isConnected()&&getDeviceSessionToken()===sessionToken){
        try{await readDevice();}
        catch(syncError){logTechnical('RESYNC AFTER TRANSFER ERROR',syncError);}
      }
      throw error;
    }finally{
      hideGlobalProgress();
      setMutating(false);
    }
  };

  return{copyTransfer,assertSampleFitsAvailableMemory};
}

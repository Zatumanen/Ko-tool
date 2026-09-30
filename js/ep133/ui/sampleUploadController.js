import{prepareEp133Sample}from '../audio.js?v=20260930-5';
import{buildProvisionalUploadedFileItem}from './fileModel.js?v=20260930-5';

export function createSampleUploadController({
  sampleStore,getMemory,
  getSoundsParentId,getSoundFormats,getSoundsMetadata,setSoundsMetadata,
  getActiveDeviceProfile,
  isConnected,isSynchronized,isDeviceUnsafe,
  captureBatchSession,assertBatchSession,
  setMutating,setGlobalProgress,hideGlobalProgress,
  withFileTransaction,assertSlotsEmpty,refreshSoundsRuntimeMetadata,
  uploadSampleToSlot,prepareSampleLocalMetadata,normalizeFileName,
  fileItemFromInfo,getFileInfo,getFileMetadata,
  renderDeviceStats,
  markUploadPending,clearUploadPending,
  waitForMetadataUpdate,deleteFile,syncMetadataAfterMutation,assertSlotsDeleted,
  logTechnical,showError,
  prepareSample=prepareEp133Sample,
  setTimeoutFn=(callback,delay)=>setTimeout(callback,delay)
}={}){
  const hydrateUploadedFileItem=async nodeId=>{
    try{
      const info=await getFileInfo(nodeId);
      const item=fileItemFromInfo(info);
      if(!item)return;
      sampleStore.upsertFile(item,{state:'ready',verification:'verified'});
      const metadata=await getFileMetadata(nodeId);
      sampleStore.setMetadata(nodeId,metadata||{},{verification:'verified'});
      renderDeviceStats(getSoundsMetadata(),sampleStore.countOccupied());
    }catch(error){
      logTechnical('UPLOAD HYDRATE SLOT '+nodeId,error);
    }
  };

  const runUploadTransaction=operation=>typeof withFileTransaction==='function'
    ?withFileTransaction('sample upload batch',operation,{strict:true})
    :operation({uploadSampleToSlot,deleteFile});
  const uploadFilesToSlot=async(slot,files)=>{
    if(!isConnected())throw new Error('EP device is disconnected.');
    if(!isSynchronized()||!getSoundsParentId())throw new Error('Sample library is still synchronizing.');
    if(!slot||!files?.length)return;

    const audioFiles=Array.from(files).filter(file=>file&&(
      /\.(wav|mp3|aac|ogg|flac|m4a|aif|aiff)$/i.test(file.name)||
      String(file.type||'').startsWith('audio/')
    ));
    if(!audioFiles.length)throw new Error('No supported audio files were found.');

    const targets=[];
    let searchFrom=slot.id;
    for(const file of audioFiles){
      const destinationId=sampleStore.findNextFree(searchFrom);
      if(destinationId===-1)break;
      targets.push({file,slot:sampleStore.getSlot(destinationId)});
      searchFrom=destinationId+1;
    }
    if(targets.length<audioFiles.length)
      throw new Error('Not enough free sample slots above the drop position.');

    const sessionToken=captureBatchSession();
    const soundsParentId=Number(getSoundsParentId())||0;
    setMutating(true);
    const successes=[];
    const failures=[];

    try{
      await runUploadTransaction(async fileOps=>{
        await assertSlotsEmpty(targets.map(item=>item.slot.id),fileOps);

        let currentSoundsMetadata=getSoundsMetadata();
        let remainingFreeSpace=Number(currentSoundsMetadata?.free_space_in_bytes);
        if(!Number.isFinite(remainingFreeSpace)||remainingFreeSpace<0){
          const latestSounds=await refreshSoundsRuntimeMetadata(fileOps);
          remainingFreeSpace=Number(latestSounds?.free_space_in_bytes);
        }
        if(!Number.isFinite(remainingFreeSpace)||remainingFreeSpace<0)remainingFreeSpace=null;

        for(let index=0;index<targets.length;index++){
          assertBatchSession(sessionToken);
          const item=targets[index];
          const target=item.slot;

          try{
            sampleStore.setOperation(target.id,{status:'preparing',label:'PREPARING',progress:0});
            const prepared=await prepareSample(item.file,{
              formats:getSoundFormats(),
              onProgress:(value,info)=>{
                const progress=Math.max(0,Math.min(100,Number(value)||0));
                const phase=String(info?.status||'preparing').toUpperCase();
                sampleStore.setOperation(target.id,{
                  status:String(info?.status||'preparing'),
                  label:phase,
                  progress
                });
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

            sampleStore.setOperation(target.id,{status:'uploading',label:'UPLOADING',progress:0});
            let createdId=null;
            markUploadPending(target.id);

            const profile=getActiveDeviceProfile();
            const fileId=await fileOps.uploadSampleToSlot({
              file:item.file,
              data:prepared.data,
              filename:item.file.name,
              parentId:soundsParentId,
              destinationId:target.id,
              metadata,
              allowedPlayModes:profile.playModes,
              allowAdvancedMetadata:profile.advancedSampleMetadataWrites,
              barWriteMode:'omit',
              onCreated:id=>{
                createdId=Number(id)||target.id;
                item.createdId=createdId;
              },
              onProgress:(done,total)=>{
                const local=total?done/total:0;
                sampleStore.setOperation(target.id,{
                  status:'uploading',
                  label:'UPLOADING',
                  progress:local*100
                });
                setGlobalProgress('UPLOAD',((index+.35+local*.65)/targets.length)*100);
              }
            });

            assertBatchSession(sessionToken);
            if(Number(fileId)!==Number(target.id))
              throw new Error('The device wrote a sample to an unexpected slot.');

            const fileItem=buildProvisionalUploadedFileItem({
              nodeId:fileId,
              parentId:soundsParentId,
              fileSize:prepared.data.byteLength,
              fileName:item.file.name
            },{
              deviceFiles:sampleStore.getFiles(),
              normalizeFileName
            });
            sampleStore.upsertFile(fileItem,{
              state:'provisional',
              verification:'provisional',
              preserveMetadata:false
            });

            const localMetadata=prepareSampleLocalMetadata(
              {...metadata,name:normalizeFileName(item.file.name)},
              {
                allowedPlayModes:profile.playModes,
                allowAdvancedMetadata:profile.advancedSampleMetadataWrites,
                barWriteMode:'omit'
              }
            );
            sampleStore.setMetadata(target.id,localMetadata,{verification:'provisional'});

            if(remainingFreeSpace!=null){
              remainingFreeSpace=Math.max(0,remainingFreeSpace-prepared.data.byteLength);
              currentSoundsMetadata={
                ...getSoundsMetadata(),
                free_space_in_bytes:remainingFreeSpace
              };
              setSoundsMetadata(currentSoundsMetadata);
            }

            renderDeviceStats(getSoundsMetadata(),sampleStore.countOccupied());
            sampleStore.setOperation(target.id,{status:'complete',label:'WRITTEN',progress:100});
            successes.push(target.id);
            setGlobalProgress('UPLOAD',((index+1)/targets.length)*100);
          }catch(error){
            clearUploadPending(target.id);
            failures.push({file:item.file,error});
            sampleStore.setOperation(target.id,{status:'failed',label:'FAILED',progress:0});
            logTechnical('UPLOAD '+item.file.name,error);

            const createdId=Number(item.createdId)||0;
            if(createdId&&isConnected()&&!isDeviceUnsafe()){
              try{
                const rollbackMetadataUpdate=waitForMetadataUpdate(soundsParentId);
                await fileOps.deleteFile(createdId);
                await syncMetadataAfterMutation(soundsParentId,rollbackMetadataUpdate,fileOps);
                await assertSlotsDeleted([createdId],fileOps);
                sampleStore.removeFile(createdId);
              }catch(rollbackError){
                logTechnical('UPLOAD ROLLBACK SLOT '+createdId,rollbackError);
              }
            }

            if(isDeviceUnsafe())break;
          }
        }
      });

      renderDeviceStats(getSoundsMetadata(),sampleStore.countOccupied());

      if(successes.length){
        const memory=getMemory();
        memory?.selectSlots?.(successes,{
          activeId:successes[0],
          preview:false,
          navigate:true
        });
        setTimeoutFn(()=>{
          for(const id of successes){
            const current=sampleStore.getSlot(id)?.node;
            if(
              current?.isWritable||
              current?.isDeletable||
              current?.isMovable||
              current?.isPlayable
            )continue;
            void hydrateUploadedFileItem(id);
          }
        },250);
      }

      if(failures.length){
        const names=failures.map(item=>'• '+item.file.name).join('\n');
        showError?.('COULD NOT UPLOAD:\n'+names);
      }

      if(successes.length){
        void refreshSoundsRuntimeMetadata().catch(error=>
          logTechnical('UPLOAD FREE SPACE REFRESH',error)
        );
      }

      return{successes:[...successes],failures:[...failures]};
    }finally{
      for(const item of targets)clearUploadPending(item.slot.id);
      setTimeoutFn(()=>{
        for(const item of targets)sampleStore.clearOperation(item.slot.id);
      },900);
      hideGlobalProgress();
      setMutating(false);
    }
  };

  return{uploadFilesToSlot,hydrateUploadedFileItem};
}

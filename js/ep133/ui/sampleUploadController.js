import{prepareEp133Sample}from '../audio.js?v=20261001-1';
import{stripSampleUploadPrefix}from '../sampleFilesystem.js?v=20261001-1';
import{buildProvisionalUploadedFileItem}from './fileModel.js?v=20261001-1';
import{numberedSampleSlot,planSampleUploadTargets}from './sampleUploadPlan.js?v=20261001-1';

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
  chooseUploadTargets=async()=> 'sequential',
  prepareSample=prepareEp133Sample,
  setTimeoutFn=(callback,delay)=>setTimeout(callback,delay)
}={}){
  let placementChoiceOpen=false;
  const runHydrationTransaction=operation=>typeof withFileTransaction==='function'
    ?withFileTransaction('sample upload hydration',operation)
    :operation({getFileInfo,getFileMetadata});
  const hydrateUploadedFileItem=async nodeId=>{
    try{
      const{info,metadata}=await runHydrationTransaction(async fileOps=>({
        info:await fileOps.getFileInfo(nodeId),
        metadata:await fileOps.getFileMetadata(nodeId)
      }));
      const item=fileItemFromInfo(info);
      if(!item)return;
      sampleStore.upsertFile(item,{state:'ready',verification:'verified'});
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
    if(placementChoiceOpen)throw new Error('Finish or cancel the open upload destination choice first.');
    if(!isConnected())throw new Error('EP device is disconnected.');
    if(!isSynchronized()||!getSoundsParentId())throw new Error('Sample library is still synchronizing.');
    if(!slot||!files?.length)return;

    const audioFiles=Array.from(files).filter(file=>file&&(
      /\.(wav|mp3|aac|ogg|flac|m4a|aif|aiff)$/i.test(file.name)||
      String(file.type||'').startsWith('audio/')
    ));
    if(!audioFiles.length)throw new Error('No supported audio files were found.');

    // No device writes, permissions or mutation flags before user choice.
    // Capture the current session so a disconnected/reconnected device cannot
    // inherit a plan approved for a different session.
    const choiceSession=captureBatchSession();
    const numberedCount=audioFiles.filter(file=>numberedSampleSlot(file.name)!=null).length;
    let mode='sequential';
    if(numberedCount){
      let sequentialPlan=null,numberedPlan=null,sequentialError='',numberedError='';
      try{sequentialPlan=planSampleUploadTargets(audioFiles,{startSlot:slot.id,sampleStore,mode:'sequential'});}
      catch(error){sequentialError=String(error?.message||error);}
      try{numberedPlan=planSampleUploadTargets(audioFiles,{startSlot:slot.id,sampleStore,mode:'numbered'});}
      catch(error){numberedError=String(error?.message||error);}
      placementChoiceOpen=true;
      try{
        mode=await chooseUploadTargets({
          files:audioFiles,numberedCount,sequentialPlan,numberedPlan,sequentialError,numberedError
        });
      }finally{placementChoiceOpen=false;}
      if(mode==null)return{successes:[],failures:[],cancelled:true};
      if(mode!=='numbered'&&mode!=='sequential')throw new Error('Invalid upload destination selection.');
      assertBatchSession(choiceSession);
    }
    // Recompute after the modal: the cached inventory may have changed
    // while the user was deciding. The strict FILE transaction also checks
    // all chosen destination slots against live authoritative FILE LIST.
    // Upload transaction records createdId on each item for rollback tracking.
    // Keep the preview plan immutable, but hand mutable copies to the writer.
    const targets=planSampleUploadTargets(audioFiles,{startSlot:slot.id,sampleStore,mode}).targets.map(item=>({...item}));
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
          // Only the device-facing name changes. The audio File and bytes stay intact.
          // normalizeFileName with stripSlotPrefix=true is limited to 001–999 + space.
          const deviceSampleName=stripSampleUploadPrefix(item.file.name);

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
              ...(prepared.metadata||{}),
              name:deviceSampleName
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
              filename:deviceSampleName,
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
              fileName:deviceSampleName
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
              {...metadata,name:deviceSampleName},
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

import{prepareEp133Sample}from '../audio.js?v=20261001-1';
import{preflightRepitchBatch,prepareMyEpRepitchSample}from '../myEpRepitch.js?v=20261113-1';
import{stripSampleUploadPrefix}from '../sampleFilesystem.js?v=20261001-1';
import{numberedSampleSlot,planSampleUploadTargets}from './sampleUploadPlan.js?v=20261001-1';
import{verifySamplePcm}from './samplePcmVerification.js?v=20261001-1';

export function createSampleUploadController({
  sampleStore,getMemory,
  getSoundsParentId,getSoundFormats,getSoundsMetadata,setSoundsMetadata,
  getActiveDeviceProfile,
  isConnected,isSynchronized,isDeviceUnsafe,
  captureBatchSession,assertBatchSession,getDeviceSessionToken,getDeviceConnectionEpoch,markDeviceUnsafe,
  setMutating,setGlobalProgress,hideGlobalProgress,
  withFileTransaction,assertSlotsEmpty,refreshSoundsRuntimeMetadata,
  uploadSampleToSlot,prepareSampleLocalMetadata,normalizeFileName,
  fileItemFromInfo,getFileInfo,getFileMetadata,getFile,
  renderDeviceStats,
  markUploadPending,clearUploadPending,
  waitForMetadataUpdate,deleteFile,syncMetadataAfterMutation,assertSlotsDeleted,
  logTechnical,showError,
  onUploadTiming=()=>{},clock=()=>performance.now(),
  chooseUploadTargets=async()=> 'sequential',
  prepareSample=prepareEp133Sample,
  prepareRepitchSample=prepareMyEpRepitchSample,
  getRepitchEnabled=()=>false,
  confirmAmbiguousRepitch=async()=>false,
  setTimeoutFn=(callback,delay)=>setTimeout(callback,delay)
}={}){
  let placementChoiceOpen=false;
  const runHydrationTransaction=operation=>typeof withFileTransaction==='function'
    ?withFileTransaction('sample upload hydration',operation)
    :operation({getFileInfo,getFileMetadata});
  const hydrateUploadedFileItem=async nodeId=>{
    try{
      if(sampleStore.getSlot(nodeId)?.verification?.file==='unverified')return;
      const sessionToken=captureBatchSession();
      const{info,metadata}=await runHydrationTransaction(async fileOps=>{
        assertBatchSession(sessionToken);
        const info=await fileOps.getFileInfo(nodeId);
        assertBatchSession(sessionToken);
        const metadata=await fileOps.getFileMetadata(nodeId);
        assertBatchSession(sessionToken);
        return{info,metadata};
      });
      assertBatchSession(sessionToken);
      if(sampleStore.getSlot(nodeId)?.verification?.file==='unverified')return;
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
    :operation({uploadSampleToSlot,deleteFile,getFileInfo,getFileMetadata,getFile});
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
    let approvedSlotIds=null;
    // Every multi-file upload must preview its exact free-slot mapping, not
    // only batches with explicitly numbered names. This includes
    // SpeedUpperCut multi-drag and ordinary clipboard/file batches.
    if(numberedCount || audioFiles.length>1){
      let sequentialPlan=null,numberedPlan=null,sequentialError='',numberedError='';
      try{sequentialPlan=planSampleUploadTargets(audioFiles,{startSlot:slot.id,sampleStore,mode:'sequential'});}
      catch(error){sequentialError=String(error?.message||error);}
      if(numberedCount){
        try{numberedPlan=planSampleUploadTargets(audioFiles,{startSlot:slot.id,sampleStore,mode:'numbered'});}
        catch(error){numberedError=String(error?.message||error);}
      }
      placementChoiceOpen=true;
      try{
        mode=await chooseUploadTargets({
          files:audioFiles,numberedCount,sequentialPlan,numberedPlan,sequentialError,numberedError,
          availableMemoryBytes:getSoundsMetadata()?.free_space_in_bytes,
          repitchEnabled:getRepitchEnabled()===true
        });
      }finally{placementChoiceOpen=false;}
      if(mode==null)return{successes:[],failures:[],cancelled:true};
      if(mode!=='numbered'&&mode!=='sequential')throw new Error('Invalid upload destination selection.');
      assertBatchSession(choiceSession);
      approvedSlotIds=(mode==='numbered'?numberedPlan:sequentialPlan)?.targets.map(item=>item.slot.id);
      if(!approvedSlotIds)throw new Error(
        (mode==='numbered'?numberedError:sequentialError)||
        'Chosen destination mapping is unavailable; no FILE writes started.'
      );
    }
    // Recompute after the modal: the cached inventory may have changed
    // while the user was deciding. The strict FILE transaction also checks
    // all chosen destination slots against live authoritative FILE LIST.
    // Upload transaction records createdId on each item for rollback tracking.
    // Keep the preview plan immutable, but hand mutable copies to the writer.
    const targets=planSampleUploadTargets(audioFiles,{startSlot:slot.id,sampleStore,mode}).targets.map(item=>({...item}));
    if(approvedSlotIds && (targets.length!==approvedSlotIds.length ||
      targets.some((item,index)=>item.slot.id!==approvedSlotIds[index])))
      throw new Error('Sample destination mapping changed after confirmation. Review the batch again; no device write started.');
    // Resolve the entire batch before the first FILE lease/PUT. A malformed
    // input or declined ambiguous -12 origin aborts with no device mutation.
    const repitchMode=getRepitchEnabled()===true;
    const sessionToken=captureBatchSession();
    const connectionEpoch=getDeviceConnectionEpoch();
    const sessionIsCurrent=()=>getDeviceSessionToken()===sessionToken;
    // Transport safety lock invalidates the token but preserves this inventory.
    // A real disconnect/reconnect advances the runtime epoch and must not repaint.
    const ownsInventory=()=>sessionIsCurrent()||
      (isDeviceUnsafe()&&getDeviceConnectionEpoch()===connectionEpoch);
    let approvedLegacy=new Set();
    const preflightStart=clock();
    if(repitchMode){
      placementChoiceOpen=true;
      try{
        approvedLegacy=await preflightRepitchBatch(targets.map(item=>item.file),{
          assertSession:()=>assertBatchSession(sessionToken),
          confirmAmbiguous:confirmAmbiguousRepitch
        });
        if(approvedLegacy===null)return{successes:[],failures:[],cancelled:true};
      }finally{placementChoiceOpen=false;}
    }
    assertBatchSession(sessionToken);
    const preflightMs=repitchMode?Math.max(0,clock()-preflightStart):0;
    const soundsParentId=Number(getSoundsParentId())||0;
    setMutating(true);
    const successes=[];
    const failures=[];
    const unverifiedSlots=new Set();

    try{
      // One independent guarded FILE transaction per sample. Other uploads
      // cannot run until this sample's device readback has been verified.
      // Failures stay attached to their own queue row and do not abort later
      // files unless the FILE session itself is unsafe.
      let currentSoundsMetadata=getSoundsMetadata();
      let remainingFreeSpace=Number(currentSoundsMetadata?.free_space_in_bytes);
      for(let index=0;index<targets.length;index++){
        assertBatchSession(sessionToken);
        const item=targets[index];
        const target=item.slot;
        let uploadTiming=null;
        let stopBatch=false;
        let completedUpload=null;
        let recoverableFailure=null;
        try{
          await runUploadTransaction(async fileOps=>{
              assertBatchSession(sessionToken);
              await assertSlotsEmpty([target.id],fileOps);
              assertBatchSession(sessionToken);
              const latestSounds=await refreshSoundsRuntimeMetadata(fileOps);
              assertBatchSession(sessionToken);
              remainingFreeSpace=Number(latestSounds?.free_space_in_bytes);
              if(!Number.isFinite(remainingFreeSpace)||remainingFreeSpace<0)remainingFreeSpace=null;
          // Only the device-facing name changes. The audio File and bytes stay intact.
          // The shared slot prefix parser accepts 1–999 + whitespace or underscore.
          const deviceSampleName=stripSampleUploadPrefix(item.file.name);

          try{
            sampleStore.setOperation(target.id,{status:'preparing',label:'PREPARING',progress:0});
            const preparingStart=clock();
            const prepareAudio=repitchMode?prepareRepitchSample:prepareSample;
            const prepared=await prepareAudio(item.file,{
              formats:getSoundFormats(),
              ...(repitchMode?{confirmAmbiguous:async()=>{
                return approvedLegacy.has(item.file);
              }}:{}),
              onProgress:(value,info)=>{
                assertBatchSession(sessionToken);
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
            const preparingMs=Math.max(0,clock()-preparingStart);
            const expectedPcm=prepared.data;
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
            const uploadingStart=clock();
            let createdId=null;
            markUploadPending(target.id);

            const profile=getActiveDeviceProfile();
            const fileId=await fileOps.uploadSampleToSlot({
              file:item.file,
              data:expectedPcm,
              filename:deviceSampleName,
              parentId:soundsParentId,
              destinationId:target.id,
              metadata,
              allowedPlayModes:profile.playModes,
              allowAdvancedMetadata:profile.advancedSampleMetadataWrites,
              barWriteMode:'omit',
              onCreated:id=>{
                assertBatchSession(sessionToken);
                createdId=Number(id)||target.id;
                item.createdId=createdId;
              },
              onProgress:(done,total)=>{
                assertBatchSession(sessionToken);
                const local=total?done/total:0;
                sampleStore.setOperation(target.id,{
                  status:'uploading',
                  label:'UPLOADING',
                  progress:local*100
                });
                setGlobalProgress('UPLOAD',((index+.35+local*.50)/targets.length)*100);
              }
            });

            assertBatchSession(sessionToken);
            const uploadingMs=Math.max(0,clock()-uploadingStart);
            const verifyingStart=clock();
            if(Number(fileId)!==Number(target.id))
              throw new Error('The device wrote a sample to an unexpected slot.');

            // Confirm the device's actual FILE record and metadata before
            // advancing the queue or telling the user this file completed.
            const info=await fileOps.getFileInfo(fileId);
            assertBatchSession(sessionToken);
            const actual=await fileOps.getFileMetadata(fileId);
            assertBatchSession(sessionToken);
            const fileItem=fileItemFromInfo(info);
            if(!fileItem||Number(fileItem.nodeId)!==Number(target.id)||
              !fileItem.fileName.startsWith('/sounds/')||fileItem.fileName.slice(8).includes('/'))
              throw new Error('Uploaded sample did not appear in the expected /sounds slot.');
            if(Number(fileItem.fileSize)!==prepared.data.byteLength)
              throw new Error('Uploaded sample size differs from device readback.');
            if(String(actual?.name||'')!==normalizeFileName(deviceSampleName))
              throw new Error('Uploaded sample name differs from device metadata readback.');
            if(Number(actual?.channels)!==Number(prepared.channels)||
              Number(actual?.samplerate)!==Number(prepared.samplerate))
              throw new Error('Uploaded sample audio parameters differ from device readback.');

            sampleStore.setOperation(target.id,{status:'verifying',label:'VERIFYING',progress:0});
            setGlobalProgress('VERIFY',((index+.85)/targets.length)*100);
            try{
              await verifySamplePcm(fileOps,fileId,expectedPcm,{
                assertSession:()=>assertBatchSession(sessionToken),
                onProgress:(done,total)=>{
                  const local=total?done/total:0;
                  sampleStore.setOperation(target.id,{status:'verifying',label:'VERIFYING',progress:local*100});
                  setGlobalProgress('VERIFY',((index+.85+local*.14)/targets.length)*100);
                }
              });
            }catch(error){
              stopBatch=true;
              unverifiedSlots.add(target.id);
              if(ownsInventory()){
                sampleStore.upsertFile(fileItem,{state:'unverified',verification:'unverified',preserveMetadata:false});
                sampleStore.setOperation(target.id,{status:'failed',label:'UNVERIFIED',progress:0});
                if(!isDeviceUnsafe())markDeviceUnsafe('UPLOAD destination PCM readback was not verified.');
              }
              throw new Error('UPLOAD PCM verification failed: '+String(error?.message||error),{cause:error});
            }
            const verifyingMs=Math.max(0,clock()-verifyingStart);
            completedUpload={fileItem,actual,byteLength:expectedPcm.byteLength};
            uploadTiming={slot:target.id,preflightMs,preparingMs,uploadingMs,verifyingMs};
          }catch(error){
            // PCM failures must reach the recovery journal, never legacy rollback.
            // Keep existing per-file handling for clean pre-readback failures.
            if(stopBatch||!sessionIsCurrent())throw error;
            const createdId=Number(item.createdId)||0;
            if(createdId&&isConnected()&&!isDeviceUnsafe()){
              try{
                assertBatchSession(sessionToken);
                const rollbackMetadataUpdate=waitForMetadataUpdate(soundsParentId);
                await fileOps.deleteFile(createdId);
                assertBatchSession(sessionToken);
                await syncMetadataAfterMutation(soundsParentId,rollbackMetadataUpdate,fileOps);
                assertBatchSession(sessionToken);
                await assertSlotsDeleted([createdId],fileOps);
                assertBatchSession(sessionToken);
                sampleStore.removeFile(createdId);
              }catch(rollbackError){
                logTechnical('UPLOAD ROLLBACK SLOT '+createdId,rollbackError);
                stopBatch=true;
                throw rollbackError;
              }
            }
            recoverableFailure=error;
            }
          });
          assertBatchSession(sessionToken);
          if(recoverableFailure){
            failures.push({file:item.file,error:recoverableFailure});
            sampleStore.setOperation(target.id,{status:'failed',label:'FAILED',progress:0});
            logTechnical('UPLOAD '+item.file.name,recoverableFailure);
          }else{
          // The strict transaction/journal must also finish before UI success.
          sampleStore.upsertFile(completedUpload.fileItem,{state:'ready',verification:'verified',preserveMetadata:false});
          sampleStore.setMetadata(target.id,completedUpload.actual,{verification:'verified'});
          if(remainingFreeSpace!=null){
            remainingFreeSpace=Math.max(0,remainingFreeSpace-completedUpload.byteLength);
            currentSoundsMetadata={...getSoundsMetadata(),free_space_in_bytes:remainingFreeSpace};
            setSoundsMetadata(currentSoundsMetadata);
          }
          renderDeviceStats(getSoundsMetadata(),sampleStore.countOccupied());
          sampleStore.setOperation(target.id,{status:'complete',label:'WRITTEN',progress:100});
          successes.push(target.id);
          setGlobalProgress('UPLOAD',((index+1)/targets.length)*100);
          if(uploadTiming){
            try{onUploadTiming(uploadTiming);}
            catch{/* Optional diagnostics must not turn a verified upload into a failure. */}
          }
          }
        }catch(error){
          if(completedUpload){
            stopBatch=true;
            unverifiedSlots.add(target.id);
            if(ownsInventory()){
              sampleStore.upsertFile(completedUpload.fileItem,{state:'unverified',verification:'unverified',preserveMetadata:false});
              sampleStore.setOperation(target.id,{status:'failed',label:'UNVERIFIED',progress:0});
              if(!isDeviceUnsafe())markDeviceUnsafe('UPLOAD transaction did not finalize successfully.');
            }
          }
          failures.push({file:item.file,error});
          if(sessionIsCurrent()&&!unverifiedSlots.has(target.id))
            sampleStore.setOperation(target.id,{status:'failed',label:'FAILED',progress:0});
          logTechnical('UPLOAD QUEUE '+item.file.name,error);
        }
        if(stopBatch||isDeviceUnsafe()||!sessionIsCurrent())break;
      }

      renderDeviceStats(getSoundsMetadata(),sampleStore.countOccupied());

      if(successes.length&&sessionIsCurrent()&&!isDeviceUnsafe()){
        const memory=getMemory();
        memory?.selectSlots?.(successes,{
          activeId:successes[0],
          preview:false,
          navigate:true
        });
        setTimeoutFn(()=>{
          if(!sessionIsCurrent()||isDeviceUnsafe())return;
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

      if(successes.length&&sessionIsCurrent()&&!isDeviceUnsafe()){
        void refreshSoundsRuntimeMetadata().catch(error=>
          logTechnical('UPLOAD FREE SPACE REFRESH',error)
        );
      }

      return{successes:[...successes],failures:[...failures]};
    }finally{
      for(const item of targets)clearUploadPending(item.slot.id);
      setTimeoutFn(()=>{
        if(!sessionIsCurrent())return;
        for(const item of targets){
          if(!unverifiedSlots.has(item.slot.id))sampleStore.clearOperation(item.slot.id);
        }
      },900);
      hideGlobalProgress();
      setMutating(false);
    }
  };

  return{uploadFilesToSlot,hydrateUploadedFileItem};
}

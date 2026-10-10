import{prioritizeSampleSlots}from '../sampleStore.js?v=20261001-1';
import{EP_SAMPLE_PAGE_SIZE}from '../sampleMemory.js?v=20261001-1';

export function createSampleLibrarySyncController({
  captureBatchSession,assertBatchSession,
  getMemory,getActiveDeviceProfile,sampleStore,
  withFileTransaction,listDirectory,getFileMetadata,
  setSynchronized,setMetadataHydrating,
  updateMutationAvailability,closeProperties,
  setGlobalProgress,hideGlobalProgress,renderDeviceStats,setStatus,
  reportError,logTechnical,
  scheduleHide=(callback,delay)=>setTimeout(callback,delay)
}={}){
  const runBootstrap=operation=>typeof withFileTransaction==='function'
    ?withFileTransaction('sample library bootstrap',operation)
    :operation({listDirectory,getFileMetadata});
  let readGeneration=0;
  const readDevice=async()=>{
    const generation=++readGeneration;
    const memory=getMemory();
    const activeDeviceProfile=getActiveDeviceProfile();
    const sessionToken=captureBatchSession();
    const preferredSelectedId=memory.getSelected()?.id||null;
    const preferredTabIndex=memory.getActiveTab();
    let lastListPage=null;
    let previewRootEntries=[];
    const streamedSoundEntries=[];
    const assertCurrent=()=>{
      if(generation!==readGeneration)throw new Error('Sample library read was superseded.');
      assertBatchSession(sessionToken);
    };
    const isCurrent=()=>{
      try{assertCurrent();return true;}catch{return false;}
    };
    const onSoundsPage=progress=>{
      assertCurrent();
      lastListPage=progress;
      if(progress.done)return;
      setGlobalProgress('SOUNDS · '+progress.total+' FILES · PAGE '+(progress.page+1),4);
      setStatus('READING SAMPLE LIBRARY · '+progress.total+' FILES');
    };
    // Official EP Sample Tool emits each FILE_LIST item and paints groups of
    // 29 before it begins metadata hydration. Keep the FILE lock until the
    // whole listing finishes; read/write actions stay disabled during bootstrap.
    const onSoundEntry=entry=>{
      assertCurrent();
      streamedSoundEntries.push(entry);
      if(streamedSoundEntries.length%EP_SAMPLE_PAGE_SIZE===0){
        sampleStore.replaceFiles([...previewRootEntries,...streamedSoundEntries]);
        renderDeviceStats({},sampleStore.countOccupied());
      }
    };

    setSynchronized(false);
    setMetadataHydrating(false);
    updateMutationAvailability();
    closeProperties();
    setGlobalProgress('SYNC',0);

    try{
      memory.setTabs(activeDeviceProfile.fallbackTabs);
      sampleStore.resetInventory({preserveMetadata:true});
      renderDeviceStats({},0);

      sampleStore.setSoundsParentId(0);
      sampleStore.setSoundsMetadata({});

      const{rootEntries,soundsParentId,soundEntries,soundsMetadata}=await runBootstrap(async fileOps=>{
        assertCurrent();
        const rootEntries=await fileOps.listDirectory(0,'/');
        assertCurrent();
        previewRootEntries=rootEntries;
        const soundsRoot=rootEntries.find(item=>item.fileName==='/sounds'&&item.fileType==='folder');
        const soundsParentId=Number(soundsRoot?.nodeId)||0;
        if(!soundsParentId)throw new Error('The /sounds library was not found on the device.');

        const soundEntries=await fileOps.listDirectory(soundsParentId,'/sounds',onSoundsPage,onSoundEntry);
        assertCurrent();
        const soundsMetadata=await fileOps.getFileMetadata(soundsParentId);
        assertCurrent();
        return{rootEntries,soundsParentId,soundEntries,soundsMetadata};
      });

      sampleStore.setSoundsParentId(soundsParentId);
      setGlobalProgress('SYNC',4);
      sampleStore.replaceFiles([...rootEntries,...soundEntries]);
      renderDeviceStats({},sampleStore.countOccupied());
      setGlobalProgress('SYNC',8);
      sampleStore.setSoundsMetadata(soundsMetadata);

      const activeTabs=Array.isArray(soundsMetadata?.tabs)&&soundsMetadata.tabs.length
        ?soundsMetadata.tabs
        :activeDeviceProfile.fallbackTabs;
      memory.setTabs(activeTabs);

      const occupied=sampleStore.getSlots().filter(slot=>slot.file);
      renderDeviceStats(soundsMetadata,occupied.length);

      const activeRange=activeTabs?.[preferredTabIndex]?.range||null;
      const ordered=prioritizeSampleSlots(occupied,{selectedId:preferredSelectedId,activeRange});
      const pending=[];
      let loaded=0,cached=0;

      for(const slot of ordered){
        const metadata=sampleStore.getCachedMetadata(slot);
        if(metadata){
          sampleStore.setMetadata(slot.id,metadata,{verification:'cached'});
          loaded+=1;
          cached+=1;
        }else pending.push(slot);
      }

      setMetadataHydrating(pending.length>0);
      setSynchronized(true);
      updateMutationAvailability();
      setGlobalProgress('SYNC',8+(loaded/Math.max(1,occupied.length))*92);
      if(pending.length)
        setStatus('SYNCED · '+occupied.length+' SAMPLES · LOADING '+pending.length+' METADATA · '+cached+' CACHED');

      for(const slot of pending){
        assertCurrent();
        try{
          const metadata=await getFileMetadata(slot.nodeId);
          sampleStore.setMetadata(slot.id,metadata);
        }catch(error){
          logTechnical('METADATA SLOT '+slot.id,error);
        }
        assertCurrent();
        loaded+=1;
        setGlobalProgress('SYNC',8+(loaded/Math.max(1,occupied.length))*92);
        if(loaded%8===0)await new Promise(resolve=>setTimeout(resolve,0));
      }

      setMetadataHydrating(false);
      updateMutationAvailability();
      setGlobalProgress('SYNC',100);
      setStatus('SYNCED · '+occupied.length+' SAMPLES');
    }catch(error){
      if(!isCurrent())return;
      if(lastListPage&&!lastListPage.done)
        logTechnical('SAMPLE LIBRARY LAST FILE_LIST PAGE',new Error(
          'Received '+lastListPage.total+' entries through page '+(lastListPage.page+1)+
          '; next page or /sounds metadata did not finish.'
        ));
      // Incremental rows are only provisional. Never present a partially read
      // directory as the authoritative inventory if any LIST page failed.
      sampleStore.resetInventory({preserveMetadata:true});
      sampleStore.setSoundsParentId(0);
      sampleStore.setSoundsMetadata({});
      renderDeviceStats({},0);
      setMetadataHydrating(false);
      setSynchronized(false);
      updateMutationAvailability();
      setStatus('SAMPLE LIBRARY READ FAILED');
      reportError('COULD NOT READ EP SAMPLE LIBRARY.',error);
    }finally{
      if(isCurrent())scheduleHide(hideGlobalProgress,180);
    }
  };

  return{readDevice};
}

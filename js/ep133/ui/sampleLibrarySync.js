import{prioritizeSampleSlots}from '../sampleStore.js?v=20261001-1';

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
  const readDevice=async()=>{
    const memory=getMemory();
    const activeDeviceProfile=getActiveDeviceProfile();
    const sessionToken=captureBatchSession();
    const preferredSelectedId=memory.getSelected()?.id||null;
    const preferredTabIndex=memory.getActiveTab();
    let lastListPage=null;
    const onSoundsPage=progress=>{
      assertBatchSession(sessionToken);
      lastListPage=progress;
      if(progress.done)return;
      // The reference EP Sample Tool consumes FILE_LIST page-by-page. Keep
      // the inventory atomic, but make large-library reads visible per page.
      setGlobalProgress('SOUNDS · '+progress.total+' FILES · PAGE '+(progress.page+1),4);
      setStatus('READING SAMPLE LIBRARY · '+progress.total+' FILES');
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
        const rootEntries=await fileOps.listDirectory(0,'/');
        assertBatchSession(sessionToken);
        const soundsRoot=rootEntries.find(item=>item.fileName==='/sounds'&&item.fileType==='folder');
        const soundsParentId=Number(soundsRoot?.nodeId)||0;
        if(!soundsParentId)throw new Error('The /sounds library was not found on the device.');

        const soundEntries=await fileOps.listDirectory(soundsParentId,'/sounds',onSoundsPage);
        assertBatchSession(sessionToken);
        const soundsMetadata=await fileOps.getFileMetadata(soundsParentId);
        assertBatchSession(sessionToken);
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
        assertBatchSession(sessionToken);
        try{
          const metadata=await getFileMetadata(slot.nodeId);
          sampleStore.setMetadata(slot.id,metadata);
        }catch(error){
          logTechnical('METADATA SLOT '+slot.id,error);
        }
        loaded+=1;
        setGlobalProgress('SYNC',8+(loaded/Math.max(1,occupied.length))*92);
        if(loaded%8===0)await new Promise(resolve=>setTimeout(resolve,0));
      }

      setMetadataHydrating(false);
      updateMutationAvailability();
      setGlobalProgress('SYNC',100);
      setStatus('SYNCED · '+occupied.length+' SAMPLES');
    }catch(error){
      if(lastListPage&&!lastListPage.done)
        logTechnical('SAMPLE LIBRARY LAST FILE_LIST PAGE',new Error(
          'Received '+lastListPage.total+' entries through page '+(lastListPage.page+1)+
          '; next page or /sounds metadata did not finish.'
        ));
      setMetadataHydrating(false);
      setSynchronized(false);
      updateMutationAvailability();
      reportError('COULD NOT READ EP SAMPLE LIBRARY.',error);
    }finally{
      scheduleHide(hideGlobalProgress,180);
    }
  };

  return{readDevice};
}

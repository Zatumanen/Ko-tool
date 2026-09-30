import{prioritizeSampleSlots}from '../sampleStore.js?v=20260930-5';

export function createSampleLibrarySyncController({
  captureBatchSession,assertBatchSession,
  getMemory,getActiveDeviceProfile,sampleStore,
  listDirectory,getFileMetadata,
  setSynchronized,setMetadataHydrating,
  setSoundsParentId,setSoundFormats,setSoundsMetadata,
  updateMutationAvailability,closeProperties,
  setGlobalProgress,hideGlobalProgress,renderDeviceStats,setStatus,
  reportError,logTechnical,
  scheduleHide=(callback,delay)=>setTimeout(callback,delay)
}={}){
  const readDevice=async()=>{
    const memory=getMemory();
    const activeDeviceProfile=getActiveDeviceProfile();
    const sessionToken=captureBatchSession();
    const preferredSelectedId=memory.getSelected()?.id||null;
    const preferredTabIndex=memory.getActiveTab();

    setSynchronized(false);
    setMetadataHydrating(false);
    updateMutationAvailability();
    closeProperties();
    setGlobalProgress('SYNC',0);

    try{
      memory.setTabs(activeDeviceProfile.fallbackTabs);
      sampleStore.resetInventory({preserveMetadata:true});
      renderDeviceStats({},0);

      setSoundsParentId(0);
      setSoundFormats([]);
      setSoundsMetadata({});

      const rootEntries=await listDirectory(0,'/');
      assertBatchSession(sessionToken);
      const soundsRoot=rootEntries.find(item=>item.fileName==='/sounds'&&item.fileType==='folder');
      const soundsParentId=Number(soundsRoot?.nodeId)||0;
      setSoundsParentId(soundsParentId);
      if(!soundsParentId)throw new Error('The /sounds library was not found on the device.');

      setGlobalProgress('SYNC',4);
      const soundEntries=await listDirectory(soundsParentId,'/sounds');
      assertBatchSession(sessionToken);

      sampleStore.replaceFiles([...rootEntries,...soundEntries]);
      renderDeviceStats({},sampleStore.countOccupied());
      setGlobalProgress('SYNC',8);

      const soundsMetadata=await getFileMetadata(soundsParentId);
      assertBatchSession(sessionToken);
      setSoundsMetadata(soundsMetadata);

      const soundFormats=Array.isArray(soundsMetadata?.formats)?soundsMetadata.formats:[];
      setSoundFormats(soundFormats);

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

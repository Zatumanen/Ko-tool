import{
  PROPERTY_DEBOUNCE_MS,renderSampleProperties,getSamplePropertyChange
}from '../sampleProperties.js?v=20260930-5';

export function createSamplePropertiesController({
  properties,propertiesGrid,
  getMemory,getActiveDeviceProfile,
  isConnected,isSynchronized,isMetadataHydrating,isMutating,
  setFileMetadata,getFileMetadata,sampleMetadataCache,
  showError,logTechnical,escapeHtml=String,
  documentRef=globalThis.document,windowRef=globalThis.window,
  setTimeoutFn=(callback,delay)=>setTimeout(callback,delay),
  clearTimeoutFn=timer=>clearTimeout(timer),
  debounceMs=PROPERTY_DEBOUNCE_MS
}={}){
  let currentPropertySlotId=null;
  const propertyStates=new Map();
  const pendingPropertyKeys=new Set();

  const propertyStateId=(slotId,key)=>String(slotId)+':'+key;
  const isPropertyPending=(slotId,key)=>pendingPropertyKeys.has(propertyStateId(slotId,key));

  const render=slot=>{
    if(!propertiesGrid||!slot?.file)return;
    const profile=getActiveDeviceProfile();
    propertiesGrid.innerHTML=renderSampleProperties(slot,{
      playModes:profile.playModes,
      barPolicy:profile.sampleBars,
      isPending:key=>isPropertyPending(slot.id,key),
      escapeHtml
    });
  };

  const renderCurrent=()=>{
    if(!currentPropertySlotId)return;
    const slot=getMemory()?.getSlot?.(currentPropertySlotId);
    if(slot?.file)render(slot);
  };

  const renderIfCurrent=slotId=>{
    if(Number(currentPropertySlotId)!==Number(slotId))return;
    renderCurrent();
  };

  const close=()=>{
    if(properties)properties.hidden=true;
    currentPropertySlotId=null;
  };

  const position=event=>{
    if(!properties||!event)return;
    properties.hidden=false;
    const gap=8;
    const rect=properties.getBoundingClientRect();
    let left=event.clientX+gap;
    let top=event.clientY+gap;
    if(left+rect.width>windowRef.innerWidth-gap)left=event.clientX-rect.width-gap;
    if(top+rect.height>windowRef.innerHeight-gap)top=windowRef.innerHeight-rect.height-gap;
    properties.style.left=Math.max(gap,left)+'px';
    properties.style.top=Math.max(gap,top)+'px';
  };

  const open=(slot,event)=>{
    const profile=getActiveDeviceProfile();
    if(!slot?.file||!isConnected()||!isSynchronized()||isMetadataHydrating()||isMutating())return;
    if(!profile.advancedSampleMetadataWrites){
      close();
      showError?.('SAMPLE PROPERTIES ARE NOT VERIFIED FOR '+(profile.name||'THIS EP')+'.');
      return;
    }
    currentPropertySlotId=slot.id;
    render(slot);
    position(event);
  };

  const flushPropertyWrite=async id=>{
    const state=propertyStates.get(id);
    if(!state)return;
    if(state.inFlight){
      state.timer=setTimeoutFn(()=>flushPropertyWrite(id),debounceMs);
      return;
    }

    const memory=getMemory();
    const slot=memory?.getSlot?.(state.slotId);
    if(!slot?.file||!isConnected()){
      pendingPropertyKeys.delete(id);
      propertyStates.delete(id);
      return;
    }

    state.inFlight=true;
    const version=state.version;
    const sentValue=state.desired;
    const sentExtra={...state.extra};

    try{
      const payload={[state.key]:sentValue,...sentExtra};
      if(state.key==='sound.playmode'){
        const release=Number(slot.meta?.['envelope.release']);
        payload['envelope.release']=Number.isFinite(release)?release:255;
      }

      await setFileMetadata(slot.nodeId||slot.id,payload);
      const readback=await getFileMetadata(slot.nodeId||slot.id);

      for(const[key,value]of Object.entries(payload)){
        const got=readback?.[key];
        const matches=typeof value==='number'?Number(got)===Number(value):String(got)===String(value);
        if(!matches)throw new Error('EP did not confirm sample property '+key+'.');
      }

      memory.setMetadata(slot.id,readback);
      sampleMetadataCache.set(memory.getSlot(slot.id),readback);
      state.committed=readback?.[state.key]??sentValue;

      if(state.version!==version){
        memory.mergeMetadata(slot.id,{[state.key]:state.desired,...state.extra});
        state.inFlight=false;
        clearTimeoutFn(state.timer);
        state.timer=setTimeoutFn(()=>flushPropertyWrite(id),40);
        renderIfCurrent(slot.id);
        return;
      }

      pendingPropertyKeys.delete(id);
      propertyStates.delete(id);
    }catch(error){
      logTechnical?.('PROPERTY '+state.key,error);
      let restored=null;
      try{
        restored=await getFileMetadata(slot.nodeId||slot.id);
      }catch(readbackError){
        logTechnical?.('PROPERTY READBACK '+state.key,readbackError);
      }

      if(restored){
        memory.setMetadata(slot.id,restored);
        sampleMetadataCache.set(memory.getSlot(slot.id),restored);
      }else{
        memory.mergeMetadata(slot.id,{[state.key]:state.committed});
      }

      pendingPropertyKeys.delete(id);
      propertyStates.delete(id);
      showError?.('COULD NOT UPDATE SAMPLE PROPERTY.');
    }finally{
      const latest=propertyStates.get(id);
      if(latest)latest.inFlight=false;
      renderIfCurrent(slot.id);
    }
  };

  const scheduleWrite=(slot,key,value,extra={})=>{
    const profile=getActiveDeviceProfile();
    if(!slot?.file||!isConnected()||!isSynchronized()||isMutating()||!profile.advancedSampleMetadataWrites)return;

    const id=propertyStateId(slot.id,key);
    let state=propertyStates.get(id);
    if(!state){
      state={
        slotId:slot.id,key,
        committed:slot.meta?.[key],
        desired:value,
        extra:{...extra},
        timer:null,
        inFlight:false,
        version:0
      };
      propertyStates.set(id,state);
    }

    state.desired=value;
    state.extra={...extra};
    state.version+=1;
    clearTimeoutFn(state.timer);
    pendingPropertyKeys.add(id);

    const memory=getMemory();
    memory.mergeMetadata(slot.id,{[key]:value,...extra});
    renderIfCurrent(slot.id);
    state.timer=setTimeoutFn(()=>flushPropertyWrite(id),debounceMs);
  };

  const change=(slot,key,direction)=>{
    const profile=getActiveDeviceProfile();
    if(!slot?.file||slot.node?.isWritable!==true||!profile.advancedSampleMetadataWrites)return;
    if(key==='sound.bars'&&profile.sampleBars?.authoring!==true)return;

    const result=getSamplePropertyChange(slot,key,direction,{
      playModes:profile.playModes,
      barPolicy:profile.sampleBars
    });
    if(result)scheduleWrite(slot,key,result.value,result.extra);
  };

  propertiesGrid?.addEventListener('click',event=>{
    const button=event.target.closest('[data-property]');
    if(!button||!currentPropertySlotId)return;
    const slot=getMemory()?.getSlot?.(currentPropertySlotId);
    change(slot,button.dataset.property,Number(button.dataset.direction)||0);
  });

  propertiesGrid?.addEventListener('pointerdown',event=>{
    const value=event.target.closest('[data-drag="bpm"]');
    if(!value||!currentPropertySlotId)return;
    event.preventDefault();

    const slotId=currentPropertySlotId;
    const slot=getMemory()?.getSlot?.(slotId);
    const startY=event.clientY;
    const startValue=Number(slot?.meta?.['sound.bpm'])>0?Math.round(Number(slot.meta['sound.bpm'])):120;
    let lastValue=startValue;

    const move=moveEvent=>{
      const delta=Math.round((startY-moveEvent.clientY)/3);
      const next=Math.max(1,Math.min(200,startValue+delta));
      if(next===lastValue)return;
      lastValue=next;
      const current=getMemory()?.getSlot?.(slotId);
      if(current)scheduleWrite(current,'sound.bpm',next);
    };

    const stop=()=>{
      documentRef.removeEventListener('pointermove',move);
      documentRef.removeEventListener('pointerup',stop);
      documentRef.removeEventListener('pointercancel',stop);
    };

    documentRef.addEventListener('pointermove',move);
    documentRef.addEventListener('pointerup',stop,{once:true});
    documentRef.addEventListener('pointercancel',stop,{once:true});
  });

  return{
    close,open,render,renderCurrent,renderIfCurrent,
    scheduleWrite,flushPropertyWrite,change,
    hasPendingWrites:()=>pendingPropertyKeys.size>0,
    getPendingCount:()=>pendingPropertyKeys.size,
    getCurrentSlotId:()=>currentPropertySlotId,
    remapCurrentSlot(oldId,newId){
      if(Number(currentPropertySlotId)===Number(oldId)&&Number(oldId)!==Number(newId))
        currentPropertySlotId=Number(newId);
    }
  };
}

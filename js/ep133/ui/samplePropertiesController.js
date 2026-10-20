import{
  PROPERTY_DEBOUNCE_MS,renderSampleProperties,getSamplePropertyChange
}from '../sampleProperties.js?v=20261001-1';

export function createSamplePropertiesController({
  properties,propertiesGrid,
  sampleStore,getActiveDeviceProfile,
  isConnected,isSynchronized,isMetadataHydrating,isMutating,
  withFileTransaction,
  captureBatchSession,assertBatchSession,
  showError,logTechnical,escapeHtml=String,
  documentRef=globalThis.document,windowRef=globalThis.window,
  setTimeoutFn=(callback,delay)=>setTimeout(callback,delay),
  clearTimeoutFn=timer=>clearTimeout(timer),
  debounceMs=PROPERTY_DEBOUNCE_MS
}={}){
  let currentPropertySlotId=null;
  let propertyAnchor=null;
  let stopPropertyDrag=null;
  const runPropertyTransaction=operation=>{
    if(typeof withFileTransaction!=='function')
      throw new Error('Sample property writes require a strict FILE transaction.');
    return withFileTransaction('sample property write',operation,{strict:true});
  };
  const propertyStates=new Map();
  const pendingPropertyKeys=new Set();
  const propertyResults=new Map();

  const propertyStateId=(slotId,key)=>String(slotId)+':'+key;
  const isPropertyPending=(slotId,key)=>pendingPropertyKeys.has(propertyStateId(slotId,key));
  const assertCurrentWrite=(id,state)=>{
    if(propertyStates.get(id)!==state)throw new Error('Sample property edit was cancelled.');
    assertBatchSession(state.session);
    const slot=sampleStore?.getSlot?.(state.slotId);
    if(!slot?.file||slot.node?.isWritable!==true||!isConnected()||!isSynchronized()||
      isMetadataHydrating()||isMutating()||!getActiveDeviceProfile().advancedSampleMetadataWrites)
      throw new Error('Sample metadata changes are not currently permitted.');
  };

  const render=slot=>{
    if(!propertiesGrid||!slot?.file)return;
    const profile=getActiveDeviceProfile();
    propertiesGrid.innerHTML='<div class="ep133-properties-scope">SAMPLE LIBRARY<br>ASSIGNED PADS KEEP THEIR OWN SETTINGS.</div>'+renderSampleProperties(slot,{
      playModes:profile.playModes,
      barPolicy:profile.sampleBars,
      isPending:key=>isPropertyPending(slot.id,key),
      escapeHtml
    });
    const pending=[...propertyStates.values()].some(state=>state.slotId===slot.id);
    const results=[...propertyResults.values()].filter(result=>result.slotId===slot.id);
    const result=results.find(result=>result.error)||results[0];
    const status=pending?'SAVING TO EP…':result?.error?'NOT SAVED · '+result.error:result?'SAVED ON EP':'READY';
    propertiesGrid.innerHTML+='<div class="ep133-properties-status" data-property-status role="status">'+escapeHtml(status)+'</div>';
    if(currentPropertySlotId===slot.id&&propertyAnchor)position(propertyAnchor);
  };

  const renderCurrent=()=>{
    if(!currentPropertySlotId)return;
    const slot=sampleStore?.getSlot?.(currentPropertySlotId);
    if(slot?.file)render(slot);
  };

  const renderIfCurrent=slotId=>{
    if(Number(currentPropertySlotId)!==Number(slotId))return;
    renderCurrent();
  };

  const close=()=>{
    stopPropertyDrag?.();
    if(properties)properties.hidden=true;
    currentPropertySlotId=null;
    propertyAnchor=null;
  };

  const position=event=>{
    if(!properties||!event)return;
    // The translated My EP window creates a containing block for fixed
    // children. Mount the menu at document level so the click's clientX/Y
    // stay in the same (viewport) coordinate space as its CSS position.
    if(documentRef?.body&&properties.parentElement!==documentRef.body)
      documentRef.body.appendChild(properties);
    properties.hidden=false;
    const gap=8;
    const rect=properties.getBoundingClientRect();
    const viewportWidth=windowRef.innerWidth;
    const viewportHeight=windowRef.innerHeight;
    let left=event.clientX+gap;
    let top=event.clientY+gap;
    if(left+rect.width>viewportWidth-gap)left=event.clientX-rect.width-gap;
    if(top+rect.height>viewportHeight-gap)top=event.clientY-rect.height-gap;
    properties.style.left=Math.min(Math.max(gap,viewportWidth-rect.width-gap),Math.max(gap,left))+'px';
    properties.style.top=Math.min(Math.max(gap,viewportHeight-rect.height-gap),Math.max(gap,top))+'px';
  };

  const open=(slot,event)=>{
    const profile=getActiveDeviceProfile();
    const canonical=sampleStore?.getSlot?.(slot?.id)||slot;
    if(!canonical?.file||!isConnected()||!isSynchronized()||isMetadataHydrating()||isMutating())return;
    if(!profile.advancedSampleMetadataWrites){
      close();
      showError?.('SAMPLE PROPERTIES ARE NOT VERIFIED FOR '+(profile.name||'THIS EP')+'.');
      return;
    }
    currentPropertySlotId=canonical.id;
    propertyAnchor=event?{clientX:event.clientX,clientY:event.clientY}:null;
    render(canonical);
    position(event);
  };

  const flushPropertyWrite=async id=>{
    const state=propertyStates.get(id);
    if(!state)return;
    if(state.inFlight){
      state.timer=setTimeoutFn(()=>flushPropertyWrite(id),debounceMs);
      return;
    }

    const slot=sampleStore?.getSlot?.(state.slotId);
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
      assertCurrentWrite(id,state);
      const payload={[state.key]:sentValue,...sentExtra};

      const readback=await runPropertyTransaction(async fileOps=>{
        assertCurrentWrite(id,state);
        if(state.key==='sound.playmode'){
          const release=Number(sampleStore.getSlot(state.slotId)?.meta?.['envelope.release']);
          payload['envelope.release']=Number.isFinite(release)?release:255;
        }
        await fileOps.setFileMetadata(slot.nodeId||slot.id,payload);
        assertCurrentWrite(id,state);
        const readback=await fileOps.getFileMetadata(slot.nodeId||slot.id);
        assertCurrentWrite(id,state);
        for(const[key,value]of Object.entries(payload)){
          const got=readback?.[key];
          const numeric=typeof got==='number'||typeof got==='string'&&got.trim()!=='';
          const matches=typeof value==='number'
            ?numeric&&Number.isFinite(Number(got))&&Number(got)===value
            :typeof got===typeof value&&got===value;
          if(!matches)throw new Error('EP did not confirm sample property '+key+'.');
        }
        return readback;
      });

      assertCurrentWrite(id,state);
      sampleStore.setMetadata(slot.id,readback,{verification:'verified'});
      state.committed=readback?.[state.key]??sentValue;
      propertyResults.set(id,{slotId:slot.id,saved:true});

      if(state.version!==version){
        state.inFlight=false;
        clearTimeoutFn(state.timer);
        state.timer=setTimeoutFn(()=>flushPropertyWrite(id),40);
        renderIfCurrent(slot.id);
        return;
      }

      pendingPropertyKeys.delete(id);
      propertyStates.delete(id);
    }catch(error){
      if(propertyStates.get(id)!==state)return;
      logTechnical?.('PROPERTY '+state.key,error);
      let restored=null;
      try{
        // Never read from a different device to "recover" an old edit.
        assertCurrentWrite(id,state);
        restored=await runPropertyTransaction(async fileOps=>{
          assertCurrentWrite(id,state);
          const readback=await fileOps.getFileMetadata(slot.nodeId||slot.id);
          assertCurrentWrite(id,state);
          return readback;
        });
      }catch(readbackError){
        logTechnical?.('PROPERTY READBACK '+state.key,readbackError);
      }

      if(propertyStates.get(id)!==state)return;
      let currentSession=false;
      try{assertBatchSession(state.session);currentSession=isConnected();}catch{}
      if(restored&&currentSession){
        sampleStore.setMetadata(slot.id,restored,{verification:'verified'});
      }else if(currentSession){
        sampleStore.mergeMetadata(
          slot.id,
          {[state.key]:state.committed},
          {verification:'unknown'}
        );
      }

      pendingPropertyKeys.delete(id);
      propertyStates.delete(id);
      const reason=String(error?.message||error||'Unknown device error.');
      propertyResults.set(id,{slotId:slot.id,error:reason});
      showError?.('COULD NOT UPDATE SAMPLE PROPERTY.\n'+reason);
    }finally{
      const latest=propertyStates.get(id);
      if(latest===state)latest.inFlight=false;
      renderIfCurrent(slot.id);
    }
  };

  const scheduleWrite=(slot,key,value,extra={})=>{
    const profile=getActiveDeviceProfile();
    const canonical=sampleStore?.getSlot?.(slot?.id)||slot;
    if(!canonical?.file||!isConnected()||!isSynchronized()||isMutating()||!profile.advancedSampleMetadataWrites)return;

    const id=propertyStateId(canonical.id,key);
    let state=propertyStates.get(id);
    if(!state){
      let session;
      try{
        if(typeof captureBatchSession!=='function'||typeof assertBatchSession!=='function')
          throw new Error('Sample property writes require a current device session.');
        session=captureBatchSession();assertBatchSession(session);
      }catch(error){
        const reason=String(error?.message||error);
        propertyResults.set(id,{slotId:canonical.id,error:reason});
        showError?.('COULD NOT UPDATE SAMPLE PROPERTY.\n'+reason);
        renderIfCurrent(canonical.id);return;
      }
      state={
        slotId:canonical.id,key,
        committed:canonical.meta?.[key],
        desired:value,
        extra:{...extra},
        timer:null,
        inFlight:false,
        session,
        version:0
      };
      propertyStates.set(id,state);
    }

    state.desired=value;
    state.extra={...extra};
    state.version+=1;
    clearTimeoutFn(state.timer);
    pendingPropertyKeys.add(id);

    propertyResults.delete(id);
    renderIfCurrent(canonical.id);
    state.timer=setTimeoutFn(()=>flushPropertyWrite(id),debounceMs);
  };

  const change=(slot,key,direction)=>{
    const profile=getActiveDeviceProfile();
    const canonical=sampleStore?.getSlot?.(slot?.id)||slot;
    if(!canonical?.file||canonical.node?.isWritable!==true||!profile.advancedSampleMetadataWrites)return;
    if(key==='sound.bars'&&profile.sampleBars?.authoring!==true)return;

    const desiredMeta={...canonical.meta};
    for(const state of propertyStates.values()){
      if(state.slotId===canonical.id)Object.assign(desiredMeta,{[state.key]:state.desired},state.extra);
    }
    const result=getSamplePropertyChange({...canonical,meta:desiredMeta},key,direction,{
      playModes:profile.playModes,
      barPolicy:profile.sampleBars
    });
    if(result)scheduleWrite(canonical,key,result.value,result.extra);
  };

  propertiesGrid?.addEventListener('click',event=>{
    const button=event.target.closest('[data-property]');
    if(!button||!currentPropertySlotId)return;
    const slot=sampleStore?.getSlot?.(currentPropertySlotId);
    change(slot,button.dataset.property,Number(button.dataset.direction)||0);
  });

  propertiesGrid?.addEventListener('pointerdown',event=>{
    const value=event.target.closest('[data-drag="bpm"]');
    if(!value||!currentPropertySlotId)return;
    stopPropertyDrag?.();
    event.preventDefault();

    const slotId=currentPropertySlotId;
    const slot=sampleStore?.getSlot?.(slotId);
    const startY=event.clientY;
    const desired=propertyStates.get(propertyStateId(slotId,'sound.bpm'))?.desired??slot?.meta?.['sound.bpm'];
    const startValue=Number(desired)>0?Math.round(Number(desired)):120;
    let lastValue=startValue;

    const move=moveEvent=>{
      const delta=Math.round((startY-moveEvent.clientY)/3);
      const next=Math.max(1,Math.min(200,startValue+delta));
      if(next===lastValue)return;
      lastValue=next;
      const current=sampleStore?.getSlot?.(slotId);
      if(current)scheduleWrite(current,'sound.bpm',next);
    };

    const stop=()=>{
      documentRef.removeEventListener('pointermove',move);
      documentRef.removeEventListener('pointerup',stop);
      documentRef.removeEventListener('pointercancel',stop);
      if(stopPropertyDrag===stop)stopPropertyDrag=null;
    };

    stopPropertyDrag=stop;
    documentRef.addEventListener('pointermove',move);
    documentRef.addEventListener('pointerup',stop,{once:true});
    documentRef.addEventListener('pointercancel',stop,{once:true});
  });

  return{
    close,open,render,renderCurrent,renderIfCurrent,
    reset(){
      for(const state of propertyStates.values())clearTimeoutFn(state.timer);
      propertyStates.clear();pendingPropertyKeys.clear();propertyResults.clear();close();
    },
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

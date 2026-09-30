import{
  createSampleSlots,findNextFreeSampleSlot,EP_SAMPLE_SLOT_COUNT
}from './sampleMemory.js?v=20260930-5';

const cloneObject=value=>value&&typeof value==='object'?{...value}:null;
const cloneOperation=operation=>operation&&typeof operation==='object'?{...operation}:null;
const cloneVerification=verification=>({
  file:String(verification?.file||'unknown'),
  metadata:String(verification?.metadata||'unknown')
});

const isSoundFile=item=>
  /^\/sounds\/[^/]+$/.test(String(item?.fileName||''))&&
  Number(item?.nodeId)>=1&&Number(item?.nodeId)<=EP_SAMPLE_SLOT_COUNT;

const slotFingerprint=slot=>{
  const id=Number(slot?.nodeId||slot?.id);
  if(!Number.isInteger(id)||id<1||id>EP_SAMPLE_SLOT_COUNT||!slot?.file)return null;
  return id+':'+(Number(slot.file.size)||0)+':'+String(slot.file.path||slot.file.name||'');
};

const cloneSlot=slot=>({
  id:Number(slot?.id),
  nodeId:Number(slot?.nodeId||slot?.id),
  file:cloneObject(slot?.file),
  meta:cloneObject(slot?.meta),
  node:cloneObject(slot?.node),
  state:String(slot?.state||(slot?.file?'ready':'empty')),
  verification:cloneVerification(slot?.verification),
  operation:cloneOperation(slot?.operation)
});

const createCanonicalSlots=files=>createSampleSlots(files).map(slot=>({
  ...slot,
  state:slot.file?'ready':'empty',
  verification:{
    file:slot.file?'verified':'unknown',
    metadata:'unknown'
  },
  operation:null
}));

export function prioritizeSampleSlots(slots,{selectedId=null,activeRange=null}={}){
  const selected=Number(selectedId);
  const range=Array.isArray(activeRange)&&activeRange.length>=2
    ?[Number(activeRange[0]),Number(activeRange[1])]
    :null;
  const rank=slot=>{
    const id=Number(slot?.id);
    if(Number.isInteger(selected)&&id===selected)return 0;
    if(range&&Number.isFinite(range[0])&&Number.isFinite(range[1])&&id>=range[0]&&id<=range[1])return 1;
    return 2;
  };
  return[...(slots||[])].sort((a,b)=>rank(a)-rank(b)||Number(a?.id)-Number(b?.id));
}

export function createSampleStore(){
  let files=[];
  let slots=createCanonicalSlots([]);
  let memory=null;
  const listeners=new Set();
  const metadataHistory=new Map();

  const emit=(type,detail={})=>{
    const event={type,...detail};
    for(const listener of listeners){
      try{listener(event);}catch{}
    }
  };

  const archiveMetadata=slot=>{
    const fingerprint=slotFingerprint(slot);
    if(!fingerprint||!slot?.meta)return;
    metadataHistory.set(fingerprint,{
      metadata:cloneObject(slot.meta),
      verification:String(slot.verification?.metadata||'verified')
    });
  };

  const forgetMetadata=slot=>{
    const fingerprint=slotFingerprint(slot);
    if(fingerprint)metadataHistory.delete(fingerprint);
  };

  const cachedForSlot=slot=>{
    const fingerprint=slotFingerprint(slot);
    if(!fingerprint)return null;
    const cached=metadataHistory.get(fingerprint);
    return cached?{
      metadata:cloneObject(cached.metadata),
      verification:String(cached.verification||'cached')
    }:null;
  };

  const projectSlot=id=>{
    if(!memory)return;
    const slot=slots[Number(id)-1];
    if(!slot)return;
    if(!slot.file){
      memory.clearSlot?.(slot.id);
      return;
    }
    memory.setSlot?.(slot.node);
    memory.setMetadata?.(slot.id,slot.meta||null);
    if(slot.operation)memory.setOperation?.(slot.id,slot.operation);
    else memory.clearOperation?.(slot.id);
  };

  const projectAll=()=>{
    if(!memory)return;
    memory.setSlots?.(slots.map(cloneSlot));
    for(const slot of slots){
      if(slot.operation)memory.setOperation?.(slot.id,slot.operation);
    }
  };

  const replaceFiles=(nextFiles,{preserveMetadata=true}={})=>{
    const previous=slots;
    files=(Array.isArray(nextFiles)?nextFiles:[]).map(item=>({...item}));
    const next=createCanonicalSlots(files);

    for(let index=0;index<next.length;index++){
      const oldSlot=previous[index];
      const newSlot=next[index];
      const oldFingerprint=slotFingerprint(oldSlot);
      const newFingerprint=slotFingerprint(newSlot);
      const same=oldFingerprint!==null&&oldFingerprint===newFingerprint;

      if(oldFingerprint&&oldFingerprint!==newFingerprint)metadataHistory.delete(oldFingerprint);

      if(preserveMetadata&&same&&oldSlot?.meta){
        newSlot.meta=cloneObject(oldSlot.meta);
        newSlot.verification.metadata=oldSlot.verification?.metadata||'verified';
        archiveMetadata(newSlot);
      }else if(preserveMetadata&&newFingerprint){
        const cached=cachedForSlot(newSlot);
        if(cached){
          newSlot.meta=cached.metadata;
          newSlot.verification.metadata=cached.verification;
        }
      }

      if(same&&oldSlot?.operation)newSlot.operation=cloneOperation(oldSlot.operation);
      if(same&&oldSlot?.state==='provisional')newSlot.state='provisional';
    }

    slots=next;

    if(memory){
      for(let id=1;id<=EP_SAMPLE_SLOT_COUNT;id++){
        const oldSlot=previous[id-1];
        const newSlot=slots[id-1];
        const fileChanged=slotFingerprint(oldSlot)!==slotFingerprint(newSlot);
        const metaChanged=JSON.stringify(oldSlot?.meta||null)!==JSON.stringify(newSlot?.meta||null);
        if(fileChanged||metaChanged)projectSlot(id);
      }
    }

    emit('files-replaced',{count:countOccupied()});
    return getFiles();
  };

  const resetInventory=({preserveMetadata=true}={})=>{
    if(preserveMetadata){
      for(const slot of slots)archiveMetadata(slot);
    }else metadataHistory.clear();
    files=[];
    slots=createCanonicalSlots([]);
    projectAll();
    emit('inventory-reset',{preserveMetadata:!!preserveMetadata});
  };

  const upsertFile=(item,{state='ready',verification='verified',preserveMetadata=true}={})=>{
    if(!item)return null;
    const nodeId=Number(item.nodeId);
    const existingIndex=files.findIndex(file=>Number(file.nodeId)===nodeId);
    if(existingIndex>=0)files[existingIndex]={...item};
    else files.push({...item});

    if(nodeId>=1&&nodeId<=EP_SAMPLE_SLOT_COUNT&&isSoundFile(item)){
      const oldSlot=slots[nodeId-1];
      const oldFingerprint=slotFingerprint(oldSlot);
      const next=createCanonicalSlots([item])[nodeId-1];
      const newFingerprint=slotFingerprint(next);
      const same=oldFingerprint!==null&&oldFingerprint===newFingerprint;
      if(oldFingerprint&&oldFingerprint!==newFingerprint)metadataHistory.delete(oldFingerprint);

      if(preserveMetadata&&same&&oldSlot?.meta){
        next.meta=cloneObject(oldSlot.meta);
        next.verification.metadata=oldSlot.verification?.metadata||'verified';
      }else if(preserveMetadata){
        const cached=cachedForSlot(next);
        if(cached){
          next.meta=cached.metadata;
          next.verification.metadata=cached.verification;
        }
      }

      next.state=String(state||'ready');
      next.verification.file=String(verification||'verified');
      next.operation=cloneOperation(oldSlot?.operation);
      slots[nodeId-1]=next;
      projectSlot(nodeId);
    }

    emit('file-upserted',{nodeId});
    return getSlot(nodeId);
  };

  const removeFile=nodeId=>{
    const id=Number(nodeId);
    const previous=slots[id-1];
    forgetMetadata(previous);
    files=files.filter(item=>Number(item.nodeId)!==id);
    if(id>=1&&id<=EP_SAMPLE_SLOT_COUNT){
      slots[id-1]=createCanonicalSlots([])[id-1];
      projectSlot(id);
    }
    emit('file-removed',{nodeId:id});
  };

  const setMetadata=(nodeId,metadata,{verification='verified'}={})=>{
    const id=Number(nodeId);
    const slot=slots[id-1];
    if(!slot)return null;
    slot.meta=cloneObject(metadata);
    slot.verification.metadata=slot.meta?String(verification||'verified'):'unknown';
    if(slot.file&&slot.state==='empty')slot.state='ready';
    if(slot.meta)archiveMetadata(slot);else forgetMetadata(slot);
    memory?.setMetadata?.(id,slot.meta);
    emit('metadata-set',{nodeId:id});
    return cloneObject(slot.meta);
  };

  const mergeMetadata=(nodeId,patch,{verification='verified'}={})=>{
    const id=Number(nodeId);
    const slot=slots[id-1];
    if(!slot)return null;
    slot.meta={...(slot.meta||{}),...(patch||{})};
    slot.verification.metadata=String(verification||'verified');
    archiveMetadata(slot);
    memory?.mergeMetadata?.(id,patch||{});
    emit('metadata-merged',{nodeId:id});
    return cloneObject(slot.meta);
  };

  const invalidateMetadata=nodeId=>{
    const id=Number(nodeId);
    const slot=slots[id-1];
    if(!slot)return;
    forgetMetadata(slot);
    slot.meta=null;
    slot.verification.metadata='unknown';
    memory?.setMetadata?.(id,null);
    emit('metadata-invalidated',{nodeId:id});
  };

  const getCachedMetadata=slot=>{
    const cached=cachedForSlot(slot);
    return cached?cloneObject(cached.metadata):null;
  };

  const asMetadataCache=()=>({
    get:slot=>getCachedMetadata(slot),
    set:(slot,metadata)=>{
      const id=Number(slot?.nodeId||slot?.id);
      if(!Number.isInteger(id))return null;
      return setMetadata(id,metadata);
    },
    merge:(slot,patch)=>{
      const id=Number(slot?.nodeId||slot?.id);
      if(!Number.isInteger(id))return null;
      return mergeMetadata(id,patch);
    },
    invalidate:id=>invalidateMetadata(id),
    clear:()=>metadataHistory.clear(),
    size:()=>metadataHistory.size
  });

  const setOperation=(nodeId,operation)=>{
    const id=Number(nodeId);
    const slot=slots[id-1];
    if(!slot)return;
    slot.operation=cloneOperation(operation);
    if(slot.operation)memory?.setOperation?.(id,slot.operation);
    else memory?.clearOperation?.(id);
    emit('operation-set',{nodeId:id});
  };

  const clearOperation=nodeId=>setOperation(nodeId,null);
  const clearOperations=()=>{
    for(const slot of slots)slot.operation=null;
    memory?.clearOperations?.();
    emit('operations-cleared');
  };

  const setVerification=(nodeId,patch={})=>{
    const id=Number(nodeId);
    const slot=slots[id-1];
    if(!slot)return null;
    slot.verification={
      ...slot.verification,
      ...Object.fromEntries(Object.entries(patch).map(([key,value])=>[key,String(value)]))
    };
    emit('verification-set',{nodeId:id});
    return cloneVerification(slot.verification);
  };

  const setState=(nodeId,state)=>{
    const id=Number(nodeId);
    const slot=slots[id-1];
    if(!slot)return;
    slot.state=String(state||(slot.file?'ready':'empty'));
    emit('state-set',{nodeId:id,state:slot.state});
  };

  const moveLocal=(oldNodeId,item,{metadata=null,state='ready',verification='verified'}={})=>{
    const oldId=Number(oldNodeId),newId=Number(item?.nodeId);
    if(!Number.isInteger(oldId)||!Number.isInteger(newId)||!item)return null;
    const oldSlot=slots[oldId-1];
    const oldOperation=oldSlot?.operation||null;
    forgetMetadata(oldSlot);
    forgetMetadata(slots[newId-1]);
    files=files.filter(file=>Number(file.nodeId)!==oldId&&Number(file.nodeId)!==newId);
    files.push({...item});
    if(oldId>=1&&oldId<=EP_SAMPLE_SLOT_COUNT)slots[oldId-1]=createCanonicalSlots([])[oldId-1];
    const next=createCanonicalSlots([item])[newId-1];
    next.meta=cloneObject(metadata);
    next.state=String(state||'ready');
    next.verification={
      file:String(verification||'verified'),
      metadata:next.meta?String(verification||'verified'):'unknown'
    };
    next.operation=cloneOperation(oldOperation);
    slots[newId-1]=next;
    if(next.meta)archiveMetadata(next);
    projectSlot(oldId);
    projectSlot(newId);
    emit('slot-moved',{oldNodeId:oldId,nodeId:newId});
    return getSlot(newId);
  };

  const clear=({preserveMetadata=false}={})=>{
    if(preserveMetadata){
      for(const slot of slots)archiveMetadata(slot);
    }else metadataHistory.clear();
    files=[];
    slots=createCanonicalSlots([]);
    projectAll();
    emit('cleared');
  };

  const bindMemory=nextMemory=>{
    memory=nextMemory||null;
    projectAll();
    return()=>{if(memory===nextMemory)memory=null;};
  };

  const getFiles=()=>files.map(item=>({...item}));
  const getSlot=id=>{
    const slot=slots[Number(id)-1];
    return slot?cloneSlot(slot):null;
  };
  const getSlots=()=>slots.map(cloneSlot);
  const getMetadata=id=>cloneObject(slots[Number(id)-1]?.meta);
  const countOccupied=()=>slots.reduce((count,slot)=>count+(slot.file?1:0),0);
  const findNextFree=start=>findNextFreeSampleSlot(slots,start);

  return{
    bindMemory,
    subscribe(listener){
      if(typeof listener!=='function')return()=>{};
      listeners.add(listener);
      return()=>listeners.delete(listener);
    },
    getFiles,getSlot,getSlots,getMetadata,getCachedMetadata,countOccupied,findNextFree,
    replaceFiles,resetInventory,upsertFile,removeFile,
    setMetadata,mergeMetadata,invalidateMetadata,asMetadataCache,
    setOperation,clearOperation,clearOperations,
    setVerification,setState,moveLocal,clear
  };
}

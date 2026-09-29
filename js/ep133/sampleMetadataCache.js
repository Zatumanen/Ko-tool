const cloneMetadata=metadata=>metadata&&typeof metadata==='object'?{...metadata}:null;

export function sampleMetadataFingerprint(slot){
  const id=Number(slot?.nodeId||slot?.id);
  if(!Number.isInteger(id)||id<1||id>999||!slot?.file)return null;
  const size=Number(slot.file.size)||0;
  const name=String(slot.file.path||slot.file.name||'');
  return id+':'+size+':'+name;
}

export function createSampleMetadataCache(){
  const entries=new Map();

  const get=slot=>{
    const id=Number(slot?.nodeId||slot?.id);
    const fingerprint=sampleMetadataFingerprint(slot);
    if(!fingerprint)return null;
    const cached=entries.get(id);
    if(!cached||cached.fingerprint!==fingerprint)return null;
    return cloneMetadata(cached.metadata);
  };

  const set=(slot,metadata)=>{
    const id=Number(slot?.nodeId||slot?.id);
    const fingerprint=sampleMetadataFingerprint(slot);
    if(!fingerprint||!metadata||typeof metadata!=='object')return null;
    const stored=cloneMetadata(metadata);
    entries.set(id,{fingerprint,metadata:stored});
    return cloneMetadata(stored);
  };

  const merge=(slot,patch)=>{
    const id=Number(slot?.nodeId||slot?.id);
    const fingerprint=sampleMetadataFingerprint(slot);
    if(!fingerprint||!patch||typeof patch!=='object')return null;
    const cached=entries.get(id);
    const base=cached?.fingerprint===fingerprint?cached.metadata:{};
    return set(slot,{...base,...patch});
  };

  const invalidate=id=>entries.delete(Number(id));
  const clear=()=>entries.clear();

  return{get,set,merge,invalidate,clear,size:()=>entries.size};
}

export function prioritizeMetadataSlots(slots,{selectedId=null,activeRange=null}={}){
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

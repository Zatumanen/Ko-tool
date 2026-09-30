const soundSlotIds=files=>new Set(
  (files||[])
    .filter(item=>/^\/sounds\/[^/]+$/.test(String(item?.fileName||'')))
    .map(item=>Number(item?.nodeId))
    .filter(id=>Number.isInteger(id)&&id>=1&&id<=999)
);

export function createSampleVerificationController({
  sampleStore,listDirectory
}={}){
  const replaceSoundFiles=files=>{
    const sounds=Array.isArray(files)?files:[];
    sampleStore.replaceFiles([
      ...sampleStore.getFiles().filter(item=>!/^\/sounds\/[^/]+$/.test(item?.fileName||'')),
      ...sounds
    ]);
    return sounds;
  };

  const readAuthoritativeFiles=async(fileOps=null)=>{
    const soundsParentId=sampleStore.getSoundsParentId();
    if(!soundsParentId)return[];
    const list=fileOps?.listDirectory||listDirectory;
    return replaceSoundFiles(await list(soundsParentId,'/sounds'));
  };

  const assertSlotsEmpty=async(ids,fileOps=null)=>{
    const requested=[...new Set((ids||[]).map(Number))];
    const files=await readAuthoritativeFiles(fileOps);
    const occupied=soundSlotIds(files);
    const collisions=requested.filter(id=>occupied.has(id));
    if(collisions.length)
      throw new Error('Target sample slot changed on the device: '+collisions.map(id=>String(id).padStart(3,'0')).join(', ')+'. Reload before retrying.');
    return files;
  };

  const assertSlotsDeleted=async(ids,fileOps=null)=>{
    const requested=[...new Set((ids||[]).map(Number))];
    const files=await readAuthoritativeFiles(fileOps);
    const occupied=soundSlotIds(files);
    const remaining=requested.filter(id=>occupied.has(id));
    if(remaining.length)
      throw new Error('EP-series delete was not confirmed by /sounds LIST for slot(s): '+remaining.map(id=>String(id).padStart(3,'0')).join(', '));
    return files;
  };

  return{replaceSoundFiles,readAuthoritativeFiles,assertSlotsEmpty,assertSlotsDeleted};
}

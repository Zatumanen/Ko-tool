export function createSampleRenameController({
  sampleStore,isConnected,isSynchronized,
  withFileTransaction,setFileMetadata,getFileMetadata,normalizeFileName
}={}){
  const runRenameTransaction=operation=>typeof withFileTransaction==='function'
    ?withFileTransaction('sample rename transaction',operation,{strict:true})
    :operation({setFileMetadata,getFileMetadata});

  const rename=async(slot,value)=>{
    if(!isConnected?.()||!isSynchronized?.())throw new Error('Sample library is not ready.');
    const canonical=sampleStore?.getSlot?.(slot?.id);
    if(!canonical?.file)throw new Error('This sample is no longer available.');
    if(canonical.node?.isWritable!==true)throw new Error('This sample is not writable.');

    const name=normalizeFileName?.(value);
    if(!name)return null;

    const readback=await runRenameTransaction(async fileOps=>{
      await fileOps.setFileMetadata(canonical.nodeId||canonical.id,{name});
      return fileOps.getFileMetadata(canonical.nodeId||canonical.id);
    });

    sampleStore.setMetadata(canonical.id,readback||{name},{verification:'verified'});
    return String(readback?.name||name);
  };

  return{rename};
}

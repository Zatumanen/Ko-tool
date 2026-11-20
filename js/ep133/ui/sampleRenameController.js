export function createSampleRenameController({
  sampleStore,isConnected,isSynchronized,getActiveDeviceProfile,
  captureBatchSession,assertBatchSession,
  withFileTransaction,normalizeFileName
}={}){
  if(typeof withFileTransaction!=='function'||typeof captureBatchSession!=='function'||
    typeof assertBatchSession!=='function'||typeof getActiveDeviceProfile!=='function')
    throw new TypeError('Sample Rename requires a strict FILE lease, session guard and firmware authority.');

  const requireRenameAuthority=slotId=>{
    if(!isConnected?.()||!isSynchronized?.())throw new Error('Sample library is not ready.');
    // FILE_INFO isWritable authorizes a raw slot operation, not this semantic
    // metadata mutation. Firmware evidence must explicitly grant the latter.
    if(getActiveDeviceProfile()?.advancedSampleMetadataWrites!==true)
      throw new Error('Sample metadata writes are not hardware-verified for this firmware.');
    const canonical=sampleStore?.getSlot?.(slotId);
    if(!canonical?.file)throw new Error('This sample is no longer available.');
    if(canonical.node?.isWritable!==true)throw new Error('This sample is not writable.');
    return canonical;
  };

  const rename=async(slot,value)=>{
    const sessionToken=captureBatchSession();
    const canonical=requireRenameAuthority(slot?.id);
    const name=normalizeFileName?.(value);
    if(!name)return null;

    const readback=await withFileTransaction('sample rename transaction',async fileOps=>{
      // A queued FILE transaction may execute after disconnect or another
      // firmware/session has replaced the device originally approved.
      assertBatchSession(sessionToken);
      const live=requireRenameAuthority(slot?.id);
      if(live.nodeId!==canonical.nodeId)
        throw new Error('Sample slot changed while Rename was queued.');
      await fileOps.setFileMetadata(live.nodeId||live.id,{name});
      assertBatchSession(sessionToken);
      const metadata=await fileOps.getFileMetadata(live.nodeId||live.id);
      assertBatchSession(sessionToken);
      return metadata;
    },{strict:true});
    assertBatchSession(sessionToken);
    if(String(readback?.name||'')!==name)
      throw new Error('The EP did not confirm the requested sample name. Readback: '+String(readback?.name||'<missing>')+'.');

    const latest=requireRenameAuthority(slot?.id);
    if(latest.nodeId!==canonical.nodeId)
      throw new Error('Sample slot changed after Rename readback.');
    sampleStore.setMetadata(canonical.id,readback,{verification:'verified'});
    return String(readback.name);
  };

  return{rename};
}

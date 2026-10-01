import{planSampleTransferTargets}from '../sampleMemory.js?v=20261001-1';

export function createSampleTransferCoordinator({
  sampleStore,getActiveDeviceProfile,
  isConnected,isSynchronized,getSoundsParentId,
  hasPendingPropertyWrites,
  moveTransfer,copyTransfer,
  planTransfers=planSampleTransferTargets
}={}){
  const transfer=async(sources,dropSlot,{copy=false,draggedId}={})=>{
    if(!isConnected?.())throw new Error('EP device is disconnected.');
    if(!isSynchronized?.()||!getSoundsParentId?.())throw new Error('Sample library is still synchronizing.');

    const profile=getActiveDeviceProfile?.()||{};
    if(!profile.sampleTransfers)
      throw new Error('MOVE/COPY SAMPLE METADATA IS NOT VERIFIED FOR '+(profile.name||'THIS EP')+'.');
    if(hasPendingPropertyWrites?.())
      throw new Error('Wait for the pending sample property write to finish before moving or copying samples.');

    const requested=Array.from(sources||[]);
    const sourceIds=requested.map(item=>Number(item?.id));
    const canonicalSources=sourceIds.map(id=>sampleStore?.getSlot?.(id)).filter(slot=>slot?.file);
    const plan=planTransfers(sampleStore?.getSlots?.()||[],sourceIds,draggedId,dropSlot?.id);

    if(plan.length!==requested.length||canonicalSources.length!==requested.length)
      throw new Error('No valid free destination slots are available.');

    const sourceById=new Map(canonicalSources.map(item=>[item.id,item]));
    if(copy)return copyTransfer(plan,sourceById,canonicalSources);
    return moveTransfer(plan,sourceById);
  };

  return{transfer};
}

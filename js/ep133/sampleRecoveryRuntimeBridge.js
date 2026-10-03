import{dispatchDeviceRuntimeEvent,getDeviceRuntimeSnapshot}from './deviceRuntime.js?v=20261003-1';

export function publishSampleRecoveryRuntimeEvent(event){
  const connectionEpoch=getDeviceRuntimeSnapshot().connection.epoch;
  if(!connectionEpoch)return;
  const transactionId=String(event?.transactionId||'');
  if(!transactionId)return;
  if(event.type==='required'){
    dispatchDeviceRuntimeEvent({
      type:'RECOVERY_REQUIRED',connectionEpoch,transactionId,kind:'sample',
      reason:String(event.reason||'Sample recovery requires authoritative device verification.')
    });
    return;
  }
  if(event.type==='verified'){
    dispatchDeviceRuntimeEvent({
      type:'RECOVERY_VERIFIED',connectionEpoch,transactionId,verification:event.verification||null
    });
    return;
  }
  if(event.type==='acknowledged'){
    dispatchDeviceRuntimeEvent({
      type:'RECOVERY_VERIFIED',connectionEpoch,transactionId,verification:event.verification||null
    });
    dispatchDeviceRuntimeEvent({type:'RECOVERY_ACKNOWLEDGED',connectionEpoch,transactionId});
  }
}

import{getDeviceRuntimeSnapshot,dispatchDeviceRuntimeEvent}from './deviceRuntime.js';

export function publishSampleRecoveryEvent(event){
  const snapshot=getDeviceRuntimeSnapshot();
  if(snapshot.connection.status!=='connected')return;
  const connectionEpoch=snapshot.connection.epoch;
  const transactionId=String(event?.transactionId||'');
  if(!transactionId)return;
  try{
    if(event.type==='required'){
      dispatchDeviceRuntimeEvent({
        type:'RECOVERY_REQUIRED',connectionEpoch,transactionId,source:'sample',
        reason:String(event.reason||'Sample recovery verification is required.')
      });
      return;
    }
    if(snapshot.recovery.transaction?.id!==transactionId)return;
    if(event.type==='verified'){
      dispatchDeviceRuntimeEvent({
        type:'RECOVERY_VERIFIED',connectionEpoch,transactionId,source:'sample',verification:event.verification||null
      });
      return;
    }
    if(event.type==='acknowledged'){
      const current=getDeviceRuntimeSnapshot();
      if(current.recovery.transaction?.id!==transactionId)return;
      if(current.recovery.transaction?.verified!==true&&event.verification){
        dispatchDeviceRuntimeEvent({
          type:'RECOVERY_VERIFIED',connectionEpoch,transactionId,source:'sample',verification:event.verification
        });
      }
      dispatchDeviceRuntimeEvent({
        type:'RECOVERY_ACKNOWLEDGED',connectionEpoch,transactionId,source:'sample'
      });
    }
  }catch(error){console.warn('Sample recovery runtime bridge failed',error);}
}

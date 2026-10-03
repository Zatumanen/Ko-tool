import{getDeviceRuntimeSnapshot,dispatchDeviceRuntimeEvent}from './deviceRuntime.js';
import{hashDeviceIdentity}from './projectRecovery.js?v=20261001-1';

let recoveryRescanHandler=null;
export function setDeviceRecoveryRescanHandler(handler){
  if(handler!=null&&typeof handler!=='function')throw new TypeError('Device recovery rescan handler must be a function.');
  recoveryRescanHandler=handler||null;
}
const requestRecoveryRescan=()=>{
  if(!recoveryRescanHandler)return;
  try{Promise.resolve(recoveryRescanHandler()).catch(error=>console.warn('EP recovery runtime rescan failed',error));}
  catch(error){console.warn('EP recovery runtime rescan failed',error);}
};
const recordMatchesDevice=(record,deviceInfo)=>{
  const persisted=record?.device||{};
  if(!persisted.identityHash)return false;
  if(String(persisted.identityHash)!==String(hashDeviceIdentity(deviceInfo)))return false;
  if(persisted.sku&&String(persisted.sku)!==String(deviceInfo?.sku||''))return false;
  const firmware=String(deviceInfo?.metadata?.os_version||deviceInfo?.metadata?.sw_version||'');
  if(persisted.firmware&&String(persisted.firmware)!==firmware)return false;
  return true;
};
const journalStarted=(record,phases)=>Array.isArray(record?.journal)&&record.journal.some(entry=>
  phases.includes(String(entry?.phase||''))&&['started','completed','failed'].includes(String(entry?.status||''))
);
const unresolvedSample=record=>{
  const status=String(record?.status||record?.transactionStatus||'');
  if(status==='requires-recovery')return true;
  return String(record?.transactionStatus||'')==='running'&&journalStarted(record,['MUTATE','RECOVERY','FINALIZE']);
};
const unresolvedProject=record=>{
  const status=String(record?.status||record?.transactionStatus||'');
  if(['requires-recovery','rollback-failed','candidate-written'].includes(status))return true;
  return String(record?.transactionStatus||'')==='running'&&journalStarted(record,['WRITE','READBACK','RELOAD','VERIFY','ROLLBACK']);
};
const recoveryReason=(record,source)=>String(
  record?.recoveryDetail?.reason||record?.error||
  (source==='sample'?'Persisted sample mutation requires authoritative recovery verification.':'Persisted project write requires authoritative recovery verification.')
);
const sortBlockers=(a,b)=>{
  const aTime=Date.parse(a.createdAt||'')||0,bTime=Date.parse(b.createdAt||'')||0;
  return aTime-bTime||String(a.id||'').localeCompare(String(b.id||''));
};

export async function syncDeviceRuntimeRecovery({
  runtime,deviceInfo,listSampleTransactions,listProjectCheckpoints
}={}){
  if(!runtime||typeof runtime.getSnapshot!=='function'||typeof runtime.dispatch!=='function'||typeof runtime.assertEpoch!=='function')
    throw new TypeError('Device recovery hydration requires a runtime state instance.');
  if(!deviceInfo)throw new TypeError('Device recovery hydration requires connected device info.');
  if(typeof listSampleTransactions!=='function'||typeof listProjectCheckpoints!=='function')
    throw new TypeError('Device recovery hydration requires sample and project recovery readers.');
  const snapshot=runtime.getSnapshot();
  if(snapshot.connection.status!=='connected')throw new Error('Device recovery hydration requires a connected device.');
  const connectionEpoch=snapshot.connection.epoch;
  runtime.dispatch({type:'RECOVERY_SCAN_STARTED',connectionEpoch});
  const[samples,projects]=await Promise.all([listSampleTransactions(),listProjectCheckpoints()]);
  runtime.assertEpoch(connectionEpoch);
  const blockers=[
    ...(Array.isArray(samples)?samples:[])
      .filter(record=>recordMatchesDevice(record,deviceInfo)&&unresolvedSample(record))
      .map(record=>({id:String(record.id||''),source:'sample',createdAt:record.createdAt,reason:recoveryReason(record,'sample')})),
    ...(Array.isArray(projects)?projects:[])
      .filter(record=>recordMatchesDevice(record,deviceInfo)&&unresolvedProject(record))
      .map(record=>({id:String(record.id||''),source:'project',createdAt:record.createdAt,reason:recoveryReason(record,'project')}))
  ].filter(item=>item.id).sort(sortBlockers);
  runtime.assertEpoch(connectionEpoch);
  if(blockers.length){
    const blocker=blockers[0];
    runtime.dispatch({
      type:'RECOVERY_REQUIRED',connectionEpoch,
      transactionId:blocker.id,source:blocker.source,reason:blocker.reason
    });
  }
  runtime.dispatch({type:'RECOVERY_SCAN_COMPLETED',connectionEpoch});
  return Object.freeze({connectionEpoch,blocker:blockers[0]||null,count:blockers.length});
}

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
      dispatchDeviceRuntimeEvent({type:'RECOVERY_SCAN_STARTED',connectionEpoch});
      dispatchDeviceRuntimeEvent({
        type:'RECOVERY_ACKNOWLEDGED',connectionEpoch,transactionId,source:'sample'
      });
      requestRecoveryRescan();
    }
  }catch(error){console.warn('Sample recovery runtime bridge failed',error);}
}

export function publishProjectRecoveryEvent(event){
  const snapshot=getDeviceRuntimeSnapshot();
  if(snapshot.connection.status!=='connected')return;
  const connectionEpoch=snapshot.connection.epoch;
  const transactionId=String(event?.checkpointId||'');
  if(!transactionId)return;
  try{
    if(event.type==='required'){
      dispatchDeviceRuntimeEvent({
        type:'RECOVERY_REQUIRED',connectionEpoch,transactionId,source:'project',
        reason:String(event.reason||'Project recovery verification is required.')
      });
      return;
    }
    if(event.type!=='resolved'||snapshot.recovery.transaction?.id!==transactionId)return;
    dispatchDeviceRuntimeEvent({type:'RECOVERY_SCAN_STARTED',connectionEpoch});
    dispatchDeviceRuntimeEvent({
      type:'RECOVERY_VERIFIED',connectionEpoch,transactionId,source:'project',
      verification:{classification:String(event.status||'resolved'),summary:'Persisted project recovery state was resolved after verified device I/O.',deviceMutated:true,verifiedAt:new Date().toISOString()}
    });
    dispatchDeviceRuntimeEvent({type:'RECOVERY_ACKNOWLEDGED',connectionEpoch,transactionId,source:'project'});
    requestRecoveryRescan();
  }catch(error){console.warn('Project recovery runtime bridge failed',error);}
}

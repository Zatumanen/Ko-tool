import{createEpError,EP_ERROR_CATEGORY,EP_ERROR_CODE}from './errors.js?v=20261001-1';

export const DEVICE_RUNTIME_CONNECTION=Object.freeze({
  DISCONNECTED:'disconnected',CONNECTING:'connecting',CONNECTED:'connected'
});
export const DEVICE_RUNTIME_OWNERSHIP=Object.freeze({
  NONE:'none',OWNED:'owned',BLOCKED:'blocked'
});
export const DEVICE_RUNTIME_OPERATION=Object.freeze({
  IDLE:'idle',READING:'reading',MUTATING:'mutating',VERIFYING:'verifying'
});
export const DEVICE_RUNTIME_SAFETY=Object.freeze({
  SAFE:'safe',BLOCKED:'blocked',RECOVERY_REQUIRED:'recovery-required',UNSAFE:'unsafe'
});
export const DEVICE_RUNTIME_STATUS=Object.freeze({
  DISCONNECTED:'disconnected',CONNECTING:'connecting',READY:'ready',READING:'reading',
  MUTATING:'mutating',VERIFYING:'verifying',BLOCKED:'blocked',
  RECOVERY_REQUIRED:'recovery-required',UNSAFE:'unsafe'
});

const freezeDevice=device=>device?Object.freeze({
  sku:String(device.sku||''),
  firmware:String(device.firmware||''),
  deviceKey:device.deviceKey==null?null:String(device.deviceKey),
  identityVerified:device.identityVerified===true
}):null;
const freezeActive=active=>active?Object.freeze({...active}):null;
const freezeVerification=verification=>verification&&typeof verification==='object'
  ?Object.freeze({...verification})
  :verification??null;
const freezeTransaction=transaction=>transaction?Object.freeze({
  ...transaction,verification:freezeVerification(transaction.verification)
}):null;
const freezeInterference=detail=>detail?Object.freeze({...detail}):null;

const runtimeError=(code,message,category,details)=>createEpError(code,message,{
  category,retryable:false,details,name:'EPDeviceRuntimeError'
});

export function createDeviceRuntimeState({now=()=>Date.now()}={}){
  let state={
    connection:{status:DEVICE_RUNTIME_CONNECTION.DISCONNECTED,epoch:0,device:null},
    ownership:{status:DEVICE_RUNTIME_OWNERSHIP.NONE,reason:null},
    operation:{phase:DEVICE_RUNTIME_OPERATION.IDLE,active:null},
    safety:{status:DEVICE_RUNTIME_SAFETY.SAFE,reason:null},
    recovery:{hydrated:false,transaction:null},
    externalInterference:null
  };
  const listeners=new Set();

  const derivedStatus=source=>{
    if(source.safety.status===DEVICE_RUNTIME_SAFETY.UNSAFE)return DEVICE_RUNTIME_STATUS.UNSAFE;
    if(source.safety.status===DEVICE_RUNTIME_SAFETY.RECOVERY_REQUIRED)return DEVICE_RUNTIME_STATUS.RECOVERY_REQUIRED;
    if(source.safety.status===DEVICE_RUNTIME_SAFETY.BLOCKED)return DEVICE_RUNTIME_STATUS.BLOCKED;
    if(source.connection.status===DEVICE_RUNTIME_CONNECTION.CONNECTED&&(
      source.ownership.status!==DEVICE_RUNTIME_OWNERSHIP.OWNED||
      source.connection.device?.identityVerified!==true||
      source.recovery.hydrated!==true
    ))return DEVICE_RUNTIME_STATUS.BLOCKED;
    if(source.connection.status===DEVICE_RUNTIME_CONNECTION.CONNECTING)return DEVICE_RUNTIME_STATUS.CONNECTING;
    if(source.operation.phase===DEVICE_RUNTIME_OPERATION.VERIFYING)return DEVICE_RUNTIME_STATUS.VERIFYING;
    if(source.operation.phase===DEVICE_RUNTIME_OPERATION.MUTATING)return DEVICE_RUNTIME_STATUS.MUTATING;
    if(source.operation.phase===DEVICE_RUNTIME_OPERATION.READING)return DEVICE_RUNTIME_STATUS.READING;
    if(source.connection.status===DEVICE_RUNTIME_CONNECTION.CONNECTED)return DEVICE_RUNTIME_STATUS.READY;
    return DEVICE_RUNTIME_STATUS.DISCONNECTED;
  };

  const snapshot=()=>Object.freeze({
    connection:Object.freeze({
      status:state.connection.status,epoch:state.connection.epoch,device:freezeDevice(state.connection.device)
    }),
    ownership:Object.freeze({...state.ownership}),
    operation:Object.freeze({phase:state.operation.phase,active:freezeActive(state.operation.active)}),
    safety:Object.freeze({...state.safety}),
    recovery:Object.freeze({hydrated:state.recovery.hydrated,transaction:freezeTransaction(state.recovery.transaction)}),
    externalInterference:freezeInterference(state.externalInterference),
    status:derivedStatus(state)
  });
  const notify=()=>{
    const value=snapshot();
    for(const listener of listeners){
      try{listener(value);}catch(error){console.warn('EP runtime state listener failed',error);}
    }
  };
  const replace=patch=>{
    state={...state,...patch};
    notify();
    return snapshot();
  };
  const invalid=(message,event)=>{
    throw runtimeError(
      EP_ERROR_CODE.DEVICE_RUNTIME_INVALID_TRANSITION,message,EP_ERROR_CATEGORY.RUNTIME,
      {eventType:String(event?.type||''),status:derivedStatus(state),connectionEpoch:state.connection.epoch}
    );
  };
  const staleOperation=(message,event)=>{
    throw runtimeError(
      EP_ERROR_CODE.DEVICE_RUNTIME_STALE_OPERATION,message,EP_ERROR_CATEGORY.RUNTIME,
      {
        eventType:String(event?.type||''),connectionEpoch:state.connection.epoch,
        activeOperationId:state.operation.active?.id??null,receivedOperationId:event?.operationId??null,
        recoveryTransactionId:state.recovery.transaction?.id??null,receivedTransactionId:event?.transactionId??null
      }
    );
  };
  const assertEpoch=epoch=>{
    const requested=Number(epoch);
    if(!Number.isInteger(requested)||requested!==state.connection.epoch)
      throw runtimeError(
        EP_ERROR_CODE.DEVICE_RUNTIME_STALE_EPOCH,
        'EP device runtime event belongs to a stale connection epoch.',EP_ERROR_CATEGORY.RUNTIME,
        {expectedEpoch:state.connection.epoch,receivedEpoch:requested}
      );
    return requested;
  };
  const assertOptionalEpoch=event=>{
    if(event?.connectionEpoch!==undefined&&event?.connectionEpoch!==null)assertEpoch(event.connectionEpoch);
  };
  const assertActiveOperation=event=>{
    assertEpoch(event?.connectionEpoch);
    const operationId=Number(event?.operationId);
    if(!state.operation.active||!Number.isInteger(operationId)||operationId!==state.operation.active.id)
      staleOperation('EP runtime operation event does not match the active FILE lease.',event);
    return state.operation.active;
  };
  const assertRecoveryTransaction=event=>{
    assertEpoch(event?.connectionEpoch);
    const transactionId=String(event?.transactionId||'');
    if(!transactionId||transactionId!==String(state.recovery.transaction?.id||''))
      staleOperation('EP runtime recovery event does not match the active recovery transaction.',event);
    return state.recovery.transaction;
  };

  const assertCanStartFileOperation=({mode='read'}={})=>{
    const normalized=String(mode||'read');
    if(normalized!=='read'&&normalized!=='mutation')
      invalid('Unknown EP FILE operation mode: '+normalized,{type:'FILE_OPERATION_ADMISSION'});
    const current=snapshot();
    const allowed=
      current.connection.status===DEVICE_RUNTIME_CONNECTION.CONNECTED&&
      current.connection.device?.identityVerified===true&&
      current.ownership.status===DEVICE_RUNTIME_OWNERSHIP.OWNED&&
      current.operation.phase===DEVICE_RUNTIME_OPERATION.IDLE&&
      current.safety.status===DEVICE_RUNTIME_SAFETY.SAFE&&
      current.recovery.hydrated===true;
    if(!allowed)throw runtimeError(
      EP_ERROR_CODE.DEVICE_RUNTIME_OPERATION_BLOCKED,
      'EP-series FILE operation blocked by device runtime state: '+current.status,
      EP_ERROR_CATEGORY.SAFETY,
      {mode:normalized,status:current.status,connectionEpoch:current.connection.epoch}
    );
    return current;
  };

  const dispatch=event=>{
    const type=String(event?.type||'');
    switch(type){
      case 'CONNECT_STARTED':{
        const nextSafety=state.safety.status===DEVICE_RUNTIME_SAFETY.BLOCKED
          ?{status:DEVICE_RUNTIME_SAFETY.SAFE,reason:null}
          :state.safety;
        return replace({
          connection:{status:DEVICE_RUNTIME_CONNECTION.CONNECTING,epoch:state.connection.epoch,device:null},
          operation:{phase:DEVICE_RUNTIME_OPERATION.IDLE,active:null},
          safety:nextSafety,
          recovery:{...state.recovery,hydrated:false},
          externalInterference:null
        });
      }
      case 'DEVICE_CONNECTED':{
        const epoch=Number(event.connectionEpoch);
        if(!Number.isInteger(epoch)||epoch<=0)invalid('DEVICE_CONNECTED requires a positive connection epoch.',event);
        if(epoch<state.connection.epoch)
          throw runtimeError(
            EP_ERROR_CODE.DEVICE_RUNTIME_STALE_EPOCH,
            'EP device connection event belongs to an older connection epoch.',EP_ERROR_CATEGORY.RUNTIME,
            {expectedEpoch:state.connection.epoch,receivedEpoch:epoch}
          );
        return replace({
          connection:{status:DEVICE_RUNTIME_CONNECTION.CONNECTED,epoch,device:freezeDevice(event.device)},
          recovery:{...state.recovery,hydrated:false}
        });
      }
      case 'DEVICE_DISCONNECTED':
        assertEpoch(event.connectionEpoch);
        return replace({
          connection:{status:DEVICE_RUNTIME_CONNECTION.DISCONNECTED,epoch:state.connection.epoch,device:null},
          ownership:{status:DEVICE_RUNTIME_OWNERSHIP.NONE,reason:null},
          operation:{phase:DEVICE_RUNTIME_OPERATION.IDLE,active:null},
          recovery:{...state.recovery,hydrated:false}
        });
      case 'OWNERSHIP_ACQUIRED':
        assertOptionalEpoch(event);
        return replace({ownership:{status:DEVICE_RUNTIME_OWNERSHIP.OWNED,reason:null}});
      case 'OWNERSHIP_LOST':
        assertOptionalEpoch(event);
        return replace({ownership:{status:DEVICE_RUNTIME_OWNERSHIP.NONE,reason:String(event.reason||'')||null}});
      case 'OWNERSHIP_BLOCKED':
        assertOptionalEpoch(event);
        return replace({ownership:{status:DEVICE_RUNTIME_OWNERSHIP.BLOCKED,reason:String(event.reason||'EP session ownership is blocked.')}});
      case 'FILE_OPERATION_STARTED':{
        assertEpoch(event.connectionEpoch);
        const mode=String(event.mode||'read')==='mutation'?'mutation':'read';
        assertCanStartFileOperation({mode});
        const operationId=Number(event.operationId);
        if(!Number.isInteger(operationId)||operationId<=0)invalid('FILE_OPERATION_STARTED requires a positive operation id.',event);
        const phase=mode==='mutation'?DEVICE_RUNTIME_OPERATION.MUTATING:DEVICE_RUNTIME_OPERATION.READING;
        const active={
          id:operationId,label:String(event.label||'FILE operation'),mode,phase,
          connectionEpoch:state.connection.epoch,startedAt:Number(now())||Date.now()
        };
        return replace({operation:{phase,active}});
      }
      case 'FILE_OPERATION_VERIFYING':{
        const active=assertActiveOperation(event);
        const next={...active,phase:DEVICE_RUNTIME_OPERATION.VERIFYING};
        return replace({operation:{phase:DEVICE_RUNTIME_OPERATION.VERIFYING,active:next}});
      }
      case 'FILE_OPERATION_FINISHED':
        assertActiveOperation(event);
        return replace({operation:{phase:DEVICE_RUNTIME_OPERATION.IDLE,active:null}});
      case 'FILE_OPERATION_FAILED':{
        const active=assertActiveOperation(event);
        const effect=String(event.effect||'session-ambiguous');
        const idle={phase:DEVICE_RUNTIME_OPERATION.IDLE,active:null};
        if(effect==='none')return replace({operation:idle});
        if(effect==='possible'){
          const transactionId=String(event.transactionId||('operation:'+active.id));
          const reason=String(event.reason||'FILE mutation effect could not be proven.');
          return replace({
            operation:idle,
            safety:{status:DEVICE_RUNTIME_SAFETY.RECOVERY_REQUIRED,reason},
            recovery:{
              hydrated:true,
              transaction:{id:transactionId,kind:String(event.kind||'operation'),reason,verification:null}
            }
          });
        }
        if(effect!=='session-ambiguous')invalid('Unknown FILE operation failure effect: '+effect,event);
        return replace({
          operation:idle,
          safety:{status:DEVICE_RUNTIME_SAFETY.UNSAFE,reason:String(event.reason||'FILE session continuity is unknown.')}
        });
      }
      case 'UNEXPECTED_FILE_TRAFFIC':{
        assertEpoch(event.connectionEpoch);
        const detail={
          requestId:Number.isFinite(Number(event.requestId))?Number(event.requestId):null,
          reason:String(event.reason||'Unexpected EP-series FILE traffic.'),at:Number(now())||Date.now()
        };
        if(state.operation.active)return replace({
          safety:{status:DEVICE_RUNTIME_SAFETY.UNSAFE,reason:detail.reason},externalInterference:detail
        });
        if(state.safety.status===DEVICE_RUNTIME_SAFETY.UNSAFE)
          return replace({externalInterference:detail});
        return replace({
          safety:{status:DEVICE_RUNTIME_SAFETY.BLOCKED,reason:detail.reason},externalInterference:detail
        });
      }
      case 'FIRMWARE_DEBUG_DETECTED':
      case 'DEVICE_MARKED_UNSAFE':
        assertEpoch(event.connectionEpoch);
        return replace({
          safety:{
            status:DEVICE_RUNTIME_SAFETY.UNSAFE,
            reason:String(event.reason||'EP-series FILE session is unsafe.')
          }
        });
      case 'RECOVERY_SCAN_STARTED':
        assertEpoch(event.connectionEpoch);
        return replace({recovery:{...state.recovery,hydrated:false}});
      case 'RECOVERY_SCAN_COMPLETED':{
        assertEpoch(event.connectionEpoch);
        const safety=state.safety.status===DEVICE_RUNTIME_SAFETY.RECOVERY_REQUIRED
          ?{status:DEVICE_RUNTIME_SAFETY.SAFE,reason:null}
          :state.safety;
        return replace({safety,recovery:{hydrated:true,transaction:null}});
      }
      case 'RECOVERY_REQUIRED':{
        assertEpoch(event.connectionEpoch);
        const transactionId=String(event.transactionId||'');
        if(!transactionId)invalid('RECOVERY_REQUIRED requires a transaction id.',event);
        const reason=String(event.reason||'Authoritative recovery verification is required.');
        const transaction={
          id:transactionId,kind:String(event.kind||'unknown'),reason,verification:null
        };
        return replace({
          safety:state.safety.status===DEVICE_RUNTIME_SAFETY.UNSAFE
            ?state.safety
            :{status:DEVICE_RUNTIME_SAFETY.RECOVERY_REQUIRED,reason},
          recovery:{hydrated:true,transaction}
        });
      }
      case 'RECOVERY_VERIFIED':{
        const transaction=assertRecoveryTransaction(event);
        const verification=freezeVerification(event.verification);
        if(event.resolved===true){
          return replace({
            safety:state.safety.status===DEVICE_RUNTIME_SAFETY.UNSAFE
              ?state.safety
              :{status:DEVICE_RUNTIME_SAFETY.SAFE,reason:null},
            recovery:{hydrated:true,transaction:null}
          });
        }
        return replace({
          recovery:{hydrated:true,transaction:{...transaction,verification}}
        });
      }
      case 'RECOVERY_ACKNOWLEDGED':{
        const transaction=assertRecoveryTransaction(event);
        if(!transaction.verification)
          invalid('Recovery acknowledgement requires authoritative verification.',event);
        return replace({
          safety:state.safety.status===DEVICE_RUNTIME_SAFETY.UNSAFE
            ?state.safety
            :{status:DEVICE_RUNTIME_SAFETY.SAFE,reason:null},
          recovery:{hydrated:true,transaction:null}
        });
      }
      default:return invalid('Unknown EP device runtime event: '+type,event);
    }
  };

  const captureEpoch=()=>state.connection.epoch;

  return Object.freeze({
    getSnapshot:snapshot,
    subscribe(listener){
      if(typeof listener!=='function')throw new TypeError('EP runtime state listener must be a function.');
      listeners.add(listener);
      return()=>listeners.delete(listener);
    },
    dispatch,assertCanStartFileOperation,captureEpoch,assertEpoch
  });
}

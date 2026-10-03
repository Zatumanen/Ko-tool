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
  DISCONNECTED:'disconnected',CONNECTING:'connecting',READY:'ready',
  READING:'reading',MUTATING:'mutating',VERIFYING:'verifying',
  BLOCKED:'blocked',RECOVERY_REQUIRED:'recovery-required',UNSAFE:'unsafe'
});

const runtimeError=(code,message,details=null,category=EP_ERROR_CATEGORY.RUNTIME)=>createEpError(
  code,message,{category,retryable:false,details,name:'EPDeviceRuntimeError'}
);
const sanitizeDevice=device=>Object.freeze({
  sku:String(device?.sku||''),
  firmware:String(device?.firmware||''),
  deviceKey:device?.deviceKey==null?null:String(device.deviceKey),
  identityVerified:device?.identityVerified===true
});
const sanitizeVerification=verification=>verification&&typeof verification==='object'?Object.freeze({
  classification:String(verification.classification||''),
  summary:String(verification.summary||''),
  deviceMutated:verification.deviceMutated===true,
  verifiedAt:verification.verifiedAt==null?null:String(verification.verifiedAt)
}):null;
const freezeRecovery=recovery=>{
  const transaction=recovery.transaction?Object.freeze({
    ...recovery.transaction,
    verification:recovery.transaction.verification
      ?Object.freeze({...recovery.transaction.verification})
      :null
  }):null;
  return Object.freeze({...recovery,transaction});
};
const freezeState=state=>Object.freeze({
  connection:Object.freeze({...state.connection}),
  ownership:Object.freeze({...state.ownership}),
  operation:Object.freeze({
    ...state.operation,
    active:state.operation.active?Object.freeze({...state.operation.active}):null
  }),
  safety:Object.freeze({...state.safety}),
  recovery:freezeRecovery(state.recovery),
  externalInterference:state.externalInterference
    ?Object.freeze({...state.externalInterference})
    :null,
  status:state.status
});
const deriveStatus=state=>{
  if(state.safety.status===DEVICE_RUNTIME_SAFETY.UNSAFE)return DEVICE_RUNTIME_STATUS.UNSAFE;
  if(state.safety.status===DEVICE_RUNTIME_SAFETY.RECOVERY_REQUIRED)return DEVICE_RUNTIME_STATUS.RECOVERY_REQUIRED;
  if(state.safety.status===DEVICE_RUNTIME_SAFETY.BLOCKED||state.ownership.status===DEVICE_RUNTIME_OWNERSHIP.BLOCKED)
    return DEVICE_RUNTIME_STATUS.BLOCKED;
  if(state.connection.status===DEVICE_RUNTIME_CONNECTION.CONNECTING)return DEVICE_RUNTIME_STATUS.CONNECTING;
  if(state.operation.phase===DEVICE_RUNTIME_OPERATION.VERIFYING)return DEVICE_RUNTIME_STATUS.VERIFYING;
  if(state.operation.phase===DEVICE_RUNTIME_OPERATION.MUTATING)return DEVICE_RUNTIME_STATUS.MUTATING;
  if(state.operation.phase===DEVICE_RUNTIME_OPERATION.READING)return DEVICE_RUNTIME_STATUS.READING;
  if(state.connection.status===DEVICE_RUNTIME_CONNECTION.CONNECTED){
    if(
      state.ownership.status!==DEVICE_RUNTIME_OWNERSHIP.OWNED||
      state.connection.device?.identityVerified!==true||
      state.recovery.hydrated!==true
    )return DEVICE_RUNTIME_STATUS.BLOCKED;
    return DEVICE_RUNTIME_STATUS.READY;
  }
  return DEVICE_RUNTIME_STATUS.DISCONNECTED;
};

export function createDeviceRuntimeState({now=()=>Date.now()}={}){
  let state=freezeState({
    connection:{status:DEVICE_RUNTIME_CONNECTION.DISCONNECTED,epoch:0,device:null},
    ownership:{status:DEVICE_RUNTIME_OWNERSHIP.NONE},
    operation:{phase:DEVICE_RUNTIME_OPERATION.IDLE,active:null},
    safety:{status:DEVICE_RUNTIME_SAFETY.SAFE,reason:null},
    recovery:{hydrated:false,transaction:null},
    externalInterference:null,
    status:DEVICE_RUNTIME_STATUS.DISCONNECTED
  });
  const listeners=new Set();
  const commit=patch=>{
    const next={...state,...patch};
    next.status=deriveStatus(next);
    state=freezeState(next);
    for(const listener of listeners){try{listener(state);}catch(error){console.warn('EP runtime listener failed',error)}}
    return state;
  };
  const staleEpoch=epoch=>runtimeError(
    EP_ERROR_CODE.DEVICE_RUNTIME_STALE_EPOCH,
    'EP device runtime rejected a stale connection epoch.',
    {eventEpoch:epoch,currentEpoch:state.connection.epoch}
  );
  const exactEpoch=epoch=>{
    const value=Number(epoch);
    if(!Number.isInteger(value)||value!==state.connection.epoch)throw staleEpoch(epoch);
    return value;
  };
  const transitionError=(event,reason)=>runtimeError(
    EP_ERROR_CODE.DEVICE_RUNTIME_INVALID_TRANSITION,
    'Invalid EP device runtime transition: '+String(reason||event?.type||'unknown event'),
    {eventType:String(event?.type||''),status:state.status,connectionEpoch:state.connection.epoch}
  );
  const staleOperation=(event,reason='operation lease does not match the active operation')=>runtimeError(
    EP_ERROR_CODE.DEVICE_RUNTIME_STALE_OPERATION,
    'EP device runtime rejected a stale FILE operation.',
    {
      reason,eventOperationId:event?.operationId??null,
      activeOperationId:state.operation.active?.id??null,
      connectionEpoch:state.connection.epoch
    }
  );
  const matchingOperation=event=>{
    exactEpoch(event.connectionEpoch);
    const active=state.operation.active;
    if(!active||active.id!==event.operationId)throw staleOperation(event);
    return active;
  };
  const operationBlocked=details=>runtimeError(
    EP_ERROR_CODE.DEVICE_RUNTIME_OPERATION_BLOCKED,
    'EP-series FILE operation is blocked by device runtime state.',
    {status:state.status,connectionEpoch:state.connection.epoch,...details},
    EP_ERROR_CATEGORY.SAFETY
  );
  const canStartFileOperation=mode=>
    (mode==='read'||mode==='mutation')&&
    state.connection.status===DEVICE_RUNTIME_CONNECTION.CONNECTED&&
    state.connection.device?.identityVerified===true&&
    state.ownership.status===DEVICE_RUNTIME_OWNERSHIP.OWNED&&
    state.operation.phase===DEVICE_RUNTIME_OPERATION.IDLE&&
    state.safety.status===DEVICE_RUNTIME_SAFETY.SAFE&&
    state.recovery.hydrated===true;
  const recoveryMatch=(event,{requireVerified=false}={})=>{
    exactEpoch(event.connectionEpoch);
    const transaction=state.recovery.transaction;
    if(!transaction||String(transaction.id)!==String(event.transactionId||''))
      throw transitionError(event,'recovery transaction does not match the active blocker');
    if(requireVerified&&transaction.verified!==true)
      throw transitionError(event,'recovery transaction must be verified before acknowledgment');
    return transaction;
  };

  const dispatch=event=>{
    if(!event||typeof event!=='object'||!String(event.type||''))throw transitionError(event,'event type is required');
    switch(String(event.type)){
      case'OWNERSHIP_ACQUIRED':
        return commit({ownership:{status:DEVICE_RUNTIME_OWNERSHIP.OWNED}});
      case'OWNERSHIP_LOST':
        return commit({ownership:{status:DEVICE_RUNTIME_OWNERSHIP.NONE}});
      case'OWNERSHIP_BLOCKED':
        return commit({ownership:{status:DEVICE_RUNTIME_OWNERSHIP.BLOCKED}});
      case'CONNECT_STARTED':
        return commit({
          connection:{...state.connection,status:DEVICE_RUNTIME_CONNECTION.CONNECTING,device:null},
          recovery:{...state.recovery,hydrated:false}
        });
      case'DEVICE_CONNECTED':{
        const epoch=Number(event.connectionEpoch);
        if(!Number.isInteger(epoch)||epoch<state.connection.epoch)throw staleEpoch(event.connectionEpoch);
        if(event.device?.identityVerified!==true)throw transitionError(event,'connected device identity is not verified');
        const confirmedNewEpoch=epoch>state.connection.epoch;
        const clearIdleInterference=confirmedNewEpoch&&state.safety.status===DEVICE_RUNTIME_SAFETY.BLOCKED;
        return commit({
          connection:{status:DEVICE_RUNTIME_CONNECTION.CONNECTED,epoch,device:sanitizeDevice(event.device)},
          safety:clearIdleInterference?{status:DEVICE_RUNTIME_SAFETY.SAFE,reason:null}:state.safety,
          externalInterference:clearIdleInterference?null:state.externalInterference,
          recovery:{...state.recovery,hydrated:false}
        });
      }
      case'DEVICE_DISCONNECTED':{
        const epoch=Number(event.connectionEpoch);
        if(!Number.isInteger(epoch)||epoch<state.connection.epoch)throw staleEpoch(event.connectionEpoch);
        const active=state.operation.active;
        const mutationAmbiguous=active?.mode==='mutation'&&state.safety.status===DEVICE_RUNTIME_SAFETY.SAFE;
        return commit({
          connection:{status:DEVICE_RUNTIME_CONNECTION.DISCONNECTED,epoch,device:null},
          operation:{phase:DEVICE_RUNTIME_OPERATION.IDLE,active:null},
          safety:mutationAmbiguous
            ?{status:DEVICE_RUNTIME_SAFETY.RECOVERY_REQUIRED,reason:'Device disconnected during an active FILE mutation.'}
            :state.safety,
          recovery:{
            ...state.recovery,hydrated:false,
            transaction:mutationAmbiguous
              ?{id:'operation:'+String(active.id),source:'operation',reason:'disconnect during mutation',verified:false,verification:null}
              :state.recovery.transaction
          }
        });
      }
      case'RECOVERY_SCAN_STARTED':
        exactEpoch(event.connectionEpoch);
        if(state.connection.status!==DEVICE_RUNTIME_CONNECTION.CONNECTED)throw transitionError(event,'recovery scan requires a connected device');
        return commit({recovery:{...state.recovery,hydrated:false}});
      case'RECOVERY_SCAN_COMPLETED':
        exactEpoch(event.connectionEpoch);
        if(state.connection.status!==DEVICE_RUNTIME_CONNECTION.CONNECTED)throw transitionError(event,'recovery scan requires a connected device');
        return commit({recovery:{...state.recovery,hydrated:true}});
      case'FILE_OPERATION_STARTED':{
        exactEpoch(event.connectionEpoch);
        const mode=String(event.mode||'read');
        if(!canStartFileOperation(mode))throw operationBlocked({mode,operationId:event.operationId??null});
        if(event.operationId==null)throw transitionError(event,'FILE operation id is required');
        const phase=mode==='mutation'?DEVICE_RUNTIME_OPERATION.MUTATING:DEVICE_RUNTIME_OPERATION.READING;
        return commit({
          operation:{
            phase,
            active:{
              id:event.operationId,label:String(event.label||'FILE operation'),mode,
              phase,epoch:state.connection.epoch,startedAt:now()
            }
          }
        });
      }
      case'FILE_OPERATION_VERIFYING':{
        const active=matchingOperation(event);
        return commit({operation:{
          phase:DEVICE_RUNTIME_OPERATION.VERIFYING,
          active:{...active,phase:DEVICE_RUNTIME_OPERATION.VERIFYING}
        }});
      }
      case'FILE_OPERATION_FINISHED':
        matchingOperation(event);
        return commit({operation:{phase:DEVICE_RUNTIME_OPERATION.IDLE,active:null}});
      case'FILE_OPERATION_FAILED':{
        const active=matchingOperation(event);
        const effect=String(event.effect||'session-ambiguous');
        if(!['none','possible','session-ambiguous'].includes(effect))throw transitionError(event,'unknown FILE failure effect '+effect);
        if(effect==='none')return commit({operation:{phase:DEVICE_RUNTIME_OPERATION.IDLE,active:null}});
        const reason=String(event.reason||'FILE operation final state is not proven.');
        if(effect==='possible')return commit({
          operation:{phase:DEVICE_RUNTIME_OPERATION.IDLE,active:null},
          safety:{status:DEVICE_RUNTIME_SAFETY.RECOVERY_REQUIRED,reason},
          recovery:{
            ...state.recovery,hydrated:true,
            transaction:{
              id:String(event.transactionId||('operation:'+String(active.id))),
              source:String(event.source||'operation'),reason,verified:false,verification:null
            }
          }
        });
        return commit({
          operation:{phase:DEVICE_RUNTIME_OPERATION.IDLE,active:null},
          safety:{status:DEVICE_RUNTIME_SAFETY.UNSAFE,reason}
        });
      }
      case'DEVICE_MARKED_UNSAFE':
      case'FIRMWARE_DEBUG_DETECTED':
        exactEpoch(event.connectionEpoch);
        return commit({safety:{
          status:DEVICE_RUNTIME_SAFETY.UNSAFE,
          reason:String(event.reason||'EP-series FILE session state is unsafe.')
        }});
      case'UNEXPECTED_FILE_TRAFFIC':{
        exactEpoch(event.connectionEpoch);
        const reason=String(event.reason||'Unexpected EP-series FILE traffic detected.');
        const externalInterference={
          requestId:Number.isFinite(Number(event.requestId))?Number(event.requestId):null,
          reason,at:now()
        };
        if(state.operation.active)return commit({
          safety:{status:DEVICE_RUNTIME_SAFETY.UNSAFE,reason},externalInterference
        });
        if(state.safety.status===DEVICE_RUNTIME_SAFETY.SAFE)return commit({
          safety:{status:DEVICE_RUNTIME_SAFETY.BLOCKED,reason},externalInterference
        });
        return commit({externalInterference});
      }
      case'RECOVERY_REQUIRED':{
        exactEpoch(event.connectionEpoch);
        const id=String(event.transactionId||'');
        if(!id)throw transitionError(event,'recovery transaction id is required');
        const current=state.recovery.transaction;
        if(current&&current.id!==id&&!String(current.id).startsWith('operation:'))
          throw transitionError(event,'another recovery transaction is already active');
        const reason=String(event.reason||'Authoritative recovery verification is required.');
        return commit({
          safety:state.safety.status===DEVICE_RUNTIME_SAFETY.UNSAFE
            ?state.safety
            :{status:DEVICE_RUNTIME_SAFETY.RECOVERY_REQUIRED,reason},
          recovery:{
            hydrated:true,
            transaction:{id,source:String(event.source||''),reason,verified:false,verification:null}
          }
        });
      }
      case'RECOVERY_VERIFIED':{
        const transaction=recoveryMatch(event);
        return commit({recovery:{
          ...state.recovery,
          transaction:{...transaction,verified:true,verification:sanitizeVerification(event.verification)}
        }});
      }
      case'RECOVERY_ACKNOWLEDGED':{
        recoveryMatch(event,{requireVerified:true});
        return commit({
          safety:state.safety.status===DEVICE_RUNTIME_SAFETY.RECOVERY_REQUIRED
            ?{status:DEVICE_RUNTIME_SAFETY.SAFE,reason:null}
            :state.safety,
          recovery:{...state.recovery,transaction:null}
        });
      }
      default:
        throw transitionError(event,'unknown event '+String(event.type));
    }
  };

  const assertCanStartFileOperation=({mode='read'}={})=>{
    const normalized=String(mode||'read');
    if(normalized!=='read'&&normalized!=='mutation')throw transitionError({type:'FILE_OPERATION_ADMISSION'},'unknown FILE operation mode '+normalized);
    if(!canStartFileOperation(normalized))throw operationBlocked({mode:normalized});
    return state;
  };

  return Object.freeze({
    getSnapshot:()=>state,
    subscribe(listener){
      if(typeof listener!=='function')throw new TypeError('EP device runtime listener must be a function.');
      listeners.add(listener);
      return()=>listeners.delete(listener);
    },
    dispatch,
    assertCanStartFileOperation,
    captureEpoch:()=>state.connection.epoch,
    assertEpoch:epoch=>{exactEpoch(epoch);return epoch;},
    now
  });
}

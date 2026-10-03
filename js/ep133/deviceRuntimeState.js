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
const freezeState=state=>Object.freeze({
  connection:Object.freeze({...state.connection}),
  ownership:Object.freeze({...state.ownership}),
  operation:Object.freeze({
    ...state.operation,
    active:state.operation.active?Object.freeze({...state.operation.active}):null
  }),
  safety:Object.freeze({...state.safety}),
  recovery:Object.freeze({...state.recovery}),
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
        return commit({
          connection:{status:DEVICE_RUNTIME_CONNECTION.CONNECTED,epoch,device:sanitizeDevice(event.device)},
          recovery:{...state.recovery,hydrated:false}
        });
      }
      case'DEVICE_DISCONNECTED':{
        const epoch=Number(event.connectionEpoch);
        if(!Number.isInteger(epoch)||epoch<state.connection.epoch)throw staleEpoch(event.connectionEpoch);
        return commit({
          connection:{status:DEVICE_RUNTIME_CONNECTION.DISCONNECTED,epoch,device:null},
          operation:{phase:DEVICE_RUNTIME_OPERATION.IDLE,active:null},
          recovery:{...state.recovery,hydrated:false}
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
      default:
        throw transitionError(event,'unknown event '+String(event.type));
    }
  };

  const assertCanStartFileOperation=({mode='read'}={})=>{
    const normalized=String(mode||'read');
    if(normalized!=='read'&&normalized!=='mutation')throw transitionError({type:'FILE_OPERATION_ADMISSION'},'unknown FILE operation mode '+normalized);
    const allowed=
      state.connection.status===DEVICE_RUNTIME_CONNECTION.CONNECTED&&
      state.connection.device?.identityVerified===true&&
      state.ownership.status===DEVICE_RUNTIME_OWNERSHIP.OWNED&&
      state.operation.phase===DEVICE_RUNTIME_OPERATION.IDLE&&
      state.safety.status===DEVICE_RUNTIME_SAFETY.SAFE&&
      state.recovery.hydrated===true;
    if(!allowed)throw runtimeError(
      EP_ERROR_CODE.DEVICE_RUNTIME_OPERATION_BLOCKED,
      'EP-series FILE operation is blocked by device runtime state.',
      {mode:normalized,status:state.status,connectionEpoch:state.connection.epoch},
      EP_ERROR_CATEGORY.SAFETY
    );
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

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
const freezeTransaction=transaction=>transaction?Object.freeze({...transaction}):null;
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

  const dispatch=event=>{
    const type=String(event?.type||'');
    switch(type){
      case 'CONNECT_STARTED':
        return replace({
          connection:{status:DEVICE_RUNTIME_CONNECTION.CONNECTING,epoch:state.connection.epoch,device:null},
          recovery:{hydrated:false,transaction:null},externalInterference:null
        });
      case 'DEVICE_CONNECTED':{
        const epoch=Number(event.connectionEpoch);
        if(!Number.isInteger(epoch)||epoch<=0)invalid('DEVICE_CONNECTED requires a positive connection epoch.',event);
        return replace({
          connection:{status:DEVICE_RUNTIME_CONNECTION.CONNECTED,epoch,device:freezeDevice(event.device)},
          recovery:{hydrated:false,transaction:null}
        });
      }
      case 'OWNERSHIP_ACQUIRED':
        return replace({ownership:{status:DEVICE_RUNTIME_OWNERSHIP.OWNED,reason:null}});
      case 'OWNERSHIP_BLOCKED':
        return replace({ownership:{status:DEVICE_RUNTIME_OWNERSHIP.BLOCKED,reason:String(event.reason||'EP session ownership is blocked.')}});
      case 'RECOVERY_SCAN_STARTED':
        return replace({recovery:{...state.recovery,hydrated:false}});
      case 'RECOVERY_SCAN_COMPLETED':
        return replace({recovery:{hydrated:true,transaction:null}});
      default:return invalid('Unknown EP device runtime event: '+type,event);
    }
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

  const captureEpoch=()=>state.connection.epoch;
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

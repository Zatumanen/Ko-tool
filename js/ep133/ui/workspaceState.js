const STORAGE_VERSION=1;
export const MY_EP_WORKSPACE_STORAGE_KEY='speeduppercut-my-ep-workspace-v1';
const RECOVERY_REQUIRED='requires-recovery';
const DEFAULT_FILE_OPERATION_LABEL='FILE operation';

const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const safeText=(value,max=200)=>String(value??'').slice(0,max);
const safeTime=value=>Number.isFinite(Number(value))?Number(value):0;
const safeIso=value=>{
  const date=new Date(value||0);
  return Number.isFinite(date.getTime())?date.toISOString():null;
};
const normalizeView=value=>value==='projects'?'projects':'samples';
const normalizeDevice=device=>{
  if(!device||typeof device!=='object')return null;
  const firmware=safeText(device?.metadata?.os_version||device?.metadata?.sw_version||device?.firmware||'',80);
  const sku=safeText(device?.sku||'',80).toUpperCase();
  return sku||firmware?Object.freeze({sku,firmware}):null;
};
const normalizeError=error=>error&&typeof error==='object'?Object.freeze({
  code:safeText(error.code||'',100),
  category:safeText(error.category||'',80),
  recovery:safeText(error.recovery||'',300)
}):null;
const normalizeLastOperation=operation=>{
  if(!operation||typeof operation!=='object')return null;
  const label=safeText(operation.label||'',200);
  if(!label)return null;
  return Object.freeze({
    label,
    status:safeText(operation.status||'completed',60),
    at:safeTime(operation.at),
    error:normalizeError(operation.error)
  });
};
const normalizeActiveOperation=(active,state='idle')=>active?Object.freeze({
  id:Number(active.id)||0,
  label:safeText(active.label||DEFAULT_FILE_OPERATION_LABEL,200),
  mode:safeText(active.mode||'read',40),
  phase:safeText(active.phase||state||'idle',40),
  startedAt:safeTime(active.startedAt)
}):null;
const normalizeExternalInterference=input=>input?Object.freeze({
  at:safeTime(input.at),
  requestId:Number.isInteger(Number(input.requestId))?Number(input.requestId):null
}):null;
const idleCoordinator=state=>Object.freeze({state,active:null,externalInterference:null});
const idleProjectRuntime=()=>Object.freeze({settling:false,settlingUntil:0,remainingMs:0});
const readPersisted=(storage,key)=>{
  try{
    const parsed=JSON.parse(storage?.getItem?.(key)||'null');
    if(!parsed||parsed.version!==STORAGE_VERSION)return{};
    return{
      viewMode:normalizeView(parsed.viewMode),
      lastOperation:normalizeLastOperation(parsed.lastOperation),
      lastDevice:normalizeDevice(parsed.lastDevice)
    };
  }catch{return{};}
};
const writePersisted=(storage,key,state)=>{
  try{
    storage?.setItem?.(key,JSON.stringify({
      version:STORAGE_VERSION,
      viewMode:state.view.mode,
      lastOperation:state.lastOperation,
      lastDevice:state.lastDevice
    }));
  }catch{}
};
const sampleNeedsRecovery=record=>
  record?.status===RECOVERY_REQUIRED||record?.transactionStatus===RECOVERY_REQUIRED||record?.recoveryDetail?.requiresRecovery===true;
const projectNeedsRecovery=record=>record?.status===RECOVERY_REQUIRED;

export function createMyEpWorkspaceState({
  storageRef=globalThis.localStorage,
  storageKey=MY_EP_WORKSPACE_STORAGE_KEY,
  now=()=>Date.now()
}={}){
  const persisted=readPersisted(storageRef,storageKey);
  const listeners=new Set();
  let state={
    connection:Object.freeze({status:'disconnected',unsafe:false,device:null}),
    coordinator:idleCoordinator('idle'),
    projectRuntime:idleProjectRuntime(),
    recovery:Object.freeze({required:false,sampleRequired:0,projectRequired:0}),
    view:Object.freeze({mode:persisted.viewMode||'samples'}),
    lastOperation:persisted.lastOperation||null,
    lastDevice:persisted.lastDevice||null
  };

  const snapshot=()=>Object.freeze(clone(state));
  const emit=()=>{
    const next=snapshot();
    for(const listener of listeners){try{listener(next);}catch{}}
  };
  const persist=()=>writePersisted(storageRef,storageKey,state);
  const replace=patch=>{state={...state,...patch};emit();return snapshot();};

  const setConnection=input=>{
    const connected=!!input?.connected;
    const unsafe=!!input?.unsafe;
    const device=connected?normalizeDevice(input?.device):null;
    const lastDevice=device||state.lastDevice;
    const connection=Object.freeze({
      status:unsafe?'unsafe':connected?'connected':'disconnected',
      unsafe,
      device
    });
    state={
      ...state,
      connection,
      lastDevice,
      coordinator:connected?state.coordinator:idleCoordinator(unsafe?'unsafe':'idle'),
      projectRuntime:connected?state.projectRuntime:idleProjectRuntime()
    };
    persist();emit();return snapshot();
  };

  const setCoordinator=input=>replace({coordinator:Object.freeze({
    state:safeText(input?.state||'idle',40),
    active:normalizeActiveOperation(input?.active,input?.state),
    externalInterference:normalizeExternalInterference(input?.externalInterference)
  })});

  const setRuntime=input=>{
    const connectionStatus=safeText(input?.connection?.status||'disconnected',40);
    const safetyStatus=safeText(input?.safety?.status||'safe',40);
    const runtimeStatus=safeText(input?.status||'',40);
    const ownershipStatus=safeText(input?.ownership?.status||'none',40);
    const connected=connectionStatus==='connected';
    const unsafe=safetyStatus==='unsafe'||runtimeStatus==='unsafe';
    const device=connected?normalizeDevice(input?.connection?.device):null;
    const lastDevice=device||state.lastDevice;
    const operationPhase=safeText(input?.operation?.phase||'idle',40);
    const blocked=
      safetyStatus==='blocked'||safetyStatus==='recovery-required'||
      ownershipStatus==='blocked'||runtimeStatus==='blocked'||runtimeStatus==='recovery-required';
    const coordinatorState=unsafe?'unsafe':blocked?'blocked':operationPhase;
    state={
      ...state,
      connection:Object.freeze({
        status:unsafe?'unsafe':connected?'connected':'disconnected',
        unsafe,
        device
      }),
      coordinator:Object.freeze({
        state:coordinatorState||'idle',
        active:normalizeActiveOperation(input?.operation?.active,operationPhase),
        externalInterference:normalizeExternalInterference(input?.externalInterference)
      }),
      projectRuntime:connected?state.projectRuntime:idleProjectRuntime(),
      lastDevice
    };
    persist();emit();return snapshot();
  };

  const setProjectRuntime=input=>replace({projectRuntime:Object.freeze({
    settling:!!input?.settling,
    settlingUntil:safeTime(input?.settlingUntil),
    remainingMs:Math.max(0,Number(input?.remainingMs)||0)
  })});

  const setRecovery=({sampleTransactions=[],projectCheckpoints=[]}={})=>{
    const sampleRequired=(Array.isArray(sampleTransactions)?sampleTransactions:[]).filter(sampleNeedsRecovery).length;
    const projectRequired=(Array.isArray(projectCheckpoints)?projectCheckpoints:[]).filter(projectNeedsRecovery).length;
    return replace({recovery:Object.freeze({
      required:sampleRequired+projectRequired>0,
      sampleRequired,
      projectRequired
    })});
  };

  const setView=mode=>{
    state={...state,view:Object.freeze({mode:normalizeView(mode)})};
    persist();emit();return snapshot();
  };

  const recordOperation=operation=>{
    const normalized=normalizeLastOperation({...operation,at:operation?.at||now()});
    if(!normalized||operation?.mode==='read'||normalized.label===DEFAULT_FILE_OPERATION_LABEL)return snapshot();
    if(state.lastOperation&&normalized.at<state.lastOperation.at)return snapshot();
    state={...state,lastOperation:normalized};
    persist();emit();return snapshot();
  };

  return Object.freeze({
    getState:snapshot,setConnection,setCoordinator,setRuntime,setProjectRuntime,setRecovery,setView,recordOperation,
    subscribe(listener){
      if(typeof listener!=='function')return()=>{};
      listeners.add(listener);
      try{listener(snapshot());}catch{}
      return()=>listeners.delete(listener);
    }
  });
}

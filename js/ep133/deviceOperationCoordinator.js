import{createEpError,EP_ERROR_CATEGORY,EP_ERROR_CODE}from './errors.js?v=20261001-1';

export const DEVICE_OPERATION_PHASE=Object.freeze({
  IDLE:'idle',
  READING:'reading',
  MUTATING:'mutating',
  VERIFYING:'verifying',
  BLOCKED:'blocked',
  UNSAFE:'unsafe'
});

const ACTIVE_PHASES=new Set([
  DEVICE_OPERATION_PHASE.READING,
  DEVICE_OPERATION_PHASE.MUTATING,
  DEVICE_OPERATION_PHASE.VERIFYING
]);

const blockedError=reason=>createEpError(
  EP_ERROR_CODE.FILE_COORDINATOR_BLOCKED,
  'EP-series FILE coordinator blocked: '+String(reason||'unknown coordinator state'),
  {
    category:EP_ERROR_CATEGORY.SAFETY,
    retryable:false,
    recovery:'Reconnect the device after clearing the conflicting FILE session.',
    details:{reason:String(reason||'unknown coordinator state')},
    name:'EPFileCoordinatorError'
  }
);

export function createDeviceOperationCoordinator({
  runtime=null,
  markUnsafe=()=>{},
  isUnsafe=()=>false,
  now=()=>Date.now(),
  nextOperationId=null,
  onStateChange=()=>{}
}={}){
  let active=null;
  let externalInterference=null;
  let nextId=1;

  const runtimeSnapshot=()=>runtime?.getSnapshot?.()||null;
  const snapshot=()=>{
    const shared=runtimeSnapshot();
    const sharedState=shared?.status;
    const state=isUnsafe()||sharedState===DEVICE_OPERATION_PHASE.UNSAFE
      ?DEVICE_OPERATION_PHASE.UNSAFE
      :externalInterference||sharedState===DEVICE_OPERATION_PHASE.BLOCKED||sharedState==='recovery-required'
        ?DEVICE_OPERATION_PHASE.BLOCKED
        :(active?.phase||DEVICE_OPERATION_PHASE.IDLE);
    return Object.freeze({
      state,
      active:active?{...active}:null,
      externalInterference:externalInterference?{...externalInterference}:null
    });
  };
  const notify=()=>onStateChange(snapshot());
  const assertAvailable=({mode='read'}={})=>{
    if(isUnsafe())throw blockedError('FILE safety lock is active: device safety lock is active');
    if(externalInterference)throw blockedError(externalInterference.reason);
    runtime?.assertCanStartFileOperation?.({mode});
    if(active)throw blockedError('operation '+active.label+' is already active');
  };

  const waitForRecoveryHydration=()=>{
    if(!runtime?.subscribe)return Promise.resolve();
    const shouldWait=shared=>
      shared?.connection?.status==='connected'&&
      shared?.ownership?.status==='owned'&&
      shared?.safety?.status==='safe'&&
      shared?.recovery?.hydrated===false;
    if(!shouldWait(runtimeSnapshot()))return Promise.resolve();
    return new Promise(resolve=>{
      let settled=false;
      let unsubscribe=()=>{};
      const finish=()=>{
        if(settled)return;
        settled=true;
        unsubscribe();
        resolve();
      };
      unsubscribe=runtime.subscribe(shared=>{
        if(!shouldWait(shared))finish();
      });
      if(!shouldWait(runtimeSnapshot()))finish();
    });
  };

  const begin=(label,{mode='read'}={})=>{
    const normalizedMode=mode==='mutation'?'mutation':'read';
    assertAvailable({mode:normalizedMode});
    const operationId=typeof nextOperationId==='function'?nextOperationId():nextId++;
    const connectionEpoch=runtime?.captureEpoch?.();
    const token={
      id:operationId,
      label:String(label||'FILE operation'),
      mode:normalizedMode,
      phase:normalizedMode==='mutation'?DEVICE_OPERATION_PHASE.MUTATING:DEVICE_OPERATION_PHASE.READING,
      startedAt:now(),
      connectionEpoch:Number.isInteger(connectionEpoch)?connectionEpoch:null
    };
    if(runtime){
      runtime.dispatch({
        type:'FILE_OPERATION_STARTED',
        connectionEpoch:token.connectionEpoch,
        operationId:token.id,
        label:token.label,
        mode:token.mode
      });
    }
    active=token;
    notify();
    let closed=false;
    const assertLease=()=>{
      if(closed||active?.id!==token.id)throw blockedError('operation lease is no longer active');
    };
    return Object.freeze({
      getState:snapshot,
      setPhase(phase){
        assertLease();
        if(!ACTIVE_PHASES.has(phase))throw createEpError(
          EP_ERROR_CODE.REQUEST_REJECTED,
          'Invalid FILE operation phase: '+String(phase),
          {category:EP_ERROR_CATEGORY.VALIDATION,details:{phase}}
        );
        if(runtime&&phase===DEVICE_OPERATION_PHASE.VERIFYING){
          runtime.dispatch({
            type:'FILE_OPERATION_VERIFYING',
            connectionEpoch:token.connectionEpoch,
            operationId:token.id
          });
        }
        active={...active,phase};
        notify();
        return phase;
      },
      close(){
        if(closed)return;
        closed=true;
        if(runtime){
          const shared=runtimeSnapshot();
          if(shared?.operation?.active?.id===token.id){
            runtime.dispatch({
              type:'FILE_OPERATION_FINISHED',
              connectionEpoch:token.connectionEpoch,
              operationId:token.id
            });
          }
        }
        if(active?.id===token.id)active=null;
        notify();
      }
    });
  };

  const run=async(label,operation,{mode='read'}={})=>{
    if(typeof operation!=='function')throw new TypeError('Device operation coordinator requires an operation.');
    await waitForRecoveryHydration();
    const lease=begin(label,{mode});
    try{return await operation(lease);}
    finally{lease.close();}
  };

  const observeUnexpectedFileTraffic=(detail={})=>{
    const requestId=Number(detail.requestId);
    const requestLabel=Number.isInteger(requestId)&&requestId>0?' request '+requestId:'';
    const activeAtDetection=active?{...active}:null;
    const reason=active
      ?'Unexpected EP-series FILE response'+requestLabel+' during '+active.phase+' operation "'+active.label+'". Another EP tool may be using the device; FILE session state is unknown.'
      :'Unexpected EP-series FILE response'+requestLabel+' while Ko-tool was idle. Another EP tool may be using the device. Close other EP tools and reconnect before FILE operations.';
    externalInterference={
      at:now(),
      requestId:Number.isInteger(requestId)?requestId:null,
      status:Number.isFinite(Number(detail.status))?Number(detail.status):null,
      reason,
      active:activeAtDetection
    };
    if(runtime){
      runtime.dispatch({
        type:'UNEXPECTED_FILE_TRAFFIC',
        connectionEpoch:runtime.captureEpoch(),
        requestId:externalInterference.requestId,
        reason
      });
    }
    if(active)markUnsafe(reason);
    notify();
    return snapshot();
  };

  const reset=()=>{
    active=null;
    externalInterference=null;
    notify();
  };

  return Object.freeze({
    begin,run,reset,observeUnexpectedFileTraffic,
    getState:snapshot,
    assertAvailable
  });
}

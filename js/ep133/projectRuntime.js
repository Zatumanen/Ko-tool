import{createEpError,EP_ERROR_CATEGORY,EP_ERROR_CODE}from './errors.js?v=20261001-1';

export const PROJECT_RUNTIME_SETTLE_MS=6000;

export function createProjectRuntimeGate({settleMs=PROJECT_RUNTIME_SETTLE_MS,now=()=>Date.now()}={}){
  const duration=Number(settleMs);
  if(!Number.isFinite(duration)||duration<0)throw new TypeError('Project runtime settle duration must be a non-negative number.');
  let settlingUntil=0;

  const getState=()=>{
    const current=Number(now());
    if(!Number.isFinite(current))throw new TypeError('Project runtime clock must return a finite number.');
    const remainingMs=Math.max(0,settlingUntil-current);
    return{settling:remainingMs>0,settlingUntil,remainingMs};
  };

  const markReload=()=>{
    const current=Number(now());
    if(!Number.isFinite(current))throw new TypeError('Project runtime clock must return a finite number.');
    settlingUntil=Math.max(settlingUntil,current+duration);
    return getState();
  };

  const reset=()=>{
    settlingUntil=0;
    return getState();
  };

  const assertSettled=(label='project operation')=>{
    const state=getState();
    if(!state.settling)return state;
    const seconds=Math.max(1,Math.ceil(state.remainingMs/1000));
    throw createEpError(
      EP_ERROR_CODE.PROJECT_RUNTIME_SETTLING,
      'EP project runtime is still settling after reload; '+String(label||'project operation')+' is blocked for about '+seconds+' more second'+(seconds===1?'':'s')+'.',
      {
        category:EP_ERROR_CATEGORY.RUNTIME,
        retryable:true,
        details:{label:String(label||'project operation'),remainingMs:state.remainingMs,settlingUntil:state.settlingUntil},
        name:'EPProjectRuntimeError'
      }
    );
  };

  return{markReload,reset,getState,assertSettled};
}

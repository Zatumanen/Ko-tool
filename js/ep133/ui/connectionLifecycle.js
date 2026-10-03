import{createDeviceSessionOwnership}from './deviceSessionOwnership.js?v=20261001-1';
import{dispatchDeviceRuntimeEvent}from '../deviceRuntime.js';

export function createConnectionLifecycle({
  connectEp133,
  isConnected,
  isUnsafe=()=>false,
  setConnectionOverlay=()=>{},
  setSessionNotice=()=>{},
  showError=()=>{},
  logTechnical=()=>{},
  navigatorRef=globalThis.navigator,
  windowRef=globalThis.window,
  BroadcastChannelRef=globalThis.BroadcastChannel,
  sessionOwnership=null,
  publishRuntimeEvent=dispatchDeviceRuntimeEvent,
  setIntervalFn=globalThis.setInterval,
  clearIntervalFn=globalThis.clearInterval,
  reconnectIntervalMs=4000
}={}){
  if(typeof connectEp133!=='function'||typeof isConnected!=='function')
    throw new TypeError('Connection lifecycle requires connectEp133 and isConnected.');

  let connectionArmed=false;
  let midiPermissionBlocked=false;
  let instanceLockBlocked=false;
  let externalToolNoticeShown=false;
  let autoConnectTimer=null;
  let started=false;
  let runtimeOwnership='none';

  const publishOwnership=type=>{
    const next=type==='OWNERSHIP_ACQUIRED'?'owned':type==='OWNERSHIP_BLOCKED'?'blocked':'none';
    if(runtimeOwnership===next)return;
    runtimeOwnership=next;
    try{publishRuntimeEvent?.({type});}
    catch(error){logTechnical('EP RUNTIME OWNERSHIP',error);}
  };

  const ownership=sessionOwnership||createDeviceSessionOwnership({
    navigatorRef,BroadcastChannelRef,
    logTechnical,
    onStateChange:state=>{
      instanceLockBlocked=state.blocked&&!state.owned;
      if(state.owned)publishOwnership('OWNERSHIP_ACQUIRED');
      else if(instanceLockBlocked)publishOwnership('OWNERSHIP_BLOCKED');
      else publishOwnership('OWNERSHIP_LOST');
      if(instanceLockBlocked)setConnectionOverlay('OPEN IN ANOTHER KO-TOOL TAB');
    }
  });

  const ensureOwnership=async()=>{
    const acquired=await ownership.acquire();
    instanceLockBlocked=!acquired;
    if(!acquired){
      publishOwnership('OWNERSHIP_BLOCKED');
      setConnectionOverlay('OPEN IN ANOTHER KO-TOOL TAB');
      return false;
    }
    publishOwnership('OWNERSHIP_ACQUIRED');
    if(!externalToolNoticeShown){
      externalToolNoticeShown=true;
      setSessionNotice('CLOSE OTHER EP TOOLS BEFORE FILE OPERATIONS');
    }
    return true;
  };

  const autoConnect=async()=>{
    if(!connectionArmed||isUnsafe()||isConnected()||midiPermissionBlocked)return;
    if(!await ensureOwnership())return;
    try{
      await connectEp133();
    }catch(error){
      const message=String(error?.message||error);
      if(error?.name==='NotAllowedError'||/permission|denied/i.test(message)){
        midiPermissionBlocked=true;
        showError('MIDI ACCESS DENIED. ALLOW SYSEX AND RELOAD.');
        return;
      }
      if(/not supported/i.test(message)){
        midiPermissionBlocked=true;
        showError('WEB MIDI IS NOT SUPPORTED IN THIS BROWSER.');
        return;
      }
      if(!/No MIDI ports|was not found/i.test(message))logTechnical('AUTO CONNECT',error);
    }
  };

  const arm=()=>{connectionArmed=true;};

  const dispose=()=>{
    if(autoConnectTimer!=null){
      clearIntervalFn?.(autoConnectTimer);
      autoConnectTimer=null;
    }
    ownership.dispose();
    publishOwnership('OWNERSHIP_LOST');
  };

  const start=()=>{
    if(started)return;
    started=true;
    ownership.start();
    autoConnectTimer=setIntervalFn?.(()=>{
      if(connectionArmed&&!isUnsafe()&&!isConnected())void autoConnect();
    },reconnectIntervalMs);
    windowRef?.addEventListener?.('beforeunload',dispose,{once:true});
  };

  const getState=()=>({
    connectionArmed,
    midiPermissionBlocked,
    instanceLockBlocked,
    externalToolNoticeShown,
    started,
    ownership:ownership.getState()
  });

  return{start,arm,autoConnect,dispose,getState};
}

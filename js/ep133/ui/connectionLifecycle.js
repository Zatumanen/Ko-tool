import{createDeviceSessionOwnership}from './deviceSessionOwnership.js?v=20261001-1';
import{dispatchDeviceRuntimeEvent}from '../deviceRuntime.js?v=20261003-1';

export function createConnectionLifecycle({
  connectEp133,
  isConnected,
  isUnsafe=()=>false,
  setConnectionOverlay=()=>{},
  setSessionNotice=()=>{},
  showError=()=>{},
  logTechnical=()=>{},
  publishRuntimeEvent=dispatchDeviceRuntimeEvent,
  navigatorRef=globalThis.navigator,
  windowRef=globalThis.window,
  BroadcastChannelRef=globalThis.BroadcastChannel,
  sessionOwnership=null,
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
  let lastPublishedOwnership=null;

  const publishOwnershipState=state=>{
    const next=state?.owned?'owned':state?.blocked?'blocked':'none';
    if(next===lastPublishedOwnership)return;
    lastPublishedOwnership=next;
    if(next==='owned')publishRuntimeEvent?.({type:'OWNERSHIP_ACQUIRED'});
    else if(next==='blocked')publishRuntimeEvent?.({
      type:'OWNERSHIP_BLOCKED',reason:'Another SpeedUpperCut tab owns the EP session.'
    });
    else publishRuntimeEvent?.({type:'OWNERSHIP_LOST',reason:'EP session ownership released.'});
  };
  const applyOwnershipState=state=>{
    instanceLockBlocked=!!(state?.blocked&&!state?.owned);
    publishOwnershipState(state);
    if(instanceLockBlocked)setConnectionOverlay('OPEN IN ANOTHER KO-TOOL TAB');
  };

  const ownership=sessionOwnership||createDeviceSessionOwnership({
    navigatorRef,BroadcastChannelRef,
    logTechnical,
    onStateChange:applyOwnershipState
  });

  const ensureOwnership=async()=>{
    const acquired=await ownership.acquire();
    const ownershipState=ownership.getState?.()||{owned:acquired,blocked:!acquired};
    applyOwnershipState(ownershipState);
    instanceLockBlocked=!acquired;
    if(!acquired){
      setConnectionOverlay('OPEN IN ANOTHER KO-TOOL TAB');
      return false;
    }
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
    publishOwnershipState({owned:false,blocked:false});
  };

  const start=()=>{
    if(started)return;
    started=true;
    ownership.start();
    publishOwnershipState(ownership.getState?.()||{owned:false,blocked:false});
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

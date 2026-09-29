export function createConnectionLifecycle({
  connectEp133,
  isConnected,
  isUnsafe=()=>false,
  setConnectionOverlay=()=>{},
  showError=()=>{},
  logTechnical=()=>{},
  navigatorRef=globalThis.navigator,
  windowRef=globalThis.window,
  setIntervalFn=globalThis.setInterval,
  clearIntervalFn=globalThis.clearInterval,
  reconnectIntervalMs=4000
}={}){
  if(typeof connectEp133!=='function'||typeof isConnected!=='function')
    throw new TypeError('Connection lifecycle requires connectEp133 and isConnected.');

  let connectionArmed=false;
  let midiPermissionBlocked=false;
  let instanceLockBlocked=false;
  let resolveInstanceLock;
  let autoConnectTimer=null;
  let started=false;

  const instanceLockGate=new Promise(resolve=>{resolveInstanceLock=resolve;});

  const startInstanceLock=()=>{
    if(navigatorRef?.locks?.request){
      navigatorRef.locks.request('ep-sample-util',{ifAvailable:true},lock=>{
        if(!lock){
          instanceLockBlocked=true;
          resolveInstanceLock(false);
          setConnectionOverlay('OPEN IN ANOTHER TAB');
          return;
        }
        resolveInstanceLock(true);
        return new Promise(()=>{});
      }).catch(error=>{
        logTechnical('INSTANCE LOCK',error);
        resolveInstanceLock(true);
      });
    }else resolveInstanceLock(true);
  };

  const autoConnect=async()=>{
    if(!connectionArmed||isUnsafe()||isConnected()||midiPermissionBlocked||instanceLockBlocked)return;
    if(!await instanceLockGate){
      setConnectionOverlay('OPEN IN ANOTHER TAB');
      return;
    }
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
  };

  const start=()=>{
    if(started)return;
    started=true;
    startInstanceLock();
    autoConnectTimer=setIntervalFn?.(()=>{
      if(connectionArmed&&!isUnsafe()&&!isConnected())void autoConnect();
    },reconnectIntervalMs);
    windowRef?.addEventListener?.('beforeunload',dispose,{once:true});
  };

  const getState=()=>({
    connectionArmed,
    midiPermissionBlocked,
    instanceLockBlocked,
    started
  });

  return{start,arm,autoConnect,dispose,getState};
}

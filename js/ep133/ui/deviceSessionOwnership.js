const DEFAULT_LOCK_NAME='ep-sample-util';
const DEFAULT_CHANNEL_NAME='speeduppercut-ep-session';
const DEFAULT_HEARTBEAT_MS=2000;
const DEFAULT_STALE_MS=7000;
const DEFAULT_DISCOVERY_MS=40;

const makeInstanceId=cryptoRef=>{
  if(typeof cryptoRef?.randomUUID==='function')return cryptoRef.randomUUID();
  const random=Math.random().toString(36).slice(2);
  return 'ep-'+Date.now().toString(36)+'-'+random;
};
const wait=(setTimeoutFn,ms)=>new Promise(resolve=>setTimeoutFn(resolve,ms));

export function createDeviceSessionOwnership({
  navigatorRef=globalThis.navigator,
  BroadcastChannelRef=globalThis.BroadcastChannel,
  cryptoRef=globalThis.crypto,
  instanceId=makeInstanceId(cryptoRef),
  lockName=DEFAULT_LOCK_NAME,
  channelName=DEFAULT_CHANNEL_NAME,
  heartbeatIntervalMs=DEFAULT_HEARTBEAT_MS,
  staleAfterMs=DEFAULT_STALE_MS,
  discoveryMs=DEFAULT_DISCOVERY_MS,
  now=()=>Date.now(),
  setIntervalFn=globalThis.setInterval,
  clearIntervalFn=globalThis.clearInterval,
  setTimeoutFn=globalThis.setTimeout,
  logTechnical=()=>{},
  onStateChange=()=>{}
}={}){
  let started=false;
  let disposed=false;
  let owned=false;
  let blocked=false;
  let mode='none';
  let ownerId=null;
  let ownerLastSeen=0;
  let channel=null;
  let heartbeatTimer=null;
  let releaseWebLock=null;
  let acquirePromise=null;
  let lockRequestPromise=null;
  const candidates=new Set();

  const snapshot=()=>Object.freeze({
    started,disposed,owned,blocked,mode,
    instanceId,ownerId:owned?instanceId:ownerId,
    externalToolsCoordinated:false,
    externalToolWarning:'Close other EP tools before FILE operations.'
  });
  const notify=()=>onStateChange(snapshot());
  const isFreshOwner=()=>ownerId&&now()-ownerLastSeen<=staleAfterMs;
  const clearStaleOwner=()=>{
    if(ownerId&&!isFreshOwner()){
      ownerId=null;
      ownerLastSeen=0;
      blocked=false;
    }
  };
  const post=(type,extra={})=>{
    try{channel?.postMessage?.({type,instanceId,at:now(),...extra});}
    catch(error){logTechnical('EP SESSION BROADCAST',error);}
  };
  const stopHeartbeat=()=>{
    if(heartbeatTimer!=null){
      clearIntervalFn?.(heartbeatTimer);
      heartbeatTimer=null;
    }
  };
  const startHeartbeat=()=>{
    stopHeartbeat();
    post('owner');
    heartbeatTimer=setIntervalFn?.(()=>post('owner'),heartbeatIntervalMs)??null;
  };
  const becomeOwner=nextMode=>{
    owned=true;
    blocked=false;
    mode=nextMode;
    ownerId=instanceId;
    ownerLastSeen=now();
    startHeartbeat();
    notify();
    return true;
  };
  const loseOwnership=(nextOwner=null)=>{
    owned=false;
    blocked=!!nextOwner;
    if(mode!=='web-lock')mode='none';
    ownerId=nextOwner;
    ownerLastSeen=nextOwner?now():0;
    stopHeartbeat();
    notify();
  };

  const onMessage=event=>{
    const message=event?.data||{};
    const other=String(message.instanceId||'');
    if(!other||other===instanceId)return;
    const type=String(message.type||'');
    if(type==='probe'){
      if(owned)post('owner');
      return;
    }
    if(type==='candidate'){
      candidates.add(other);
      if(owned)post('owner');
      return;
    }
    if(type==='owner'){
      if(mode==='broadcast-fallback'&&owned&&other<instanceId){
        loseOwnership(other);
        post('owner-ack',{ownerId:other});
        return;
      }
      if(!owned){
        ownerId=other;
        ownerLastSeen=now();
        blocked=true;
        notify();
      }
      return;
    }
    if(type==='release'){
      if(ownerId===other){
        ownerId=null;
        ownerLastSeen=0;
        blocked=false;
        notify();
      }
    }
  };

  const start=()=>{
    if(started||disposed)return;
    started=true;
    if(typeof BroadcastChannelRef==='function'){
      try{
        channel=new BroadcastChannelRef(channelName);
        channel.addEventListener?.('message',onMessage);
        if(!channel.addEventListener)channel.onmessage=onMessage;
        post('probe');
      }catch(error){logTechnical('EP SESSION CHANNEL',error);channel=null;}
    }
    notify();
  };

  const acquireFallback=async()=>{
    clearStaleOwner();
    if(owned)return true;
    if(isFreshOwner()){
      blocked=true;
      notify();
      return false;
    }
    candidates.clear();
    candidates.add(instanceId);
    post('candidate');
    post('probe');
    await wait(setTimeoutFn,discoveryMs);
    clearStaleOwner();
    if(isFreshOwner()&&ownerId!==instanceId){
      blocked=true;
      notify();
      return false;
    }
    const winner=[...candidates].sort()[0];
    if(winner!==instanceId){
      ownerId=winner;
      ownerLastSeen=now();
      blocked=true;
      notify();
      return false;
    }
    return becomeOwner('broadcast-fallback');
  };

  const acquireWebLock=()=>{
    if(acquirePromise)return acquirePromise;
    acquirePromise=new Promise(resolve=>{
      try{
        lockRequestPromise=navigatorRef.locks.request(lockName,{ifAvailable:true},lock=>{
          if(!lock){
            blocked=true;
            mode='web-lock';
            clearStaleOwner();
            notify();
            resolve(false);
            return;
          }
          becomeOwner('web-lock');
          resolve(true);
          return new Promise(release=>{releaseWebLock=release;});
        });
        Promise.resolve(lockRequestPromise).catch(error=>{
          logTechnical('EP SESSION LOCK',error);
          acquirePromise=null;
          void acquireFallback().then(resolve);
        });
      }catch(error){
        logTechnical('EP SESSION LOCK',error);
        acquirePromise=null;
        void acquireFallback().then(resolve);
      }
    });
    return acquirePromise;
  };

  const acquire=async()=>{
    if(disposed)throw new Error('EP session ownership has been disposed.');
    start();
    if(owned)return true;
    clearStaleOwner();
    const result=navigatorRef?.locks?.request
      ?await acquireWebLock()
      :await acquireFallback();
    if(!result)acquirePromise=null;
    return result;
  };

  const release=()=>{
    if(!owned&&releaseWebLock==null)return;
    const wasOwner=owned;
    owned=false;
    blocked=false;
    ownerId=null;
    ownerLastSeen=0;
    stopHeartbeat();
    if(wasOwner)post('release');
    const release=releaseWebLock;
    releaseWebLock=null;
    mode='none';
    acquirePromise=null;
    release?.();
    notify();
  };

  const dispose=()=>{
    if(disposed)return;
    release();
    disposed=true;
    channel?.removeEventListener?.('message',onMessage);
    if(channel&&'onmessage'in channel)channel.onmessage=null;
    channel?.close?.();
    channel=null;
    notify();
  };

  return Object.freeze({
    start,acquire,release,dispose,getState:snapshot,
    isOwner:()=>owned,
    canUseDevice:()=>owned&&!disposed
  });
}

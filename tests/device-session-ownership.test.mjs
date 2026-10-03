import test from 'node:test';
import assert from 'node:assert/strict';
import{createDeviceSessionOwnership}from '../js/ep133/ui/deviceSessionOwnership.js';
import{createConnectionLifecycle}from '../js/ep133/ui/connectionLifecycle.js';

const tick=()=>new Promise(resolve=>setImmediate(resolve));

const makeBroadcastHub=()=>{
  const rooms=new Map();
  return class FakeBroadcastChannel{
    constructor(name){
      this.name=name;
      this.listeners=new Set();
      if(!rooms.has(name))rooms.set(name,new Set());
      rooms.get(name).add(this);
    }
    addEventListener(type,listener){if(type==='message')this.listeners.add(listener);}
    removeEventListener(type,listener){if(type==='message')this.listeners.delete(listener);}
    postMessage(data){
      for(const peer of rooms.get(this.name)||[]){
        if(peer===this)continue;
        queueMicrotask(()=>{for(const listener of peer.listeners)listener({data});});
      }
    }
    close(){rooms.get(this.name)?.delete(this);this.listeners.clear();}
  };
};

const makeLocks=()=>{
  let held=false;
  return{
    request(name,options,callback){
      if(options?.ifAvailable&&held)return Promise.resolve(callback(null));
      held=true;
      return Promise.resolve(callback({name})).finally(()=>{held=false;});
    }
  };
};

test('session ownership uses Web Locks as the authoritative same-origin owner',async()=>{
  const BroadcastChannelRef=makeBroadcastHub();
  const locks=makeLocks();
  const owner=createDeviceSessionOwnership({
    navigatorRef:{locks},BroadcastChannelRef,instanceId:'tab-a',
    heartbeatIntervalMs:100000
  });
  const contender=createDeviceSessionOwnership({
    navigatorRef:{locks},BroadcastChannelRef,instanceId:'tab-b',
    heartbeatIntervalMs:100000
  });

  owner.start();
  contender.start();
  assert.equal(await owner.acquire(),true);
  assert.equal(owner.getState().owned,true);
  assert.equal(owner.getState().mode,'web-lock');

  assert.equal(await contender.acquire(),false);
  assert.equal(contender.getState().blocked,true);
  assert.equal(contender.canUseDevice(),false);

  owner.dispose();
  await tick();
  assert.equal(await contender.acquire(),true);
  assert.equal(contender.canUseDevice(),true);
  contender.dispose();
});

test('BroadcastChannel fallback elects exactly one owner when Web Locks are unavailable',async()=>{
  const BroadcastChannelRef=makeBroadcastHub();
  const options={
    navigatorRef:{},BroadcastChannelRef,
    heartbeatIntervalMs:100000,discoveryMs:5
  };
  const a=createDeviceSessionOwnership({...options,instanceId:'tab-a'});
  const b=createDeviceSessionOwnership({...options,instanceId:'tab-b'});
  a.start();b.start();

  const [aOwns,bOwns]=await Promise.all([a.acquire(),b.acquire()]);
  assert.deepEqual([aOwns,bOwns],[true,false]);
  assert.equal(a.getState().mode,'broadcast-fallback');
  assert.equal(b.getState().ownerId,'tab-a');
  assert.equal(b.getState().blocked,true);

  a.dispose();
  await tick();
  assert.equal(await b.acquire(),true);
  assert.equal(b.getState().mode,'broadcast-fallback');
  b.dispose();
});

test('session ownership state explicitly marks external EP tools as advisory-only coordination',async()=>{
  const ownership=createDeviceSessionOwnership({
    navigatorRef:{},
    BroadcastChannelRef:null,
    instanceId:'single-tab',
    discoveryMs:0,
    setTimeoutFn:callback=>{callback();return 1;},
    heartbeatIntervalMs:100000
  });
  assert.equal(await ownership.acquire(),true);
  const state=ownership.getState();
  assert.equal(state.externalToolsCoordinated,false);
  assert.match(state.externalToolWarning,/Close other EP tools/);
  ownership.dispose();
});

test('connection lifecycle acquires session ownership before MIDI and shows external-tool notice once',async()=>{
  let connectCalls=0,acquireCalls=0,disposeCalls=0;
  const notices=[],overlays=[];
  const ownership={
    start(){},
    async acquire(){acquireCalls++;return true;},
    dispose(){disposeCalls++;},
    getState(){return{owned:true,blocked:false};}
  };
  const lifecycle=createConnectionLifecycle({
    connectEp133:async()=>{connectCalls++;},
    isConnected:()=>false,
    isUnsafe:()=>false,
    sessionOwnership:ownership,
    windowRef:{addEventListener(){}},
    setIntervalFn:()=>1,
    clearIntervalFn(){},
    setConnectionOverlay:value=>overlays.push(value),
    setSessionNotice:value=>notices.push(value)
  });
  lifecycle.start();
  await lifecycle.autoConnect();
  assert.equal(connectCalls,0);
  assert.equal(acquireCalls,0);

  lifecycle.arm();
  await lifecycle.autoConnect();
  await lifecycle.autoConnect();
  assert.equal(connectCalls,2);
  assert.equal(acquireCalls,2);
  assert.deepEqual(notices,['CLOSE OTHER EP TOOLS BEFORE FILE OPERATIONS']);
  assert.equal(lifecycle.getState().externalToolNoticeShown,true);

  lifecycle.dispose();
  assert.equal(disposeCalls,1);
  assert.equal(overlays.length,0);
});

test('connection lifecycle refuses MIDI connection while another Ko-tool tab owns the session',async()=>{
  let connectCalls=0;
  const overlays=[];
  const lifecycle=createConnectionLifecycle({
    connectEp133:async()=>{connectCalls++;},
    isConnected:()=>false,
    isUnsafe:()=>false,
    sessionOwnership:{
      start(){},
      async acquire(){return false;},
      dispose(){},
      getState(){return{owned:false,blocked:true,ownerId:'tab-a'};}
    },
    windowRef:{addEventListener(){}},
    setIntervalFn:()=>1,
    clearIntervalFn(){},
    setConnectionOverlay:value=>overlays.push(value)
  });
  lifecycle.start();
  lifecycle.arm();
  await lifecycle.autoConnect();
  assert.equal(connectCalls,0);
  assert.equal(lifecycle.getState().instanceLockBlocked,true);
  assert.equal(overlays.at(-1),'OPEN IN ANOTHER KO-TOOL TAB');
});

test('connection lifecycle publishes acquired, blocked and lost ownership to runtime boundary',async()=>{
  const acquiredEvents=[];
  const acquired=createConnectionLifecycle({
    connectEp133:async()=>{},isConnected:()=>false,isUnsafe:()=>false,
    sessionOwnership:{
      start(){},async acquire(){return true;},dispose(){},
      getState(){return{owned:true,blocked:false};}
    },
    publishRuntimeEvent:event=>acquiredEvents.push(event),
    windowRef:{addEventListener(){}},setIntervalFn:()=>1,clearIntervalFn(){}
  });
  acquired.start();acquired.arm();await acquired.autoConnect();
  assert.equal(acquiredEvents.some(event=>event.type==='OWNERSHIP_ACQUIRED'),true);
  acquired.dispose();
  assert.equal(acquiredEvents.at(-1).type,'OWNERSHIP_LOST');

  const blockedEvents=[];
  const blocked=createConnectionLifecycle({
    connectEp133:async()=>{},isConnected:()=>false,isUnsafe:()=>false,
    sessionOwnership:{
      start(){},async acquire(){return false;},dispose(){},
      getState(){return{owned:false,blocked:true,ownerId:'tab-a'};}
    },
    publishRuntimeEvent:event=>blockedEvents.push(event),
    windowRef:{addEventListener(){}},setIntervalFn:()=>1,clearIntervalFn(){}
  });
  blocked.start();blocked.arm();await blocked.autoConnect();
  assert.equal(blockedEvents.some(event=>event.type==='OWNERSHIP_BLOCKED'),true);
});

test('ownership loss does not force-abort an already dispatched operation at lifecycle boundary',async()=>{
  const events=[];
  let disposed=0;
  const lifecycle=createConnectionLifecycle({
    connectEp133:async()=>{},isConnected:()=>true,isUnsafe:()=>false,
    sessionOwnership:{
      start(){},async acquire(){return true;},dispose(){disposed++;},
      getState(){return{owned:true,blocked:false};}
    },
    publishRuntimeEvent:event=>events.push(event),
    windowRef:{addEventListener(){}},setIntervalFn:()=>1,clearIntervalFn(){}
  });
  lifecycle.start();
  lifecycle.dispose();
  assert.equal(disposed,1);
  assert.equal(events.at(-1).type,'OWNERSHIP_LOST');
  assert.equal(events.some(event=>event.type==='FILE_OPERATION_FAILED'),false);
});

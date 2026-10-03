import test from 'node:test';
import assert from 'node:assert/strict';
import{createConnectionLifecycle}from '../js/ep133/ui/connectionLifecycle.js';

const lifecycleHarness=({acquired=true}={})=>{
  const events=[];
  let connectCalls=0;
  const ownership={
    start(){},
    async acquire(){return acquired;},
    dispose(){},
    getState(){return acquired?{owned:true,blocked:false}:{owned:false,blocked:true,ownerId:'other-tab'};}
  };
  const lifecycle=createConnectionLifecycle({
    connectEp133:async()=>{connectCalls++;},
    isConnected:()=>false,
    isUnsafe:()=>false,
    sessionOwnership:ownership,
    publishRuntimeEvent:event=>events.push(event),
    windowRef:{addEventListener(){}},
    setIntervalFn:()=>1,
    clearIntervalFn(){},
    setConnectionOverlay(){}
  });
  lifecycle.start();
  lifecycle.arm();
  return{lifecycle,events,getConnectCalls:()=>connectCalls};
};

test('connection lifecycle publishes ownership acquired before MIDI connect',async()=>{
  const{lifecycle,events,getConnectCalls}=lifecycleHarness({acquired:true});
  await lifecycle.autoConnect();
  assert.equal(getConnectCalls(),1);
  assert.equal(events[0]?.type,'OWNERSHIP_ACQUIRED');
  lifecycle.dispose();
  assert.equal(events.at(-1)?.type,'OWNERSHIP_LOST');
});

test('connection lifecycle publishes ownership blocked and does not connect MIDI',async()=>{
  const{lifecycle,events,getConnectCalls}=lifecycleHarness({acquired:false});
  await lifecycle.autoConnect();
  assert.equal(getConnectCalls(),0);
  assert.equal(events.at(-1)?.type,'OWNERSHIP_BLOCKED');
  lifecycle.dispose();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import{
  DEVICE_RUNTIME_CONNECTION,
  DEVICE_RUNTIME_OWNERSHIP,
  DEVICE_RUNTIME_OPERATION,
  DEVICE_RUNTIME_SAFETY,
  createDeviceRuntimeState
}from '../js/ep133/deviceRuntimeState.js';

const connectedDevice=Object.freeze({
  sku:'TE032AS001',firmware:'2.5.1',deviceKey:'test-device',identityVerified:true
});

const connectOwnedAndHydrated=runtime=>{
  runtime.dispatch({type:'CONNECT_STARTED'});
  runtime.dispatch({type:'DEVICE_CONNECTED',connectionEpoch:1,device:connectedDevice});
  runtime.dispatch({type:'OWNERSHIP_ACQUIRED',connectionEpoch:1});
  runtime.dispatch({type:'RECOVERY_SCAN_COMPLETED',connectionEpoch:1});
};

test('runtime starts disconnected, idle and safe but not recovery-hydrated',()=>{
  const runtime=createDeviceRuntimeState({now:()=>100});
  const snapshot=runtime.getSnapshot();
  assert.equal(snapshot.connection.status,DEVICE_RUNTIME_CONNECTION.DISCONNECTED);
  assert.equal(snapshot.connection.epoch,0);
  assert.equal(snapshot.connection.device,null);
  assert.equal(snapshot.ownership.status,DEVICE_RUNTIME_OWNERSHIP.NONE);
  assert.equal(snapshot.operation.phase,DEVICE_RUNTIME_OPERATION.IDLE);
  assert.equal(snapshot.operation.active,null);
  assert.equal(snapshot.safety.status,DEVICE_RUNTIME_SAFETY.SAFE);
  assert.equal(snapshot.safety.reason,null);
  assert.equal(snapshot.recovery.hydrated,false);
  assert.equal(snapshot.recovery.transaction,null);
  assert.equal(snapshot.externalInterference,null);
  assert.equal(snapshot.status,'disconnected');
});

test('ready requires verified identity, ownership, idle operation, safe state and recovery hydration',()=>{
  const runtime=createDeviceRuntimeState();
  runtime.dispatch({type:'CONNECT_STARTED'});
  runtime.dispatch({type:'DEVICE_CONNECTED',connectionEpoch:1,device:connectedDevice});
  assert.equal(runtime.getSnapshot().status,'blocked');
  runtime.dispatch({type:'OWNERSHIP_ACQUIRED',connectionEpoch:1});
  assert.equal(runtime.getSnapshot().status,'blocked');
  runtime.dispatch({type:'RECOVERY_SCAN_COMPLETED',connectionEpoch:1});
  assert.equal(runtime.getSnapshot().status,'ready');
  assert.doesNotThrow(()=>runtime.assertCanStartFileOperation({mode:'read'}));
  assert.doesNotThrow(()=>runtime.assertCanStartFileOperation({mode:'mutation'}));
});

test('ownership none or blocked prevents ready and FILE admission',()=>{
  const none=createDeviceRuntimeState();
  none.dispatch({type:'CONNECT_STARTED'});
  none.dispatch({type:'DEVICE_CONNECTED',connectionEpoch:1,device:connectedDevice});
  none.dispatch({type:'RECOVERY_SCAN_COMPLETED',connectionEpoch:1});
  assert.equal(none.getSnapshot().status,'blocked');
  assert.throws(()=>none.assertCanStartFileOperation(),error=>error?.code==='EP_DEVICE_RUNTIME_OPERATION_BLOCKED');

  const blocked=createDeviceRuntimeState();
  connectOwnedAndHydrated(blocked);
  blocked.dispatch({type:'OWNERSHIP_BLOCKED',connectionEpoch:1,reason:'other tab'});
  assert.equal(blocked.getSnapshot().status,'blocked');
  assert.throws(()=>blocked.assertCanStartFileOperation(),error=>error?.code==='EP_DEVICE_RUNTIME_OPERATION_BLOCKED');
});

test('snapshots are immutable copies',()=>{
  const runtime=createDeviceRuntimeState();
  const snapshot=runtime.getSnapshot();
  assert.equal(Object.isFrozen(snapshot),true);
  assert.equal(Object.isFrozen(snapshot.connection),true);
  assert.throws(()=>{snapshot.connection.status='connected';},TypeError);
  assert.equal(runtime.getSnapshot().connection.status,'disconnected');
});

test('subscribers receive accepted state changes and can unsubscribe',()=>{
  const runtime=createDeviceRuntimeState();
  const states=[];
  const unsubscribe=runtime.subscribe(snapshot=>states.push(snapshot.status));
  runtime.dispatch({type:'CONNECT_STARTED'});
  unsubscribe();
  runtime.dispatch({type:'DEVICE_CONNECTED',connectionEpoch:1,device:connectedDevice});
  assert.deepEqual(states,['connecting']);
});

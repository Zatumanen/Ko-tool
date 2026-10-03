import test from 'node:test';
import assert from 'node:assert/strict';
import{
  DEVICE_RUNTIME_CONNECTION,
  DEVICE_RUNTIME_OWNERSHIP,
  DEVICE_RUNTIME_OPERATION,
  DEVICE_RUNTIME_SAFETY,
  createDeviceRuntimeState
}from '../js/ep133/deviceRuntimeState.js';

const verifiedDevice=Object.freeze({
  sku:'TE032AS001',firmware:'2.5.1',deviceKey:'test-ep',identityVerified:true
});

const makeReady=runtime=>{
  runtime.dispatch({type:'OWNERSHIP_ACQUIRED'});
  runtime.dispatch({type:'CONNECT_STARTED'});
  runtime.dispatch({type:'DEVICE_CONNECTED',connectionEpoch:0,device:verifiedDevice});
  runtime.dispatch({type:'RECOVERY_SCAN_COMPLETED',connectionEpoch:0});
};

test('device runtime starts disconnected, idle, safe and immutable',()=>{
  const runtime=createDeviceRuntimeState({now:()=>100});
  const snapshot=runtime.getSnapshot();
  assert.equal(snapshot.connection.status,DEVICE_RUNTIME_CONNECTION.DISCONNECTED);
  assert.equal(snapshot.connection.epoch,0);
  assert.equal(snapshot.operation.phase,DEVICE_RUNTIME_OPERATION.IDLE);
  assert.equal(snapshot.safety.status,DEVICE_RUNTIME_SAFETY.SAFE);
  assert.equal(snapshot.ownership.status,DEVICE_RUNTIME_OWNERSHIP.NONE);
  assert.equal(snapshot.recovery.hydrated,false);
  assert.equal(snapshot.status,'disconnected');
  assert.equal(Object.isFrozen(snapshot),true);
  assert.equal(Object.isFrozen(snapshot.connection),true);
  assert.equal(Object.isFrozen(snapshot.operation),true);
  assert.equal(Object.isFrozen(snapshot.safety),true);
  assert.equal(Object.isFrozen(snapshot.recovery),true);
});

test('ready requires verified connection, ownership and completed recovery hydration',()=>{
  const runtime=createDeviceRuntimeState();
  runtime.dispatch({type:'OWNERSHIP_ACQUIRED'});
  assert.equal(runtime.getSnapshot().status,'disconnected');

  runtime.dispatch({type:'CONNECT_STARTED'});
  assert.equal(runtime.getSnapshot().status,'connecting');

  runtime.dispatch({type:'DEVICE_CONNECTED',connectionEpoch:0,device:verifiedDevice});
  assert.equal(runtime.getSnapshot().status,'blocked');
  assert.throws(
    ()=>runtime.assertCanStartFileOperation({mode:'read'}),
    error=>error?.code==='EP_DEVICE_RUNTIME_OPERATION_BLOCKED'
  );

  runtime.dispatch({type:'RECOVERY_SCAN_COMPLETED',connectionEpoch:0});
  assert.equal(runtime.getSnapshot().status,'ready');
  assert.doesNotThrow(()=>runtime.assertCanStartFileOperation({mode:'read'}));
  assert.doesNotThrow(()=>runtime.assertCanStartFileOperation({mode:'mutation'}));
});

test('ownership loss or incomplete recovery hydration blocks FILE admission',()=>{
  const runtime=createDeviceRuntimeState();
  makeReady(runtime);

  runtime.dispatch({type:'OWNERSHIP_LOST'});
  assert.equal(runtime.getSnapshot().status,'blocked');
  assert.throws(
    ()=>runtime.assertCanStartFileOperation({mode:'mutation'}),
    error=>error?.code==='EP_DEVICE_RUNTIME_OPERATION_BLOCKED'
  );

  runtime.dispatch({type:'OWNERSHIP_ACQUIRED'});
  assert.equal(runtime.getSnapshot().status,'ready');
  runtime.dispatch({type:'RECOVERY_SCAN_STARTED',connectionEpoch:0});
  assert.equal(runtime.getSnapshot().status,'blocked');
  assert.throws(
    ()=>runtime.assertCanStartFileOperation({mode:'read'}),
    error=>error?.code==='EP_DEVICE_RUNTIME_OPERATION_BLOCKED'
  );
});

test('disconnect invalidates readiness and recovery hydration',()=>{
  const runtime=createDeviceRuntimeState();
  makeReady(runtime);
  runtime.dispatch({type:'DEVICE_DISCONNECTED',connectionEpoch:1,reason:'usb removed'});
  const snapshot=runtime.getSnapshot();
  assert.equal(snapshot.connection.status,'disconnected');
  assert.equal(snapshot.connection.epoch,1);
  assert.equal(snapshot.connection.device,null);
  assert.equal(snapshot.recovery.hydrated,false);
  assert.equal(snapshot.status,'disconnected');
  assert.throws(
    ()=>runtime.assertCanStartFileOperation({mode:'read'}),
    error=>error?.code==='EP_DEVICE_RUNTIME_OPERATION_BLOCKED'
  );
});

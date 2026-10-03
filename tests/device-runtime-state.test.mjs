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

test('runtime serializes FILE operation lifecycle by epoch and operation id',()=>{
  const runtime=createDeviceRuntimeState({now:()=>1234});
  makeReady(runtime);
  runtime.dispatch({
    type:'FILE_OPERATION_STARTED',connectionEpoch:0,operationId:41,label:'sample read',mode:'read'
  });
  assert.equal(runtime.getSnapshot().status,'reading');
  assert.equal(runtime.getSnapshot().operation.active.id,41);
  assert.equal(runtime.getSnapshot().operation.active.startedAt,1234);
  assert.throws(
    ()=>runtime.dispatch({type:'FILE_OPERATION_STARTED',connectionEpoch:0,operationId:42,label:'overlap',mode:'mutation'}),
    error=>error?.code==='EP_DEVICE_RUNTIME_OPERATION_BLOCKED'
  );
  assert.throws(
    ()=>runtime.dispatch({type:'FILE_OPERATION_FINISHED',connectionEpoch:0,operationId:99}),
    error=>error?.code==='EP_DEVICE_RUNTIME_STALE_OPERATION'
  );
  assert.equal(runtime.getSnapshot().operation.active.id,41);
  runtime.dispatch({type:'FILE_OPERATION_FINISHED',connectionEpoch:0,operationId:41});
  assert.equal(runtime.getSnapshot().status,'ready');
});

test('mutation moves through verifying and returns ready only for the matching lease',()=>{
  const runtime=createDeviceRuntimeState();
  makeReady(runtime);
  runtime.dispatch({
    type:'FILE_OPERATION_STARTED',connectionEpoch:0,operationId:7,label:'project write',mode:'mutation'
  });
  assert.equal(runtime.getSnapshot().status,'mutating');
  runtime.dispatch({type:'FILE_OPERATION_VERIFYING',connectionEpoch:0,operationId:7});
  assert.equal(runtime.getSnapshot().status,'verifying');
  runtime.dispatch({type:'FILE_OPERATION_FINISHED',connectionEpoch:0,operationId:7});
  assert.equal(runtime.getSnapshot().status,'ready');
});

test('stale operation callbacks cannot mutate a reconnected epoch',()=>{
  const runtime=createDeviceRuntimeState();
  makeReady(runtime);
  runtime.dispatch({
    type:'FILE_OPERATION_STARTED',connectionEpoch:0,operationId:3,label:'old read',mode:'read'
  });
  runtime.dispatch({type:'DEVICE_DISCONNECTED',connectionEpoch:1});
  runtime.dispatch({type:'CONNECT_STARTED'});
  runtime.dispatch({type:'DEVICE_CONNECTED',connectionEpoch:1,device:verifiedDevice});
  runtime.dispatch({type:'RECOVERY_SCAN_COMPLETED',connectionEpoch:1});
  const before=runtime.getSnapshot();
  assert.throws(
    ()=>runtime.dispatch({type:'FILE_OPERATION_FINISHED',connectionEpoch:0,operationId:3}),
    error=>error?.code==='EP_DEVICE_RUNTIME_STALE_EPOCH'
  );
  assert.equal(runtime.getSnapshot(),before);
  assert.equal(runtime.getSnapshot().status,'ready');
});

test('FILE failure effect classification is fail-closed',()=>{
  const none=createDeviceRuntimeState();
  makeReady(none);
  none.dispatch({type:'FILE_OPERATION_STARTED',connectionEpoch:0,operationId:1,label:'read',mode:'read'});
  none.dispatch({type:'FILE_OPERATION_FAILED',connectionEpoch:0,operationId:1,effect:'none',reason:'timeout'});
  assert.equal(none.getSnapshot().status,'ready');

  const possible=createDeviceRuntimeState();
  makeReady(possible);
  possible.dispatch({type:'FILE_OPERATION_STARTED',connectionEpoch:0,operationId:2,label:'move',mode:'mutation'});
  possible.dispatch({type:'FILE_OPERATION_FAILED',connectionEpoch:0,operationId:2,effect:'possible',reason:'timeout'});
  assert.equal(possible.getSnapshot().status,'recovery-required');
  assert.equal(possible.getSnapshot().safety.status,'recovery-required');

  const ambiguous=createDeviceRuntimeState();
  makeReady(ambiguous);
  ambiguous.dispatch({type:'FILE_OPERATION_STARTED',connectionEpoch:0,operationId:3,label:'put',mode:'mutation'});
  ambiguous.dispatch({type:'FILE_OPERATION_FAILED',connectionEpoch:0,operationId:3,effect:'session-ambiguous',reason:'stream interrupted'});
  assert.equal(ambiguous.getSnapshot().status,'unsafe');
});

test('unexpected FILE traffic blocks idle runtime and makes active runtime unsafe',()=>{
  const idle=createDeviceRuntimeState();
  makeReady(idle);
  idle.dispatch({type:'UNEXPECTED_FILE_TRAFFIC',connectionEpoch:0,requestId:77,reason:'external response'});
  assert.equal(idle.getSnapshot().status,'blocked');
  assert.equal(idle.getSnapshot().externalInterference.requestId,77);

  const active=createDeviceRuntimeState();
  makeReady(active);
  active.dispatch({type:'FILE_OPERATION_STARTED',connectionEpoch:0,operationId:8,label:'project write',mode:'mutation'});
  active.dispatch({type:'UNEXPECTED_FILE_TRAFFIC',connectionEpoch:0,requestId:78,reason:'external response'});
  assert.equal(active.getSnapshot().status,'unsafe');
});

test('firmware debug makes the runtime terminally unsafe for the current browser runtime',()=>{
  const runtime=createDeviceRuntimeState();
  makeReady(runtime);
  runtime.dispatch({type:'FILE_OPERATION_STARTED',connectionEpoch:0,operationId:10,label:'put',mode:'mutation'});
  runtime.dispatch({type:'FIRMWARE_DEBUG_DETECTED',connectionEpoch:0,reason:'err lfs 6327'});
  assert.equal(runtime.getSnapshot().status,'unsafe');
  runtime.dispatch({type:'FILE_OPERATION_FINISHED',connectionEpoch:0,operationId:10});
  assert.equal(runtime.getSnapshot().status,'unsafe');
  runtime.dispatch({type:'DEVICE_DISCONNECTED',connectionEpoch:1});
  runtime.dispatch({type:'CONNECT_STARTED'});
  runtime.dispatch({type:'DEVICE_CONNECTED',connectionEpoch:1,device:verifiedDevice});
  runtime.dispatch({type:'RECOVERY_SCAN_COMPLETED',connectionEpoch:1});
  assert.equal(runtime.getSnapshot().status,'unsafe');
  assert.throws(
    ()=>runtime.assertCanStartFileOperation({mode:'read'}),
    error=>error?.code==='EP_DEVICE_RUNTIME_OPERATION_BLOCKED'
  );
});

test('recovery blocker clears only after matching authoritative verification and acknowledgment',()=>{
  const runtime=createDeviceRuntimeState();
  makeReady(runtime);
  runtime.dispatch({
    type:'RECOVERY_REQUIRED',connectionEpoch:0,transactionId:'sample:tx-1',source:'sample',reason:'ambiguous move'
  });
  assert.equal(runtime.getSnapshot().status,'recovery-required');
  assert.equal(runtime.getSnapshot().recovery.transaction.id,'sample:tx-1');
  assert.throws(
    ()=>runtime.dispatch({type:'RECOVERY_ACKNOWLEDGED',connectionEpoch:0,transactionId:'sample:tx-1'}),
    error=>error?.code==='EP_DEVICE_RUNTIME_INVALID_TRANSITION'
  );
  assert.throws(
    ()=>runtime.dispatch({type:'RECOVERY_VERIFIED',connectionEpoch:0,transactionId:'sample:other',verification:{classification:'rollback-state-visible'}}),
    error=>error?.code==='EP_DEVICE_RUNTIME_INVALID_TRANSITION'
  );
  runtime.dispatch({
    type:'RECOVERY_VERIFIED',connectionEpoch:0,transactionId:'sample:tx-1',verification:{classification:'rollback-state-visible'}
  });
  assert.equal(runtime.getSnapshot().status,'recovery-required');
  assert.equal(runtime.getSnapshot().recovery.transaction.verified,true);
  runtime.dispatch({type:'RECOVERY_ACKNOWLEDGED',connectionEpoch:0,transactionId:'sample:tx-1'});
  assert.equal(runtime.getSnapshot().status,'ready');
  assert.equal(runtime.getSnapshot().recovery.transaction,null);
});

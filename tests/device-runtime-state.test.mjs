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

const connectOwnedAndHydrated=(runtime,connectionEpoch=1)=>{
  runtime.dispatch({type:'CONNECT_STARTED'});
  runtime.dispatch({type:'DEVICE_CONNECTED',connectionEpoch,device:connectedDevice});
  runtime.dispatch({type:'OWNERSHIP_ACQUIRED',connectionEpoch});
  runtime.dispatch({type:'RECOVERY_SCAN_COMPLETED',connectionEpoch});
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

test('read operation is epoch-bound and returns to ready only for matching completion',()=>{
  const runtime=createDeviceRuntimeState();
  connectOwnedAndHydrated(runtime);
  runtime.dispatch({
    type:'FILE_OPERATION_STARTED',connectionEpoch:1,operationId:10,label:'sample read',mode:'read'
  });
  assert.equal(runtime.getSnapshot().status,'reading');
  assert.equal(runtime.getSnapshot().operation.active.id,10);
  assert.throws(
    ()=>runtime.dispatch({type:'FILE_OPERATION_FINISHED',connectionEpoch:1,operationId:11}),
    error=>error?.code==='EP_DEVICE_RUNTIME_STALE_OPERATION'
  );
  assert.equal(runtime.getSnapshot().status,'reading');
  runtime.dispatch({type:'FILE_OPERATION_FINISHED',connectionEpoch:1,operationId:10});
  assert.equal(runtime.getSnapshot().status,'ready');
  assert.equal(runtime.getSnapshot().operation.active,null);
});

test('mutation transitions through verifying and rejects a second simultaneous operation',()=>{
  const runtime=createDeviceRuntimeState();
  connectOwnedAndHydrated(runtime);
  runtime.dispatch({
    type:'FILE_OPERATION_STARTED',connectionEpoch:1,operationId:20,label:'sample move',mode:'mutation'
  });
  assert.equal(runtime.getSnapshot().status,'mutating');
  assert.throws(
    ()=>runtime.dispatch({type:'FILE_OPERATION_STARTED',connectionEpoch:1,operationId:21,label:'other',mode:'read'}),
    error=>error?.code==='EP_DEVICE_RUNTIME_OPERATION_BLOCKED'
  );
  runtime.dispatch({type:'FILE_OPERATION_VERIFYING',connectionEpoch:1,operationId:20});
  assert.equal(runtime.getSnapshot().status,'verifying');
  runtime.dispatch({type:'FILE_OPERATION_FINISHED',connectionEpoch:1,operationId:20});
  assert.equal(runtime.getSnapshot().status,'ready');
});

test('stale operation event from a prior connection epoch cannot mutate the new session',()=>{
  const runtime=createDeviceRuntimeState();
  connectOwnedAndHydrated(runtime,1);
  runtime.dispatch({
    type:'FILE_OPERATION_STARTED',connectionEpoch:1,operationId:30,label:'read',mode:'read'
  });
  runtime.dispatch({type:'DEVICE_DISCONNECTED',connectionEpoch:1,reason:'cable'});
  connectOwnedAndHydrated(runtime,2);
  assert.equal(runtime.getSnapshot().status,'ready');
  assert.throws(
    ()=>runtime.dispatch({type:'FILE_OPERATION_FINISHED',connectionEpoch:1,operationId:30}),
    error=>error?.code==='EP_DEVICE_RUNTIME_STALE_EPOCH'
  );
  assert.equal(runtime.getSnapshot().connection.epoch,2);
  assert.equal(runtime.getSnapshot().status,'ready');
});

test('operation failure classification is fail-closed',()=>{
  const noEffect=createDeviceRuntimeState();
  connectOwnedAndHydrated(noEffect);
  noEffect.dispatch({type:'FILE_OPERATION_STARTED',connectionEpoch:1,operationId:40,label:'write',mode:'mutation'});
  noEffect.dispatch({type:'FILE_OPERATION_FAILED',connectionEpoch:1,operationId:40,effect:'none',reason:'preflight'});
  assert.equal(noEffect.getSnapshot().status,'ready');

  const possible=createDeviceRuntimeState();
  connectOwnedAndHydrated(possible);
  possible.dispatch({type:'FILE_OPERATION_STARTED',connectionEpoch:1,operationId:41,label:'write',mode:'mutation'});
  possible.dispatch({type:'FILE_OPERATION_FAILED',connectionEpoch:1,operationId:41,effect:'possible',reason:'timeout',transactionId:'sample:41'});
  assert.equal(possible.getSnapshot().status,'recovery-required');
  assert.equal(possible.getSnapshot().recovery.transaction.id,'sample:41');

  const ambiguous=createDeviceRuntimeState();
  connectOwnedAndHydrated(ambiguous);
  ambiguous.dispatch({type:'FILE_OPERATION_STARTED',connectionEpoch:1,operationId:42,label:'stream',mode:'mutation'});
  ambiguous.dispatch({type:'FILE_OPERATION_FAILED',connectionEpoch:1,operationId:42,effect:'session-ambiguous',reason:'stream interrupted'});
  assert.equal(ambiguous.getSnapshot().status,'unsafe');
});

test('firmware debug and external FILE interference preserve existing fail-closed semantics',()=>{
  const idle=createDeviceRuntimeState();
  connectOwnedAndHydrated(idle);
  idle.dispatch({type:'UNEXPECTED_FILE_TRAFFIC',connectionEpoch:1,requestId:77,reason:'other tool'});
  assert.equal(idle.getSnapshot().status,'blocked');
  assert.equal(idle.getSnapshot().externalInterference.requestId,77);

  const active=createDeviceRuntimeState();
  connectOwnedAndHydrated(active);
  active.dispatch({type:'FILE_OPERATION_STARTED',connectionEpoch:1,operationId:50,label:'project write',mode:'mutation'});
  active.dispatch({type:'UNEXPECTED_FILE_TRAFFIC',connectionEpoch:1,requestId:78,reason:'other tool'});
  assert.equal(active.getSnapshot().status,'unsafe');

  const debug=createDeviceRuntimeState();
  connectOwnedAndHydrated(debug);
  debug.dispatch({type:'FILE_OPERATION_STARTED',connectionEpoch:1,operationId:51,label:'upload',mode:'mutation'});
  debug.dispatch({type:'FIRMWARE_DEBUG_DETECTED',connectionEpoch:1,reason:'err lfs 6327'});
  assert.equal(debug.getSnapshot().status,'unsafe');
});

test('unsafe is terminal for the current browser runtime and reconnect does not clear it',()=>{
  const runtime=createDeviceRuntimeState();
  connectOwnedAndHydrated(runtime,1);
  runtime.dispatch({type:'DEVICE_MARKED_UNSAFE',connectionEpoch:1,reason:'unknown FILE session'});
  assert.equal(runtime.getSnapshot().status,'unsafe');
  runtime.dispatch({type:'DEVICE_DISCONNECTED',connectionEpoch:1});
  runtime.dispatch({type:'CONNECT_STARTED'});
  runtime.dispatch({type:'DEVICE_CONNECTED',connectionEpoch:2,device:connectedDevice});
  runtime.dispatch({type:'OWNERSHIP_ACQUIRED',connectionEpoch:2});
  runtime.dispatch({type:'RECOVERY_SCAN_COMPLETED',connectionEpoch:2});
  assert.equal(runtime.getSnapshot().status,'unsafe');
  assert.throws(()=>runtime.assertCanStartFileOperation(),error=>error?.code==='EP_DEVICE_RUNTIME_OPERATION_BLOCKED');
});

test('recovery resolution must match the active recovery transaction',()=>{
  const runtime=createDeviceRuntimeState();
  connectOwnedAndHydrated(runtime);
  runtime.dispatch({
    type:'RECOVERY_REQUIRED',connectionEpoch:1,transactionId:'sample:a',kind:'sample',reason:'ambiguous move'
  });
  assert.equal(runtime.getSnapshot().status,'recovery-required');
  assert.throws(
    ()=>runtime.dispatch({type:'RECOVERY_ACKNOWLEDGED',connectionEpoch:1,transactionId:'sample:b'}),
    error=>error?.code==='EP_DEVICE_RUNTIME_STALE_OPERATION'
  );
  assert.equal(runtime.getSnapshot().status,'recovery-required');
  runtime.dispatch({
    type:'RECOVERY_VERIFIED',connectionEpoch:1,transactionId:'sample:a',verification:{classification:'rollback-state-visible'}
  });
  assert.equal(runtime.getSnapshot().status,'recovery-required');
  runtime.dispatch({type:'RECOVERY_ACKNOWLEDGED',connectionEpoch:1,transactionId:'sample:a'});
  assert.equal(runtime.getSnapshot().status,'ready');
});

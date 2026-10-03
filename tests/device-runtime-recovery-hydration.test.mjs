import test from 'node:test';
import assert from 'node:assert/strict';
import{createDeviceRuntimeState}from '../js/ep133/deviceRuntimeState.js';
import{hashDeviceIdentity}from '../js/ep133/projectRecovery.js';
import{syncDeviceRuntimeRecovery}from '../js/ep133/deviceRecoveryRuntimeBridge.js';

const device={sku:'TE032AS001',metadata:{os_version:'2.5.1',serialNumber:'HYDRATE-DEVICE'}};
const otherDevice={sku:'TE032AS001',metadata:{os_version:'2.5.1',serialNumber:'OTHER-DEVICE'}};
const persistedDevice=value=>({
  identityHash:hashDeviceIdentity(value),sku:value.sku,firmware:value.metadata.os_version
});
const readyRuntime=()=>{
  const runtime=createDeviceRuntimeState();
  runtime.dispatch({type:'OWNERSHIP_ACQUIRED'});
  runtime.dispatch({
    type:'DEVICE_CONNECTED',connectionEpoch:1,
    device:{sku:device.sku,firmware:device.metadata.os_version,deviceKey:'midi-port',identityVerified:true}
  });
  return runtime;
};
const sync=(runtime,{samples=[],projects=[],deviceInfo=device}={})=>syncDeviceRuntimeRecovery({
  runtime,deviceInfo,
  listSampleTransactions:async()=>samples,
  listProjectCheckpoints:async()=>projects
});

test('matching persisted sample recovery keeps a fresh connected runtime blocked',async()=>{
  const runtime=readyRuntime();
  assert.equal(runtime.getSnapshot().status,'blocked');
  await sync(runtime,{samples:[{
    id:'sample-1',status:'requires-recovery',transactionStatus:'requires-recovery',
    operation:'move',createdAt:'2026-10-03T00:00:00.000Z',device:persistedDevice(device),
    recoveryDetail:{reason:'move final state unknown'}
  }]});
  const snapshot=runtime.getSnapshot();
  assert.equal(snapshot.status,'recovery-required');
  assert.equal(snapshot.recovery.hydrated,true);
  assert.equal(snapshot.recovery.transaction.id,'sample-1');
  assert.equal(snapshot.recovery.transaction.source,'sample');
});

test('matching project requires-recovery or rollback-failed checkpoint blocks hydration',async()=>{
  for(const status of ['requires-recovery','rollback-failed']){
    const runtime=readyRuntime();
    await sync(runtime,{projects:[{
      id:'project-'+status,status,transactionStatus:status,createdAt:'2026-10-03T00:00:00.000Z',
      device:persistedDevice(device),project:{number:'01'},error:'project final state unknown'
    }]});
    const snapshot=runtime.getSnapshot();
    assert.equal(snapshot.status,'recovery-required');
    assert.equal(snapshot.recovery.transaction.id,'project-'+status);
    assert.equal(snapshot.recovery.transaction.source,'project');
  }
});

test('records belonging to another physical device do not block current device hydration',async()=>{
  const runtime=readyRuntime();
  await sync(runtime,{
    samples:[{id:'sample-other',status:'requires-recovery',device:persistedDevice(otherDevice)}],
    projects:[{id:'project-other',status:'rollback-failed',device:persistedDevice(otherDevice)}]
  });
  const snapshot=runtime.getSnapshot();
  assert.equal(snapshot.recovery.hydrated,true);
  assert.equal(snapshot.recovery.transaction,null);
  assert.equal(snapshot.status,'ready');
});

test('empty recovery scan completes hydration and permits ready',async()=>{
  const runtime=readyRuntime();
  await sync(runtime);
  assert.equal(runtime.getSnapshot().recovery.hydrated,true);
  assert.equal(runtime.getSnapshot().status,'ready');
});

test('interrupted sample mutation journal is fail-closed even before requires-recovery classification',async()=>{
  const runtime=readyRuntime();
  await sync(runtime,{samples:[{
    id:'sample-running',status:'pending',transactionStatus:'running',operation:'upload',
    createdAt:'2026-10-03T00:00:00.000Z',device:persistedDevice(device),
    journal:[{phase:'PRECHECK',status:'completed'},{phase:'MUTATE',status:'started',detail:{action:'upload'}}]
  }]});
  assert.equal(runtime.getSnapshot().status,'recovery-required');
  assert.equal(runtime.getSnapshot().recovery.transaction.id,'sample-running');
});

test('interrupted project WRITE journal is fail-closed even while checkpoint status is pending',async()=>{
  const runtime=readyRuntime();
  await sync(runtime,{projects:[{
    id:'project-running',status:'pending',transactionStatus:'running',createdAt:'2026-10-03T00:00:00.000Z',
    device:persistedDevice(device),project:{number:'01'},
    journal:[{phase:'CHECKPOINT',status:'completed'},{phase:'WRITE',status:'started'}]
  }]});
  assert.equal(runtime.getSnapshot().status,'recovery-required');
  assert.equal(runtime.getSnapshot().recovery.transaction.id,'project-running');
});

test('precheck-only interrupted records do not falsely claim a device mutation',async()=>{
  const runtime=readyRuntime();
  await sync(runtime,{samples:[{
    id:'sample-precheck',status:'pending',transactionStatus:'running',operation:'delete',
    device:persistedDevice(device),journal:[{phase:'PRECHECK',status:'started'}]
  }],projects:[{
    id:'project-precheck',status:'pending',transactionStatus:'running',device:persistedDevice(device),
    journal:[{phase:'CHECKPOINT',status:'started'}]
  }]});
  assert.equal(runtime.getSnapshot().status,'ready');
});

test('multiple unresolved records choose a deterministic blocker and remain fail-closed',async()=>{
  const runtime=readyRuntime();
  await sync(runtime,{samples:[
    {id:'later',status:'requires-recovery',createdAt:'2026-10-03T02:00:00.000Z',device:persistedDevice(device)},
    {id:'earlier',status:'requires-recovery',createdAt:'2026-10-03T01:00:00.000Z',device:persistedDevice(device)}
  ]});
  assert.equal(runtime.getSnapshot().status,'recovery-required');
  assert.equal(runtime.getSnapshot().recovery.transaction.id,'earlier');
});

test('stale async hydration result cannot mark a new connection epoch ready',async()=>{
  const runtime=readyRuntime();
  let release;
  const pending=new Promise(resolve=>{release=resolve;});
  const hydration=syncDeviceRuntimeRecovery({
    runtime,deviceInfo:device,
    listSampleTransactions:async()=>{await pending;return[];},
    listProjectCheckpoints:async()=>[]
  });
  runtime.dispatch({type:'DEVICE_DISCONNECTED',connectionEpoch:2});
  runtime.dispatch({
    type:'DEVICE_CONNECTED',connectionEpoch:3,
    device:{sku:device.sku,firmware:device.metadata.os_version,deviceKey:'midi-port-2',identityVerified:true}
  });
  release();
  await assert.rejects(hydration,/stale connection epoch/i);
  assert.equal(runtime.getSnapshot().connection.epoch,3);
  assert.equal(runtime.getSnapshot().recovery.hydrated,false);
});

test('hydration never copies raw serial data into runtime recovery state',async()=>{
  const runtime=readyRuntime();
  await sync(runtime,{samples:[{
    id:'sample-private',status:'requires-recovery',device:persistedDevice(device),
    detail:{serialNumber:'DO-NOT-COPY'},recoveryDetail:{reason:'unknown final state'}
  }]});
  assert.equal(JSON.stringify(runtime.getSnapshot()).includes('HYDRATE-DEVICE'),false);
  assert.equal(JSON.stringify(runtime.getSnapshot()).includes('DO-NOT-COPY'),false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import{createDeviceRuntimeState}from '../js/ep133/deviceRuntimeState.js';
import{DEVICE_OPERATION_PHASE,createDeviceOperationCoordinator}from '../js/ep133/deviceOperationCoordinator.js';

const device={sku:'TE032AS001',firmware:'2.5.1',deviceKey:'ep-test',identityVerified:true};
const readyRuntime=()=>{
  const runtime=createDeviceRuntimeState({now:()=>100});
  runtime.dispatch({type:'OWNERSHIP_ACQUIRED'});
  runtime.dispatch({type:'CONNECT_STARTED'});
  runtime.dispatch({type:'DEVICE_CONNECTED',connectionEpoch:0,device});
  runtime.dispatch({type:'RECOVERY_SCAN_COMPLETED',connectionEpoch:0});
  return runtime;
};

test('runtime-backed coordinator delegates lease admission, phase and completion',()=>{
  const runtime=readyRuntime();
  let id=40;
  const coordinator=createDeviceOperationCoordinator({runtime,nextOperationId:()=>++id,now:()=>123});
  const lease=coordinator.begin('sample read',{mode:'read'});
  assert.equal(runtime.getSnapshot().status,'reading');
  assert.equal(runtime.getSnapshot().operation.active.id,41);
  assert.equal(coordinator.getState().state,DEVICE_OPERATION_PHASE.READING);
  assert.equal(coordinator.getState().active.label,'sample read');

  assert.throws(()=>coordinator.begin('overlap'),error=>error?.code==='EP_DEVICE_RUNTIME_OPERATION_BLOCKED');
  lease.setPhase(DEVICE_OPERATION_PHASE.VERIFYING);
  assert.equal(runtime.getSnapshot().status,'verifying');
  assert.equal(coordinator.getState().state,DEVICE_OPERATION_PHASE.VERIFYING);
  lease.close();
  assert.equal(runtime.getSnapshot().status,'ready');
  assert.equal(coordinator.getState().state,DEVICE_OPERATION_PHASE.IDLE);
});

test('runtime-backed coordinator maps unexpected FILE traffic to blocked or unsafe runtime state',()=>{
  const idleRuntime=readyRuntime();
  const idle=createDeviceOperationCoordinator({runtime:idleRuntime,now:()=>123});
  idle.observeUnexpectedFileTraffic({requestId:77,status:0});
  assert.equal(idleRuntime.getSnapshot().status,'blocked');
  assert.equal(idle.getState().state,DEVICE_OPERATION_PHASE.BLOCKED);

  const activeRuntime=readyRuntime();
  let unsafeReason='';
  const active=createDeviceOperationCoordinator({
    runtime:activeRuntime,
    markUnsafe:reason=>{unsafeReason=reason;},
    now:()=>124,
    nextOperationId:()=>9
  });
  const lease=active.begin('project write',{mode:'mutation'});
  active.observeUnexpectedFileTraffic({requestId:401,status:0});
  assert.equal(activeRuntime.getSnapshot().status,'unsafe');
  assert.equal(active.getState().state,DEVICE_OPERATION_PHASE.UNSAFE);
  assert.match(unsafeReason,/project write/);
  lease.close();
  assert.equal(activeRuntime.getSnapshot().status,'unsafe');
});

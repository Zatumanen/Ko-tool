import test from 'node:test';
import assert from 'node:assert/strict';
import{
  DEVICE_OPERATION_PHASE,createDeviceOperationCoordinator
}from '../js/ep133/deviceOperationCoordinator.js';

const deferred=()=>{
  let resolve;
  const promise=new Promise(res=>{resolve=res;});
  return{promise,resolve};
};

test('device operation coordinator exposes read and mutation phases without overlap',async()=>{
  const states=[];
  const coordinator=createDeviceOperationCoordinator({onStateChange:state=>states.push(state.state)});
  const gate=deferred();
  const running=coordinator.run('sample read',async lease=>{
    assert.equal(lease.getState().state,DEVICE_OPERATION_PHASE.READING);
    lease.setPhase(DEVICE_OPERATION_PHASE.VERIFYING);
    assert.equal(lease.getState().state,DEVICE_OPERATION_PHASE.VERIFYING);
    await gate.promise;
    return 42;
  },{mode:'read'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(coordinator.getState().active?.label,'sample read');
  assert.throws(()=>coordinator.begin('overlap'),/already active/);
  gate.resolve();
  assert.equal(await running,42);
  assert.equal(coordinator.getState().state,DEVICE_OPERATION_PHASE.IDLE);

  await coordinator.run('sample write',async lease=>{
    assert.equal(lease.getState().state,DEVICE_OPERATION_PHASE.MUTATING);
  },{mode:'mutation'});
  assert.equal(coordinator.getState().state,DEVICE_OPERATION_PHASE.IDLE);
  assert.ok(states.includes(DEVICE_OPERATION_PHASE.READING));
  assert.ok(states.includes(DEVICE_OPERATION_PHASE.VERIFYING));
  assert.ok(states.includes(DEVICE_OPERATION_PHASE.MUTATING));
});

test('unexpected FILE traffic while idle blocks new operations until coordinator reset',()=>{
  let unsafeCalls=0;
  const coordinator=createDeviceOperationCoordinator({markUnsafe:()=>{unsafeCalls++;},now:()=>1234});
  const state=coordinator.observeUnexpectedFileTraffic({requestId:77,status:0});
  assert.equal(state.state,DEVICE_OPERATION_PHASE.BLOCKED);
  assert.equal(unsafeCalls,0);
  assert.equal(state.externalInterference.requestId,77);
  assert.match(state.externalInterference.reason,/Close other EP tools and reconnect/);
  assert.throws(()=>coordinator.begin('blocked read'),error=>error?.code==='EP_FILE_COORDINATOR_BLOCKED');
  coordinator.reset();
  assert.equal(coordinator.getState().state,DEVICE_OPERATION_PHASE.IDLE);
});

test('unexpected FILE traffic during an active operation marks the device unsafe',async()=>{
  let unsafe=false,unsafeReason='';
  const coordinator=createDeviceOperationCoordinator({
    isUnsafe:()=>unsafe,
    markUnsafe:reason=>{unsafe=true;unsafeReason=reason;}
  });
  const gate=deferred();
  const running=coordinator.run('project write',()=>gate.promise,{mode:'mutation'});
  await new Promise(resolve=>setImmediate(resolve));
  const state=coordinator.observeUnexpectedFileTraffic({requestId:401,status:0});
  assert.equal(unsafe,true);
  assert.equal(state.state,DEVICE_OPERATION_PHASE.UNSAFE);
  assert.match(unsafeReason,/project write/);
  assert.match(unsafeReason,/Another EP tool/);
  gate.resolve();
  await running;
  assert.equal(coordinator.getState().state,DEVICE_OPERATION_PHASE.UNSAFE);
});

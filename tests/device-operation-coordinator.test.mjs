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

const runtimeHarness=()=>{
  let epoch=7;
  let phase='idle';
  let active=null;
  let safety='safe';
  const events=[];
  let admissions=0;
  const runtime={
    getSnapshot(){return{
      connection:{status:'connected',epoch,device:{identityVerified:true}},
      ownership:{status:'owned'},
      operation:{phase,active},
      safety:{status:safety},
      recovery:{hydrated:true,transaction:null},
      externalInterference:null,
      status:safety==='unsafe'?'unsafe':safety==='blocked'?'blocked':phase==='idle'?'ready':phase
    };},
    captureEpoch(){return epoch;},
    assertCanStartFileOperation(){admissions++;if(phase!=='idle'||safety!=='safe')throw new Error('runtime blocked');},
    dispatch(event){
      events.push(event);
      if(event.type==='FILE_OPERATION_STARTED'){
        phase=event.mode==='mutation'?'mutating':'reading';
        active={id:event.operationId,label:event.label,mode:event.mode,phase};
      }else if(event.type==='FILE_OPERATION_VERIFYING'){
        phase='verifying';active={...active,phase};
      }else if(event.type==='FILE_OPERATION_FINISHED'){
        phase='idle';active=null;
      }else if(event.type==='UNEXPECTED_FILE_TRAFFIC'){
        safety=active?'unsafe':'blocked';
      }
      return this.getSnapshot();
    }
  };
  return{runtime,events,get admissions(){return admissions;}};
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

test('runtime-backed coordinator delegates admission and lease lifecycle to authoritative runtime',()=>{
  const harness=runtimeHarness();
  let operationId=40;
  const coordinator=createDeviceOperationCoordinator({
    runtime:harness.runtime,nextOperationId:()=>operationId++
  });
  const lease=coordinator.begin('sample move',{mode:'mutation'});
  assert.equal(harness.admissions,1);
  assert.deepEqual(harness.events[0],{
    type:'FILE_OPERATION_STARTED',connectionEpoch:7,operationId:40,label:'sample move',mode:'mutation'
  });
  assert.equal(coordinator.getState().state,DEVICE_OPERATION_PHASE.MUTATING);
  lease.setPhase(DEVICE_OPERATION_PHASE.VERIFYING);
  assert.equal(harness.events.at(-1).type,'FILE_OPERATION_VERIFYING');
  assert.equal(harness.events.at(-1).operationId,40);
  assert.equal(coordinator.getState().state,DEVICE_OPERATION_PHASE.VERIFYING);
  lease.close();
  assert.equal(harness.events.at(-1).type,'FILE_OPERATION_FINISHED');
  assert.equal(harness.events.at(-1).operationId,40);
  assert.equal(coordinator.getState().state,DEVICE_OPERATION_PHASE.IDLE);
});

test('runtime-backed coordinator never finishes a different active operation from a stale lease',()=>{
  const harness=runtimeHarness();
  const coordinator=createDeviceOperationCoordinator({runtime:harness.runtime,nextOperationId:()=>91});
  const lease=coordinator.begin('read',{mode:'read'});
  harness.runtime.dispatch({type:'FILE_OPERATION_FINISHED',connectionEpoch:7,operationId:91});
  lease.close();
  const finishes=harness.events.filter(event=>event.type==='FILE_OPERATION_FINISHED');
  assert.equal(finishes.length,1);
});

test('runtime-backed unexpected FILE traffic dispatches authoritative interference and preserves unsafe callback',()=>{
  const idleHarness=runtimeHarness();
  let idleUnsafe=0;
  const idle=createDeviceOperationCoordinator({runtime:idleHarness.runtime,markUnsafe:()=>{idleUnsafe++;},now:()=>1234});
  assert.equal(idle.observeUnexpectedFileTraffic({requestId:11,status:0}).state,DEVICE_OPERATION_PHASE.BLOCKED);
  assert.equal(idleHarness.events.at(-1).type,'UNEXPECTED_FILE_TRAFFIC');
  assert.equal(idleUnsafe,0);

  const activeHarness=runtimeHarness();
  let activeUnsafe=0;
  const active=createDeviceOperationCoordinator({runtime:activeHarness.runtime,markUnsafe:()=>{activeUnsafe++;}});
  const lease=active.begin('write',{mode:'mutation'});
  assert.equal(active.observeUnexpectedFileTraffic({requestId:12,status:0}).state,DEVICE_OPERATION_PHASE.UNSAFE);
  assert.equal(activeHarness.events.at(-1).type,'UNEXPECTED_FILE_TRAFFIC');
  assert.equal(activeUnsafe,1);
  lease.close();
});

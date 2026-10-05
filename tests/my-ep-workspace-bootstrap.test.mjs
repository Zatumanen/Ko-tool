import test from 'node:test';
import assert from 'node:assert/strict';
import{createMyEpWorkspaceState}from '../js/ep133/ui/workspaceState.js';

const createStorage=()=>({getItem:()=>null,setItem:()=>{}});

test('workspace bootstrap drives FILE diagnostics from authoritative runtime subscription',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/workspaceBootstrap.js',import.meta.url),'utf8');
  assert.match(source,/getDeviceRuntimeSnapshot/);
  assert.match(source,/onDeviceRuntimeChange/);
  assert.doesNotMatch(source,/getFileOperationCoordinatorState/);
  assert.match(source,/workspace\.setRuntime\(/);
});

test('workspace state projects authoritative runtime connection operation and safety',()=>{
  const workspace=createMyEpWorkspaceState({storageRef:createStorage()});
  assert.equal(typeof workspace.setRuntime,'function');
  workspace.setRuntime({
    status:'mutating',
    connection:{status:'connected',epoch:4,device:{sku:'TE032AS001',firmware:'2.5.1',identityVerified:true}},
    ownership:{status:'owned'},
    operation:{phase:'mutating',active:{id:9,label:'sample delete transaction',mode:'mutation',phase:'mutating',startedAt:123}},
    safety:{status:'safe',reason:null},
    recovery:{hydrated:true,transaction:null},
    externalInterference:null
  });
  let state=workspace.getState();
  assert.equal(state.connection.status,'connected');
  assert.equal(state.connection.unsafe,false);
  assert.deepEqual(state.connection.device,{sku:'TE032AS001',firmware:'2.5.1'});
  assert.equal(state.coordinator.state,'mutating');
  assert.equal(state.coordinator.active.label,'sample delete transaction');

  workspace.setRuntime({
    status:'unsafe',
    connection:{status:'connected',epoch:4,device:{sku:'TE032AS001',firmware:'2.5.1',identityVerified:true}},
    ownership:{status:'owned'},
    operation:{phase:'idle',active:null},
    safety:{status:'unsafe',reason:'firmware debug'},
    recovery:{hydrated:true,transaction:null},
    externalInterference:{requestId:17,reason:'unexpected FILE traffic',at:456}
  });
  state=workspace.getState();
  assert.equal(state.connection.status,'unsafe');
  assert.equal(state.connection.unsafe,true);
  assert.equal(state.coordinator.state,'unsafe');
  assert.equal(state.coordinator.active,null);
  assert.equal(state.coordinator.externalInterference.requestId,17);
});

test('workspace history ignores unlabeled transport plumbing but records semantic operations',()=>{
  const workspace=createMyEpWorkspaceState({storageRef:createStorage()});
  workspace.recordOperation({label:'previous upload',status:'succeeded',at:1});
  workspace.recordOperation({label:'FILE operation',status:'finished',at:2});
  assert.equal(workspace.getState().lastOperation.label,'previous upload');
  workspace.recordOperation({label:'workspace hold',status:'finished',at:3});
  assert.equal(workspace.getState().lastOperation.label,'workspace hold');
});

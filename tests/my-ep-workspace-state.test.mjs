import test from 'node:test';
import assert from 'node:assert/strict';
import{
  createMyEpWorkspaceState,MY_EP_WORKSPACE_STORAGE_KEY
}from '../js/ep133/ui/workspaceState.js';

const createStorage=seed=>{
  const values=new Map(Object.entries(seed||{}));
  return{
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key),
    dump:key=>values.get(key)||null
  };
};

test('workspace restores safe preferences without restoring transient connection or operation state',()=>{
  const storage=createStorage({
    [MY_EP_WORKSPACE_STORAGE_KEY]:JSON.stringify({
      version:1,
      viewMode:'projects',
      lastDevice:{sku:'te032as002',firmware:'2.5.1',serialNumber:'secret'},
      lastOperation:{label:'sample upload transaction',status:'succeeded',at:100},
      connection:{status:'connected'},
      coordinator:{state:'mutating',active:{label:'stale write'}}
    })
  });
  const workspace=createMyEpWorkspaceState({storageRef:storage,now:()=>200});
  const state=workspace.getState();
  assert.equal(state.view.mode,'projects');
  assert.equal(state.connection.status,'disconnected');
  assert.equal(state.coordinator.state,'idle');
  assert.equal(state.coordinator.active,null);
  assert.deepEqual(state.lastDevice,{sku:'TE032AS002',firmware:'2.5.1'});
  assert.equal(state.lastOperation.label,'sample upload transaction');
});

test('workspace persistence never stores raw serials or transient coordinator/recovery state',()=>{
  const storage=createStorage();
  const workspace=createMyEpWorkspaceState({storageRef:storage,now:()=>500});
  workspace.setConnection({
    connected:true,
    unsafe:false,
    device:{sku:'TE032AS002',metadata:{os_version:'2.5.1',serialNumber:'RAW-SERIAL-123'}}
  });
  workspace.setCoordinator({
    state:'mutating',
    active:{id:9,label:'sample delete transaction',mode:'mutation',phase:'mutating',startedAt:400}
  });
  workspace.setRecovery({
    sampleTransactions:[{status:'requires-recovery'}],
    projectCheckpoints:[{status:'requires-recovery'}]
  });
  workspace.recordOperation({
    label:'sample delete transaction',
    status:'requires-recovery',
    error:{code:'EP_FILE_OPERATION_FAILED',category:'transport',recovery:'Reconnect device.',message:'RAW-SERIAL-123'}
  });
  const persisted=storage.dump(MY_EP_WORKSPACE_STORAGE_KEY);
  assert.ok(persisted);
  assert.doesNotMatch(persisted,/RAW-SERIAL-123/);
  assert.doesNotMatch(persisted,/coordinator|mutating|sampleRequired|projectRequired|connection/i);
  const parsed=JSON.parse(persisted);
  assert.deepEqual(parsed.lastDevice,{sku:'TE032AS002',firmware:'2.5.1'});
  assert.deepEqual(parsed.lastOperation.error,{
    code:'EP_FILE_OPERATION_FAILED',category:'transport',recovery:'Reconnect device.'
  });
});

test('workspace reports unsafe connection, runtime settling, and recovery counts independently',()=>{
  const workspace=createMyEpWorkspaceState({storageRef:createStorage()});
  workspace.setConnection({connected:true,unsafe:true,device:{sku:'TE032AS002',metadata:{sw_version:'2.5.1'}}});
  workspace.setProjectRuntime({settling:true,settlingUntil:7000,remainingMs:6000});
  workspace.setRecovery({
    sampleTransactions:[
      {status:'requires-recovery'},
      {status:'rolled-back'},
      {transactionStatus:'requires-recovery'}
    ],
    projectCheckpoints:[{status:'verified'},{status:'requires-recovery'}]
  });
  const state=workspace.getState();
  assert.equal(state.connection.status,'unsafe');
  assert.equal(state.projectRuntime.settling,true);
  assert.deepEqual(state.recovery,{required:true,sampleRequired:2,projectRequired:1});
});

test('workspace publishes state changes and persists the selected My EP view',()=>{
  const storage=createStorage();
  const workspace=createMyEpWorkspaceState({storageRef:storage});
  const modes=[];
  const unsubscribe=workspace.subscribe(state=>modes.push(state.view.mode));
  workspace.setView('projects');
  workspace.setView('invalid');
  unsubscribe();
  workspace.setView('projects');
  assert.deepEqual(modes,['samples','projects','samples']);
  const persisted=JSON.parse(storage.dump(MY_EP_WORKSPACE_STORAGE_KEY));
  assert.equal(persisted.viewMode,'projects');
});

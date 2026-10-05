import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read=relative=>fs.readFile(new URL(relative,import.meta.url),'utf8');

test('My EP workspace bootstraps from the lazy EP dependency graph and reuses authoritative runtime plus adjunct state sources',async()=>{
  const [index,bootstrap,state]=await Promise.all([
    read('../js/ep133/index.js'),
    read('../js/ep133/workspaceBootstrap.js'),
    read('../js/ep133/ui/workspaceState.js')
  ]);
  assert.match(index,/import '\.\/workspaceBootstrap\.js\?v=/);
  assert.match(bootstrap,/from '\.\/deviceRuntime\.js'/);
  assert.match(bootstrap,/getDeviceRuntimeSnapshot/);
  assert.match(bootstrap,/onDeviceRuntimeChange/);
  assert.doesNotMatch(bootstrap,/from '\.\/device\.js\?v=/);
  assert.doesNotMatch(bootstrap,/getFileOperationCoordinatorState/);
  assert.match(bootstrap,/getProjectRuntimeSettleState/);
  assert.match(bootstrap,/listSampleRecoveryTransactions/);
  assert.match(bootstrap,/listProjectRecoveryCheckpoints/);
  assert.match(bootstrap,/workspace\.setRuntime\(/);
  assert.doesNotMatch(bootstrap,/createSampleStore|createProjectFilesystem|createSampleTransactionRuntime/);
  assert.match(state,/viewMode:state\.view\.mode/);
  assert.match(state,/const setRuntime=input=>/);
  assert.doesNotMatch(state,/serialNumber/);
});

test('workspace status uses stable machine state instead of parsing human error messages',async()=>{
  const bootstrap=await read('../js/ep133/workspaceBootstrap.js');
  assert.match(bootstrap,/coordinator\.state==='blocked'/);
  assert.match(bootstrap,/state\.connection\.unsafe/);
  assert.match(bootstrap,/record\?\.status/);
  assert.doesNotMatch(bootstrap,/message\.includes|message\.match|\/permission\|denied\/i/);
});

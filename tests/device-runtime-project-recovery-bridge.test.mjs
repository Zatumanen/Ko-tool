import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('project recovery bridge keeps resolved recovery blocked until a fresh local scan',async()=>{
  const source=await fs.readFile(new URL('../js/ep133/deviceRecoveryRuntimeBridge.js',import.meta.url),'utf8');
  assert.match(source,/export function publishProjectRecoveryEvent/);
  assert.match(source,/source\s*:\s*['"]project['"]/);
  assert.match(source,/type\s*:\s*['"]RECOVERY_REQUIRED['"]/);
  assert.match(source,/type\s*:\s*['"]RECOVERY_SCAN_STARTED['"]/);
  assert.match(source,/type\s*:\s*['"]RECOVERY_VERIFIED['"]/);
  assert.match(source,/type\s*:\s*['"]RECOVERY_ACKNOWLEDGED['"]/);
});

test('filesystem wires project recovery and connection hydration without growing the thin facade',async()=>{
  const facade=await fs.readFile(new URL('../js/ep133/filesystem.js',import.meta.url),'utf8');
  assert.match(facade,/publishProjectRecoveryEvent/);
  assert.match(facade,/syncDeviceRuntimeRecovery/);
  assert.match(facade,/onRecoveryEvent\s*:/);
  assert.match(facade,/onConnectionChange\(\(\{connected,device\}\)/);
  assert.match(facade,/listSampleTransactions/);
  assert.match(facade,/listProjectCheckpoints/);
  assert.ok(facade.split('\n').length<=120);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('filesystem composes the extracted sample recovery bridge into the transaction runtime',async()=>{
  const facade=await fs.readFile(new URL('../js/ep133/filesystem.js',import.meta.url),'utf8');
  assert.match(facade,/from ['"]\.\/deviceRecoveryRuntimeBridge\.js/);
  assert.match(facade,/onRecoveryEvent\s*:\s*publishSampleRecoveryEvent/);
  assert.ok(facade.split('\n').length<=120);
});

test('sample recovery bridge translates callbacks into authoritative runtime events',async()=>{
  const source=await fs.readFile(new URL('../js/ep133/deviceRecoveryRuntimeBridge.js',import.meta.url),'utf8');
  assert.match(source,/from ['"]\.\/deviceRuntime\.js/);
  assert.match(source,/getDeviceRuntimeSnapshot/);
  assert.match(source,/dispatchDeviceRuntimeEvent/);
  assert.match(source,/type\s*:\s*['"]RECOVERY_REQUIRED['"]/);
  assert.match(source,/type\s*:\s*['"]RECOVERY_VERIFIED['"]/);
  assert.match(source,/type\s*:\s*['"]RECOVERY_ACKNOWLEDGED['"]/);
  assert.match(source,/source\s*:\s*['"]sample['"]/);
  assert.match(source,/connectionEpoch/);
});

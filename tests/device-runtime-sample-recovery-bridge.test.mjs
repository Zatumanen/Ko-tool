import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('filesystem bridges sample recovery callbacks into the authoritative device runtime',async()=>{
  const source=await fs.readFile(new URL('../js/ep133/filesystem.js',import.meta.url),'utf8');
  assert.match(source,/from ['"]\.\/deviceRuntime\.js/);
  assert.match(source,/getDeviceRuntimeSnapshot/);
  assert.match(source,/dispatchDeviceRuntimeEvent/);
  assert.match(source,/onRecoveryEvent\s*:\s*publishSampleRecoveryEvent/);
  assert.match(source,/type\s*:\s*['"]RECOVERY_REQUIRED['"]/);
  assert.match(source,/type\s*:\s*['"]RECOVERY_VERIFIED['"]/);
  assert.match(source,/type\s*:\s*['"]RECOVERY_ACKNOWLEDGED['"]/);
  assert.match(source,/source\s*:\s*['"]sample['"]/);
  assert.match(source,/connectionEpoch/);
});

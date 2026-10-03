import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('FILE transport delegates operation admission to the authoritative shared device runtime',async()=>{
  const source=await fs.readFile(new URL('../js/ep133/fileTransport.js',import.meta.url),'utf8');
  assert.match(source,/from ['"]\.\/deviceRuntime\.js/);
  assert.match(source,/createDeviceOperationCoordinator\(\{[^}]*runtime\s*:\s*deviceRuntime/s);
});

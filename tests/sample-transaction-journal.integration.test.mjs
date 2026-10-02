import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('filesystem journals strict sample mutations at the shared FILE transaction boundary',async()=>{
  const source=await fs.readFile(new URL('../js/ep133/filesystem.js',import.meta.url),'utf8');
  assert.match(source,/createBrowserSampleRecoveryStore\(\)/);
  assert.match(source,/createSampleTransactionJournal\(\{\s*recoveryStore:sampleRecoveryStore,getConnectedDeviceInfo\s*\}\)/s);
  assert.match(source,/sampleOperationFromLabel\(label\)/);
  assert.match(source,/createJournaledSampleFileOps\(\{/);
  assert.match(source,/uploadSampleToSlot:args=>sampleUploadForTransport\(args,fileOps\)/);
  assert.match(source,/return withFileTransaction\('sample upload transaction'/);
});

test('sample recovery APIs are exported without exposing the recovery store itself',async()=>{
  const source=await fs.readFile(new URL('../js/ep133/index.js',import.meta.url),'utf8');
  assert.match(source,/getSampleRecoveryTransaction,listSampleRecoveryTransactions,deleteSampleRecoveryTransaction/);
  assert.doesNotMatch(source,/sampleRecoveryStore/);
});

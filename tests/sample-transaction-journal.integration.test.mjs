import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('filesystem journals strict sample mutations through a dedicated runtime while staying a thin facade',async()=>{
  const source=await fs.readFile(new URL('../js/ep133/filesystem.js',import.meta.url),'utf8');
  const runtime=await fs.readFile(new URL('../js/ep133/sampleTransactionRuntime.js',import.meta.url),'utf8');
  assert.ok(source.split('\n').length<=120);
  assert.match(source,/createSampleTransactionRuntime\(\{getConnectedDeviceInfo\}\)/);
  assert.match(source,/sampleTransactionRuntime\.run\(\{label,operation,fileOps:ops\}\)/);
  assert.match(source,/uploadSampleToSlot:args=>sampleUploadForTransport\(args,fileOps\)/);
  assert.match(source,/export function uploadSampleToSlot\(args\)[\s\S]*withFileTransportTransaction\([\s\S]*\{strict:true\}/);
  assert.match(runtime,/createBrowserSampleRecoveryStore\(\)/);
  assert.match(runtime,/createSampleTransactionJournal\(\{recoveryStore,getConnectedDeviceInfo\}\)/);
  assert.match(runtime,/sampleOperationFromLabel\(label\)/);
  assert.match(runtime,/createJournaledSampleFileOps\(\{/);
});

test('sample recovery APIs are exported without exposing the recovery store itself',async()=>{
  const source=await fs.readFile(new URL('../js/ep133/index.js',import.meta.url),'utf8');
  assert.match(source,/getSampleRecoveryTransaction,listSampleRecoveryTransactions,deleteSampleRecoveryTransaction/);
  assert.doesNotMatch(source,/sampleRecoveryStore/);
});

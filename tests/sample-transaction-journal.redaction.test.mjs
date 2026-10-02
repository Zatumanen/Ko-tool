import test from 'node:test';
import assert from 'node:assert/strict';
import{createMemorySampleRecoveryStore}from '../js/ep133/sampleRecovery.js';
import{createSampleTransactionJournal}from '../js/ep133/sampleTransactionJournal.js';

test('sample journal sanitizes nested binary and serial fields from event details',async()=>{
  const store=createMemorySampleRecoveryStore();
  const journal=createSampleTransactionJournal({
    recoveryStore:store,
    getConnectedDeviceInfo:()=>({sku:'TE032AS002',metadata:{serialNumber:'raw-secret'}})
  });
  const tx=await journal.begin({operation:'upload',detail:{nested:{serial:'hidden',data:new Uint8Array([9,8,7])}}});
  await journal.completePhase(tx.id,'PRECHECK',{nested:{serialNumber:'hidden-2',bytes:new Uint8Array([1])}});
  const text=JSON.stringify(await journal.getTransaction(tx.id));
  assert.doesNotMatch(text,/raw-secret|hidden|9,8,7/);
  assert.doesNotMatch(text,/"data"|"bytes"|"serial"|"serialNumber"/);
});

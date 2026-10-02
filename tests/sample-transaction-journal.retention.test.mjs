import test from 'node:test';
import assert from 'node:assert/strict';
import{createSampleRecoveryTransaction,createMemorySampleRecoveryStore}from '../js/ep133/sampleRecovery.js';

test('sample recovery records retain explicit transaction status fields',async()=>{
  const store=createMemorySampleRecoveryStore();
  const tx=createSampleRecoveryTransaction({device:{sku:'TE032AS002'},operation:'move'});
  await store.saveTransaction(tx);
  const saved=await store.updateTransaction(tx.id,{status:'requires-recovery',transactionStatus:'requires-recovery'});
  assert.equal(saved.status,'requires-recovery');
  assert.equal(saved.transactionStatus,'requires-recovery');
});

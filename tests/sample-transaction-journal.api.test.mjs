import test from 'node:test';
import assert from 'node:assert/strict';
import{createMemorySampleRecoveryStore,createSampleRecoveryTransaction}from '../js/ep133/sampleRecovery.js';

test('memory sample recovery store clones records and preserves requires-recovery entries',async()=>{
  const store=createMemorySampleRecoveryStore();
  const tx=createSampleRecoveryTransaction({device:{sku:'TE032AS002'},operation:'delete'});
  await store.saveTransaction(tx);
  const updated=await store.updateTransaction(tx.id,{status:'requires-recovery',recoveryDetail:{affectedSlots:[4]}});
  updated.recoveryDetail.affectedSlots.push(99);
  const reread=await store.getTransaction(tx.id);
  assert.deepEqual(reread.recoveryDetail.affectedSlots,[4]);
  assert.equal((await store.listTransactions()).length,1);
  assert.equal(await store.deleteTransaction(tx.id),true);
  assert.equal(await store.getTransaction(tx.id),null);
});

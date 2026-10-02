import test from 'node:test';
import assert from 'node:assert/strict';
import{createMemorySampleRecoveryStore}from '../js/ep133/sampleRecovery.js';
import{createSampleTransactionJournal}from '../js/ep133/sampleTransactionJournal.js';

test('sample transaction failing before mutation is terminal failed rather than requires-recovery',async()=>{
  const store=createMemorySampleRecoveryStore();
  const journal=createSampleTransactionJournal({
    recoveryStore:store,getConnectedDeviceInfo:()=>({sku:'TE032AS002'})
  });
  const tx=await journal.begin({operation:'copy',label:'sample copy transaction'});
  await journal.failPhase(tx.id,'PRECHECK',new Error('target occupied'));
  const final=await journal.fail(tx.id,new Error('target occupied'));
  assert.equal(final.status,'failed');
  assert.equal(final.recoveryDetail.requiresRecovery,false);
});

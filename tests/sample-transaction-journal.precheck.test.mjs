import test from 'node:test';
import assert from 'node:assert/strict';
import{createMemorySampleRecoveryStore}from '../js/ep133/sampleRecovery.js';
import{createSampleTransactionJournal}from '../js/ep133/sampleTransactionJournal.js';

test('precheck-only sample failure records no recovery requirement',async()=>{
  const store=createMemorySampleRecoveryStore();
  const journal=createSampleTransactionJournal({recoveryStore:store,getConnectedDeviceInfo:()=>({sku:'TE032AS002'})});
  const tx=await journal.begin({operation:'upload'});
  await journal.failPhase(tx.id,'PRECHECK',new Error('slot occupied'));
  const final=await journal.fail(tx.id,new Error('slot occupied'));
  assert.equal(final.status,'failed');
  assert.equal(final.recoveryDetail.requiresRecovery,false);
});

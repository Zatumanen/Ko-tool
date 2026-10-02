import test from 'node:test';
import assert from 'node:assert/strict';
import{createMemorySampleRecoveryStore}from '../js/ep133/sampleRecovery.js';
import{createSampleTransactionJournal,createJournaledSampleFileOps}from '../js/ep133/sampleTransactionJournal.js';

test('copy failure with a created destination left behind is recovery-required',async()=>{
  const store=createMemorySampleRecoveryStore();
  const journal=createSampleTransactionJournal({recoveryStore:store,getConnectedDeviceInfo:()=>({sku:'TE032AS002'})});
  const tx=await journal.begin({operation:'copy'});
  const fileOps=createJournaledSampleFileOps({fileOps:{async uploadSampleToSlot(args){args.onCreated?.(17);return 17;}},journal,transactionId:tx.id});
  await fileOps.uploadSampleToSlot({destinationId:17});
  const final=await journal.fail(tx.id,new Error('later copy failed'));
  assert.equal(final.status,'requires-recovery');
  assert.deepEqual(final.recoveryDetail.affectedSlots,[17]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import{createMemorySampleRecoveryStore}from '../js/ep133/sampleRecovery.js';
import{createSampleTransactionJournal,createJournaledSampleFileOps}from '../js/ep133/sampleTransactionJournal.js';

test('failed native MOVE attempt is recovery-required because device state is ambiguous',async()=>{
  const store=createMemorySampleRecoveryStore();
  const journal=createSampleTransactionJournal({recoveryStore:store,getConnectedDeviceInfo:()=>({sku:'TE032AS002'})});
  const tx=await journal.begin({operation:'move'});
  const fileOps=createJournaledSampleFileOps({fileOps:{async moveFile(){throw new Error('timeout');}},journal,transactionId:tx.id});
  await assert.rejects(()=>fileOps.moveFile(1,1000,2,{verifyCrc:true}),/timeout/);
  const final=await journal.fail(tx.id,new Error('move failed'));
  assert.equal(final.status,'requires-recovery');
  assert.equal(final.recoveryDetail.requiresRecovery,true);
});

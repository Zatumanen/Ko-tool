import test from 'node:test';
import assert from 'node:assert/strict';
import{createMemorySampleRecoveryStore}from '../js/ep133/sampleRecovery.js';
import{createSampleTransactionJournal,createJournaledSampleFileOps}from '../js/ep133/sampleTransactionJournal.js';

test('metadata mutation followed by transaction failure is recovery-required',async()=>{
  const store=createMemorySampleRecoveryStore();
  const journal=createSampleTransactionJournal({recoveryStore:store,getConnectedDeviceInfo:()=>({sku:'TE032AS002'})});
  const tx=await journal.begin({operation:'rename'});
  const fileOps=createJournaledSampleFileOps({fileOps:{async setFileMetadata(){return true;}},journal,transactionId:tx.id});
  await fileOps.setFileMetadata(13,{name:'NEW'});
  const final=await journal.fail(tx.id,new Error('readback failed'));
  assert.equal(final.status,'requires-recovery');
  assert.match(final.recoveryDetail.reason,/authoritative readback/i);
});

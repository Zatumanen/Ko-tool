import test from 'node:test';
import assert from 'node:assert/strict';
import{createMemorySampleRecoveryStore}from '../js/ep133/sampleRecovery.js';
import{createSampleTransactionJournal,createJournaledSampleFileOps}from '../js/ep133/sampleTransactionJournal.js';

test('successful upload journal captures destination without binary payloads',async()=>{
  const store=createMemorySampleRecoveryStore();
  const journal=createSampleTransactionJournal({recoveryStore:store,getConnectedDeviceInfo:()=>({sku:'TE032AS002'})});
  const tx=await journal.begin({operation:'upload'});
  const fileOps=createJournaledSampleFileOps({fileOps:{async uploadSampleToSlot(args){args.onCreated?.(5);return 5;}},journal,transactionId:tx.id});
  await fileOps.uploadSampleToSlot({destinationId:5,data:new Uint8Array([1,2,3])});
  const final=await journal.succeed(tx.id);
  assert.equal(final.status,'succeeded');
  const text=JSON.stringify(final);
  assert.match(text,/"destinationId":5/);
  assert.doesNotMatch(text,/1,2,3/);
});

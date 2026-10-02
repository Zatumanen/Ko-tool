import test from 'node:test';
import assert from 'node:assert/strict';
import{
  createSampleRecoveryTransaction,createMemorySampleRecoveryStore
}from '../js/ep133/sampleRecovery.js';
import{
  assessSampleRecovery,createSampleTransactionJournal,createJournaledSampleFileOps,sampleOperationFromLabel
}from '../js/ep133/sampleTransactionJournal.js';

const device={
  sku:'TE032AS002',
  metadata:{serialNumber:'SECRET-SERIAL-123',os_version:'2.5.1'}
};

const makeJournal=()=>{
  const store=createMemorySampleRecoveryStore();
  const journal=createSampleTransactionJournal({
    recoveryStore:store,getConnectedDeviceInfo:()=>device,
    now:(()=>{let tick=0;return()=>new Date(Date.UTC(2026,9,2,20,0,tick++));})()
  });
  return{store,journal};
};

test('sample recovery transaction stores device hash and sanitized slot context without raw serial or PCM',()=>{
  const checkpoint=createSampleRecoveryTransaction({
    device,operation:'copy',label:'sample copy transaction',
    slots:[{sourceId:1,targetId:2,name:'Kick',size:1234,crc:99}],
    detail:{serialNumber:'DO-NOT-STORE',data:new Uint8Array([1,2,3]),note:'safe'}
  });
  const text=JSON.stringify(checkpoint);
  assert.equal(checkpoint.device.firmware,'2.5.1');
  assert.match(checkpoint.device.identityHash,/^[0-9a-f]{8}$/);
  assert.doesNotMatch(text,/SECRET-SERIAL-123|DO-NOT-STORE|1,2,3/);
  assert.deepEqual(checkpoint.slots,[{sourceId:1,targetId:2,name:'Kick',size:1234,crc:99}]);
});

test('sample operation labels resolve every strict sample mutation family',()=>{
  assert.equal(sampleOperationFromLabel('sample upload batch'),'upload');
  assert.equal(sampleOperationFromLabel('sample copy transaction'),'copy');
  assert.equal(sampleOperationFromLabel('sample move transaction'),'move');
  assert.equal(sampleOperationFromLabel('sample delete transaction'),'delete');
  assert.equal(sampleOperationFromLabel('sample rename transaction'),'rename');
  assert.equal(sampleOperationFromLabel('sample property write'),'property');
  assert.equal(sampleOperationFromLabel('project write transaction'),null);
});

test('journaled copy records created slot cleanup and classifies the failed transaction as rolled-back',async()=>{
  const{journal}=makeJournal();
  const transaction=await journal.begin({operation:'copy',label:'sample copy transaction'});
  let precheck=false;
  const fileOps=createJournaledSampleFileOps({
    fileOps:{
      async uploadSampleToSlot(args){
        args.onCreated?.(22);
        throw new Error('metadata write failed');
      },
      async deleteFile(id){assert.equal(id,22);return true;}
    },
    journal,transactionId:transaction.id,
    ensurePrecheckComplete:async()=>{
      if(precheck)return;
      await journal.completePhase(transaction.id,'PRECHECK');
      precheck=true;
    }
  });

  await assert.rejects(()=>fileOps.uploadSampleToSlot({destinationId:22}),/metadata write failed/);
  await fileOps.deleteFile(22);
  const final=await journal.fail(transaction.id,new Error('copy aborted'));
  assert.equal(final.status,'rolled-back');
  assert.equal(final.recoveryDetail.requiresRecovery,false);
  assert.match(final.recoveryDetail.reason,/removed successfully/i);
});

test('failed delete after device mutation is kept as requires-recovery',async()=>{
  const{journal}=makeJournal();
  const transaction=await journal.begin({operation:'delete',label:'sample delete transaction'});
  const fileOps=createJournaledSampleFileOps({
    fileOps:{async deleteFile(id){assert.equal(id,7);return true;}},
    journal,transactionId:transaction.id
  });
  await fileOps.deleteFile(7);
  const final=await journal.fail(transaction.id,new Error('metadata resync failed'));
  assert.equal(final.status,'requires-recovery');
  assert.equal(final.recoveryDetail.requiresRecovery,true);
  assert.deepEqual(final.recoveryDetail.affectedSlots,[7]);
});

test('native MOVE forward plus verified reverse is recognized as rolled-back',async()=>{
  const{journal}=makeJournal();
  const transaction=await journal.begin({operation:'move',label:'sample move transaction'});
  const fileOps=createJournaledSampleFileOps({
    fileOps:{
      async moveFile(sourceId,parentId,targetId){
        return{oldFileId:sourceId,newFileId:targetId,sourceCrc:100,destinationCrc:100,crcVerified:true};
      }
    },
    journal,transactionId:transaction.id
  });
  await fileOps.moveFile(3,1000,8,{verifyCrc:true});
  await fileOps.moveFile(8,1000,3,{verifyCrc:true});
  const final=await journal.fail(transaction.id,new Error('later batch move failed'));
  assert.equal(final.status,'rolled-back');
  assert.equal(final.recoveryDetail.requiresRecovery,false);
});

test('unmatched native MOVE remains requires-recovery',async()=>{
  const{journal}=makeJournal();
  const transaction=await journal.begin({operation:'move',label:'sample move transaction'});
  const fileOps=createJournaledSampleFileOps({
    fileOps:{
      async moveFile(sourceId,parentId,targetId){
        return{oldFileId:sourceId,newFileId:targetId,sourceCrc:88,destinationCrc:88,crcVerified:true};
      }
    },journal,transactionId:transaction.id
  });
  await fileOps.moveFile(4,1000,9,{verifyCrc:true});
  const current=await journal.getTransaction(transaction.id);
  const assessment=assessSampleRecovery(current);
  assert.equal(assessment.status,'requires-recovery');
  assert.deepEqual(assessment.moves,['4>9']);
});

test('successful metadata mutation records keys only and reaches succeeded terminal state',async()=>{
  const{journal}=makeJournal();
  const transaction=await journal.begin({operation:'property',label:'sample property write'});
  const fileOps=createJournaledSampleFileOps({
    fileOps:{async setFileMetadata(){return true;}},journal,transactionId:transaction.id
  });
  await fileOps.setFileMetadata(11,{'sound.bpm':120,'sound.playmode':'one-shot'});
  const final=await journal.succeed(transaction.id,{confirmed:true});
  assert.equal(final.status,'succeeded');
  const mutation=final.journal.find(event=>event.phase==='MUTATE'&&event.status==='completed');
  assert.deepEqual(mutation.detail.keys,['sound.bpm','sound.playmode']);
  assert.equal('payload'in mutation.detail,false);
});

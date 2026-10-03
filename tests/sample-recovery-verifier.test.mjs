import test from 'node:test';
import assert from 'node:assert/strict';
import{createSampleRecoveryTransaction,createMemorySampleRecoveryStore}from '../js/ep133/sampleRecovery.js';
import{createSampleTransactionRuntime}from '../js/ep133/sampleTransactionRuntime.js';
import{verifySampleRecoveryTransactionState}from '../js/ep133/sampleRecoveryVerifier.js';

const device={sku:'TE032AS001',metadata:{serialNumber:'RECOVERY-DEVICE',os_version:'2.5.1'}};
const fileOpsFor=slots=>({
  async listDirectory(parentId,path){
    if(parentId===0&&path==='/')return[{nodeId:1000,fileName:'/sounds',fileType:'folder'}];
    if(parentId===1000&&path==='/sounds')return Object.entries(slots).filter(([,value])=>value).map(([id,value])=>({
      nodeId:Number(id),fileName:'/sounds/'+String(id).padStart(3,'0'),fileType:'file',fileSize:value.size||10
    }));
    return[];
  },
  async getFileMetadata(id){return slots[id]?.meta||{};}
});

test('sample recovery verification rejects a different physical device',async()=>{
  const transaction=createSampleRecoveryTransaction({device,operation:'delete',slots:[7]});
  await assert.rejects(
    ()=>verifySampleRecoveryTransactionState(transaction,{fileOps:fileOpsFor({7:{}}),device:{...device,metadata:{...device.metadata,serialNumber:'OTHER'}}}),
    /different EP-series device/
  );
});

test('sample recovery verification reports destructive delete state without mutating the device',async()=>{
  const transaction=createSampleRecoveryTransaction({device,operation:'delete',slots:[7,8]});
  const report=await verifySampleRecoveryTransactionState(transaction,{
    fileOps:fileOpsFor({7:null,8:{size:22,meta:{name:'snare',crc:22}}}),device,
    now:()=>new Date('2026-10-03T00:00:00Z')
  });
  assert.equal(report.classification,'partial-delete-state-visible');
  assert.equal(report.deviceMutated,false);
  assert.deepEqual(report.affectedSlots.map(item=>[item.slot,item.present]),[[7,false],[8,true]]);
});

test('sample recovery runtime requires verification and re-verifies before acknowledgment',async()=>{
  const store=createMemorySampleRecoveryStore();
  const transaction=createSampleRecoveryTransaction({device,operation:'delete',slots:[7]});
  await store.saveTransaction(transaction);
  await store.updateTransaction(transaction.id,{
    status:'requires-recovery',transactionStatus:'requires-recovery',
    recoveryDetail:{requiresRecovery:true,reason:'delete uncertain'}
  });
  const runtime=createSampleTransactionRuntime({getConnectedDeviceInfo:()=>device,recoveryStore:store});
  const fileOps=fileOpsFor({7:{size:10,meta:{name:'kick',crc:123}}});
  const verified=await runtime.verifyTransaction(transaction.id,fileOps);
  assert.equal(verified.status,'requires-recovery');
  assert.equal(verified.recoveryDetail.verification.classification,'delete-not-visible');
  assert.equal(verified.recoveryDetail.requiresRecovery,true);
  const acknowledged=await runtime.acknowledgeTransaction(transaction.id,fileOps);
  assert.equal(acknowledged.status,'acknowledged');
  assert.equal(acknowledged.transactionStatus,'acknowledged');
  assert.equal(acknowledged.recoveryDetail.requiresRecovery,false);
  assert.equal(acknowledged.recoveryDetail.verification.deviceMutated,false);
});

test('sample recovery acknowledgment refuses unverifiable records',async()=>{
  const store=createMemorySampleRecoveryStore();
  const transaction=createSampleRecoveryTransaction({device,operation:'move'});
  await store.saveTransaction(transaction);
  await store.updateTransaction(transaction.id,{status:'requires-recovery',transactionStatus:'requires-recovery',recoveryDetail:{requiresRecovery:true}});
  const runtime=createSampleTransactionRuntime({getConnectedDeviceInfo:()=>device,recoveryStore:store});
  await assert.rejects(()=>runtime.acknowledgeTransaction(transaction.id,fileOpsFor({})),/not specific enough/);
  assert.equal((await store.getTransaction(transaction.id)).status,'requires-recovery');
});

test('sample transaction runtime publishes recovery-required after residual mutation failure',async()=>{
  const store=createMemorySampleRecoveryStore();
  const events=[];
  const runtime=createSampleTransactionRuntime({
    getConnectedDeviceInfo:()=>device,
    recoveryStore:store,
    onRecoveryEvent:event=>events.push(event)
  });
  const fileOps={
    async uploadSampleToSlot(args){args.onCreated?.(17);return 17;}
  };
  await assert.rejects(
    ()=>runtime.run({
      label:'sample copy transaction',fileOps,
      operation:async ops=>{await ops.uploadSampleToSlot({destinationId:17});throw new Error('later copy failed');}
    }),
    /later copy failed/
  );
  assert.equal(events.length,1);
  assert.equal(events[0].type,'required');
  assert.equal(events[0].operation,'copy');
  assert.ok(events[0].transactionId);
  assert.match(events[0].reason,/later copy failed/);
});

test('sample recovery runtime publishes verified and acknowledged evidence only after authoritative reads',async()=>{
  const store=createMemorySampleRecoveryStore();
  const transaction=createSampleRecoveryTransaction({device,operation:'delete',slots:[7]});
  await store.saveTransaction(transaction);
  await store.updateTransaction(transaction.id,{
    status:'requires-recovery',transactionStatus:'requires-recovery',
    recoveryDetail:{requiresRecovery:true,reason:'delete uncertain'}
  });
  const events=[];
  const runtime=createSampleTransactionRuntime({
    getConnectedDeviceInfo:()=>device,
    recoveryStore:store,
    onRecoveryEvent:event=>events.push(event)
  });
  const fileOps=fileOpsFor({7:{size:10,meta:{name:'kick',crc:123}}});
  await runtime.verifyTransaction(transaction.id,fileOps);
  assert.equal(events.length,1);
  assert.equal(events[0].type,'verified');
  assert.equal(events[0].transactionId,transaction.id);
  assert.equal(events[0].operation,'delete');
  assert.equal(events[0].verification.deviceMutated,false);

  await runtime.acknowledgeTransaction(transaction.id,fileOps);
  assert.equal(events.length,2);
  assert.equal(events[1].type,'acknowledged');
  assert.equal(events[1].transactionId,transaction.id);
  assert.equal(events[1].operation,'delete');
  assert.equal(events[1].verification.deviceMutated,false);
});

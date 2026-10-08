import test from 'node:test';
import assert from 'node:assert/strict';
import{
  SAMPLE_TRANSACTION_PHASES,SAMPLE_TRANSACTION_OUTCOMES,getSampleTransactionContract,
  assessSampleTransactionRecovery,classifySampleTransactionResidualState,
  isSampleRecoveryVerificationAcknowledgable
}from '../js/ep133/sampleTransactionContract.js';

const event=(status,action,detail={})=>({phase:'MUTATE',status,detail:{action,...detail}});

test('sample transaction contract defines common phases, outcomes, and recovery families',()=>{
  assert.deepEqual(SAMPLE_TRANSACTION_PHASES,['PRECHECK','MUTATE','RECOVERY','FINALIZE']);
  assert.deepEqual(SAMPLE_TRANSACTION_OUTCOMES,['succeeded','failed','rolled-back','requires-recovery','acknowledged']);
  assert.equal(getSampleTransactionContract('upload').recoveryKind,'created-state');
  assert.equal(getSampleTransactionContract('copy').recoveryKind,'created-state');
  assert.equal(getSampleTransactionContract('move').recoveryKind,'move-state');
  assert.equal(getSampleTransactionContract('delete').recoveryKind,'delete-state');
  assert.equal(getSampleTransactionContract('rename').recoveryKind,'metadata-state');
  assert.equal(getSampleTransactionContract('property').recoveryKind,'metadata-state');
});

test('upload and copy use the same residual-state classifier',()=>{
  const journal=[
    event('started','upload',{destinationId:17}),
    event('completed','upload',{destinationId:17,fileId:17})
  ];
  const states=[{slot:17,present:true,crc:10}];
  const upload=classifySampleTransactionResidualState({operation:'upload',journal},states);
  const copy=classifySampleTransactionResidualState({operation:'copy',journal},states);
  assert.equal(upload.recoveryKind,'created-state');
  assert.equal(copy.recoveryKind,'created-state');
  assert.equal(upload.classification,'residual-created-state-visible');
  assert.equal(copy.classification,upload.classification);
  assert.equal(isSampleRecoveryVerificationAcknowledgable(upload),true);
});

test('failed metadata mutation is fail-closed and requires authoritative recovery',()=>{
  const transaction={
    operation:'rename',
    journal:[
      event('started','set-metadata',{slotId:13,keys:['name']}),
      event('failed','set-metadata',{slotId:13,keys:['name']})
    ]
  };
  const assessment=assessSampleTransactionRecovery(transaction);
  assert.equal(assessment.status,'requires-recovery');
  assert.equal(assessment.recoveryKind,'metadata-state');
  assert.equal(assessment.requiresRecovery,true);
  assert.deepEqual(assessment.affectedSlots,[13]);
});

test('recovery acknowledgment eligibility is emitted by the shared residual contract',()=>{
  const unverifiable=classifySampleTransactionResidualState({operation:'move',slots:[{sourceId:1,targetId:2}],journal:[]},[
    {slot:1,present:true,crc:1},{slot:2,present:false,crc:null}
  ]);
  assert.equal(unverifiable.classification,'move-state-unverifiable');
  assert.equal(isSampleRecoveryVerificationAcknowledgable(unverifiable),false);

  const observed=classifySampleTransactionResidualState({operation:'delete',slots:[7],journal:[]},[
    {slot:7,present:false,crc:null}
  ]);
  assert.equal(observed.classification,'destructive-state-visible');
  assert.equal(isSampleRecoveryVerificationAcknowledgable(observed),true);
});

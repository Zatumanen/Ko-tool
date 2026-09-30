import test from 'node:test';
import assert from 'node:assert/strict';
import{
  createProjectRecoveryCheckpoint,createMemoryProjectRecoveryStore
}from '../js/ep133/projectRecovery.js';
import{
  PROJECT_TRANSACTION_PHASES,createProjectTransactionJournal,journalFromCheckpoint
}from '../js/ep133/projectTransactionJournal.js';

const checkpoint=()=>createProjectRecoveryCheckpoint({
  device:{sku:'TE032AS001',metadata:{os_version:'2.5.1',serial:'SECRET'}},
  projectNumber:'01',
  destinationFid:3001,
  parentFid:2000,
  backup:{name:'P01.tar',data:new Uint8Array(1024)},
  candidate:new Uint8Array(1024),
  createdAt:new Date('2026-09-30T17:00:00Z')
});

test('project transaction journal persists ordered phase events and exact success state',async()=>{
  const store=createMemoryProjectRecoveryStore();
  const saved=await store.saveCheckpoint(checkpoint());
  let tick=0;
  const journal=createProjectTransactionJournal({
    recoveryStore:store,
    now:()=>new Date(1_700_000_000_000+(tick++)*1000)
  });

  await journal.completePhase(saved.id,'PRECHECK',{project:'01'});
  await journal.beginPhase(saved.id,'CHECKPOINT');
  await journal.completePhase(saved.id,'CHECKPOINT',{crc:'abc'});
  await journal.beginPhase(saved.id,'WRITE',{bytes:1024});
  await journal.completePhase(saved.id,'WRITE');
  await journal.beginPhase(saved.id,'READBACK');
  await journal.completePhase(saved.id,'READBACK',{bytes:1024});
  await journal.skipPhase(saved.id,'RELOAD',{reason:'disabled'});
  await journal.beginPhase(saved.id,'VERIFY');
  await journal.completePhase(saved.id,'VERIFY',{matchedMembers:0});

  const result=await journal.getJournal(saved.id);
  assert.equal(result.transactionStatus,'succeeded');
  assert.equal(result.currentPhase,'VERIFY');
  assert.equal(result.lastSuccessfulPhase,'VERIFY');
  assert.equal(result.failurePhase,null);
  assert.deepEqual(
    result.events.map(event=>[event.sequence,event.phase,event.status]),
    [
      [1,'PRECHECK','completed'],
      [2,'CHECKPOINT','started'],
      [3,'CHECKPOINT','completed'],
      [4,'WRITE','started'],
      [5,'WRITE','completed'],
      [6,'READBACK','started'],
      [7,'READBACK','completed'],
      [8,'RELOAD','skipped'],
      [9,'VERIFY','started'],
      [10,'VERIFY','completed']
    ]
  );
});

test('project transaction journal preserves original failure phase through rollback',async()=>{
  const store=createMemoryProjectRecoveryStore();
  const saved=await store.saveCheckpoint(checkpoint());
  const journal=createProjectTransactionJournal({recoveryStore:store});

  await journal.beginPhase(saved.id,'READBACK');
  await journal.failPhase(saved.id,'READBACK',new Error('readback mismatch'),{serial:'DO-NOT-STORE'});
  await journal.beginPhase(saved.id,'ROLLBACK',{failedPhase:'READBACK'});
  await journal.completePhase(saved.id,'ROLLBACK');

  const result=await journal.getJournal(saved.id);
  assert.equal(result.failurePhase,'READBACK');
  assert.equal(result.transactionStatus,'rolled-back');
  assert.equal(result.events.at(1).error,'readback mismatch');
  assert.equal(JSON.stringify(result).includes('DO-NOT-STORE'),false);
});

test('project transaction journal records rollback failure without replacing the original failure phase',async()=>{
  const store=createMemoryProjectRecoveryStore();
  const saved=await store.saveCheckpoint(checkpoint());
  const journal=createProjectTransactionJournal({recoveryStore:store});

  await journal.failPhase(saved.id,'RELOAD',new Error('reload failed'));
  await journal.beginPhase(saved.id,'ROLLBACK');
  await journal.failPhase(saved.id,'ROLLBACK',new Error('rollback failed'));

  const result=journalFromCheckpoint(await store.getCheckpoint(saved.id));
  assert.equal(result.failurePhase,'RELOAD');
  assert.equal(result.transactionStatus,'rollback-failed');
  assert.equal(result.events.at(-1).phase,'ROLLBACK');
  assert.equal(result.events.at(-1).error,'rollback failed');
});

test('project transaction journal validates phases and requires an existing checkpoint',async()=>{
  const store=createMemoryProjectRecoveryStore();
  const journal=createProjectTransactionJournal({recoveryStore:store});
  assert.deepEqual(PROJECT_TRANSACTION_PHASES,[
    'PRECHECK','CHECKPOINT','WRITE','READBACK','RELOAD','VERIFY','ROLLBACK'
  ]);
  await assert.rejects(()=>journal.beginPhase('missing','WRITE'),/checkpoint was not found/);
  const saved=await store.saveCheckpoint(checkpoint());
  await assert.rejects(()=>journal.beginPhase(saved.id,'UNKNOWN'),/Unknown project transaction phase/);
});

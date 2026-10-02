import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import{
  EP_ERROR_CATEGORY,EP_ERROR_CODE,EPStructuredError,createEpError,
  isStructuredEpError,toStructuredEpError,serializeEpError,formatEpErrorLog
}from '../js/ep133/errors.js';
import{createDeviceOperationCoordinator}from '../js/ep133/deviceOperationCoordinator.js';
import{createProjectRuntimeGate}from '../js/ep133/projectRuntime.js';
import{createProjectRecoveryCheckpoint,createMemoryProjectRecoveryStore}from '../js/ep133/projectRecovery.js';
import{createProjectTransactionJournal}from '../js/ep133/projectTransactionJournal.js';

test('structured EP errors expose stable machine-readable fields without changing the human message',()=>{
  const cause=new Error('low-level failure');
  const error=createEpError(EP_ERROR_CODE.FILE_OPERATION_FAILED,'Could not write sample.',{
    category:EP_ERROR_CATEGORY.TRANSPORT,
    retryable:true,
    recovery:'Retry after reconnecting.',
    details:{slot:123,serial:'SECRET',rawData:new Uint8Array([1,2,3])},
    cause
  });
  assert.ok(error instanceof EPStructuredError);
  assert.equal(isStructuredEpError(error),true);
  assert.equal(error.message,'Could not write sample.');
  assert.equal(error.code,'EP_FILE_OPERATION_FAILED');
  assert.equal(error.category,'transport');
  assert.equal(error.retryable,true);
  assert.equal(error.recovery,'Retry after reconnecting.');
  assert.equal(error.details.slot,123);
  assert.equal('serial' in error.details,false);
  assert.equal('rawData' in error.details,false);
  assert.equal(error.cause,cause);
});

test('legacy coded errors keep their code when normalized at a structured boundary',()=>{
  const legacy=new Error('EP-series request timeout (command 64)');
  legacy.name='EPSeriesTimeoutError';
  legacy.code='EP_SERIES_TIMEOUT';
  const error=toStructuredEpError(legacy,{
    code:EP_ERROR_CODE.FILE_OPERATION_FAILED,
    category:EP_ERROR_CATEGORY.TRANSPORT,
    retryable:true,
    details:{operation:'sample read'}
  });
  assert.equal(error.code,'EP_SERIES_TIMEOUT');
  assert.equal(error.category,'transport');
  assert.equal(error.retryable,true);
  assert.equal(error.cause,legacy);
});

test('structured error serialization is safe for logs and recovery records',()=>{
  const error=createEpError('EP_TEST_FAILURE','test failure',{
    category:EP_ERROR_CATEGORY.RECOVERY,
    details:{serialNumber:'SECRET',bytes:new Uint8Array([9]),nested:{audio:new ArrayBuffer(2),slot:44}}
  });
  const record=serializeEpError(error);
  const text=JSON.stringify(record);
  assert.equal(record.code,'EP_TEST_FAILURE');
  assert.equal(record.category,'recovery');
  assert.equal(text.includes('SECRET'),false);
  assert.equal(text.includes('"bytes"'),false);
  assert.equal(text.includes('"audio"'),false);
  assert.equal(record.details.nested.slot,44);
  assert.match(formatEpErrorLog(error),/^\[EP_TEST_FAILURE\/recovery\] test failure/);
});

test('FILE coordinator blocked errors use the shared safety contract',()=>{
  const coordinator=createDeviceOperationCoordinator();
  const lease=coordinator.begin('first operation');
  assert.throws(()=>coordinator.begin('second operation'),error=>{
    assert.equal(error.code,EP_ERROR_CODE.FILE_COORDINATOR_BLOCKED);
    assert.equal(error.category,EP_ERROR_CATEGORY.SAFETY);
    assert.equal(error.name,'EPFileCoordinatorError');
    assert.equal(error.retryable,false);
    return true;
  });
  lease.close();
});

test('project runtime settling uses a retryable structured runtime error',()=>{
  let now=1000;
  const gate=createProjectRuntimeGate({settleMs:6000,now:()=>now});
  gate.markReload();
  assert.throws(()=>gate.assertSettled('project write'),error=>{
    assert.equal(error.code,EP_ERROR_CODE.PROJECT_RUNTIME_SETTLING);
    assert.equal(error.category,EP_ERROR_CATEGORY.RUNTIME);
    assert.equal(error.retryable,true);
    assert.equal(error.details.label,'project write');
    assert.equal(error.details.remainingMs,6000);
    return true;
  });
});

test('project recovery journal persists structured error metadata alongside legacy message text',async()=>{
  const store=createMemoryProjectRecoveryStore();
  const checkpoint=createProjectRecoveryCheckpoint({
    device:{sku:'TE032AS001',metadata:{os_version:'2.5.1',serial:'SECRET'}},
    projectNumber:'01',destinationFid:3001,parentFid:2000,
    backup:{name:'P01.tar',data:new Uint8Array(1024)},candidate:new Uint8Array(1024)
  });
  const saved=await store.saveCheckpoint(checkpoint);
  const journal=createProjectTransactionJournal({recoveryStore:store});
  const failure=createEpError('EP_READBACK_MISMATCH','readback mismatch',{
    category:EP_ERROR_CATEGORY.RECOVERY,
    details:{serial:'DO-NOT-STORE',project:'01'}
  });
  await journal.failPhase(saved.id,'READBACK',failure);
  const result=await journal.getJournal(saved.id);
  const event=result.events.at(-1);
  assert.equal(event.error,'readback mismatch');
  assert.equal(event.errorInfo.code,'EP_READBACK_MISMATCH');
  assert.equal(event.errorInfo.category,'recovery');
  assert.equal(event.errorInfo.details.project,'01');
  assert.equal(JSON.stringify(event.errorInfo).includes('DO-NOT-STORE'),false);
});

test('filesystem keeps the thin facade while normalizing strict sample FILE errors',async()=>{
  const source=await fs.readFile(new URL('../js/ep133/filesystem.js',import.meta.url),'utf8');
  assert.ok(source.split('\n').length<=120);
  assert.match(source,/toStructuredEpError/);
  assert.match(source,/EP_ERROR_CODE\.FILE_SAFETY_LOCK/);
  assert.match(source,/EP_ERROR_CODE\.FILE_OPERATION_FAILED/);
  assert.match(source,/catch\(error\)\{throw structuredFileError\(error,label\);\}/);
});

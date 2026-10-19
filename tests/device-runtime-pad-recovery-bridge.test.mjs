import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as bridge from '../js/ep133/deviceRecoveryRuntimeBridge.js';
import {dispatchDeviceRuntimeEvent,getDeviceRuntimeSnapshot} from '../js/ep133/deviceRuntime.js';

test('pad events preserve blockers until verification, acknowledgement and local rescan',()=>{
  dispatchDeviceRuntimeEvent({type:'OWNERSHIP_ACQUIRED'});
  dispatchDeviceRuntimeEvent({type:'DEVICE_CONNECTED',connectionEpoch:1,device:{sku:'TE032AS001',firmware:'2.5.1',deviceKey:'pad-test',identityVerified:true}});
  dispatchDeviceRuntimeEvent({type:'RECOVERY_SCAN_COMPLETED',connectionEpoch:1});
  bridge.publishPadRecoveryEvent({type:'required',transactionId:'pad-1'});
  assert.equal(getDeviceRuntimeSnapshot().recovery.transaction.source,'pad');
  const verification={classification:'desired',deviceMutated:false};
  bridge.publishPadRecoveryEvent({type:'verified',transactionId:'pad-1',verification});
  assert.equal(getDeviceRuntimeSnapshot().status,'recovery-required');
  let rescans=0;bridge.setDeviceRecoveryRescanHandler(()=>{rescans++;});
  bridge.publishPadRecoveryEvent({type:'acknowledged',transactionId:'pad-1',verification});
  assert.equal(getDeviceRuntimeSnapshot().recovery.transaction,null);
  assert.equal(getDeviceRuntimeSnapshot().recovery.hydrated,false);
  assert.equal(rescans,1);bridge.setDeviceRecoveryRescanHandler(null);
});

test('production facade composes pad runtime directly with transport and real availability only',async()=>{
  const source=await fs.readFile(new URL('../js/ep133/filesystem.js',import.meta.url),'utf8');
  const entry=await fs.readFile(new URL('../js/ep133/index.js',import.meta.url),'utf8');
  assert.match(source,/createPadMetadataRuntime\(\{withFileTransaction:withFileTransportTransaction,/);
  assert.match(source,/listPadTransactions:/);
  for(const name of ['getPadMetadataAvailability','listPadMetadataTargets','readPadMetadataTarget','applyPadMetadata',
    'listPadRecoveryRecords','verifyPadRecoveryRecord','restorePadRecoveryRecord','acknowledgePadRecoveryRecord']){
    assert.match(source,new RegExp('export (?:const|function) '+name+'\\b'));
    assert.match(entry,new RegExp('\\b'+name+'\\b'));
  }
});

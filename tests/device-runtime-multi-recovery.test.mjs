import test from 'node:test';
import assert from 'node:assert/strict';
import{dispatchDeviceRuntimeEvent,getDeviceRuntimeSnapshot}from '../js/ep133/deviceRuntime.js';
import{publishSampleRecoveryEvent,setDeviceRecoveryRescanHandler}from '../js/ep133/deviceRecoveryRuntimeBridge.js';

test('sample recovery acknowledgment stays blocked until persisted recovery is rescanned',()=>{
  dispatchDeviceRuntimeEvent({type:'OWNERSHIP_ACQUIRED'});
  dispatchDeviceRuntimeEvent({
    type:'DEVICE_CONNECTED',connectionEpoch:1,
    device:{sku:'TE032AS006',firmware:'2.5.1',deviceKey:'test-device',identityVerified:true}
  });
  dispatchDeviceRuntimeEvent({type:'RECOVERY_SCAN_STARTED',connectionEpoch:1});
  dispatchDeviceRuntimeEvent({
    type:'RECOVERY_REQUIRED',connectionEpoch:1,transactionId:'sample-a',source:'sample',reason:'first blocker'
  });
  dispatchDeviceRuntimeEvent({type:'RECOVERY_SCAN_COMPLETED',connectionEpoch:1});
  assert.equal(getDeviceRuntimeSnapshot().status,'recovery-required');

  let rescans=0;
  setDeviceRecoveryRescanHandler(()=>{rescans+=1;});
  publishSampleRecoveryEvent({
    type:'acknowledged',transactionId:'sample-a',
    verification:{classification:'safe',summary:'verified',deviceMutated:false,verifiedAt:'2026-10-03T12:00:00.000Z'}
  });

  const snapshot=getDeviceRuntimeSnapshot();
  assert.equal(rescans,1);
  assert.equal(snapshot.recovery.hydrated,false);
  assert.equal(snapshot.recovery.transaction,null);
  assert.equal(snapshot.status,'blocked');
  setDeviceRecoveryRescanHandler(null);
});

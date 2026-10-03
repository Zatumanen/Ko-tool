import test from 'node:test';
import assert from 'node:assert/strict';
import{createDeviceRuntimeState}from '../js/ep133/deviceRuntimeState.js';

const connectReady=(runtime,epoch)=>{
  runtime.dispatch({type:'OWNERSHIP_ACQUIRED'});
  runtime.dispatch({
    type:'DEVICE_CONNECTED',connectionEpoch:epoch,
    device:{sku:'TE032AS006',firmware:'2.5.1',deviceKey:'test-device',identityVerified:true}
  });
  runtime.dispatch({type:'RECOVERY_SCAN_STARTED',connectionEpoch:epoch});
  runtime.dispatch({type:'RECOVERY_SCAN_COMPLETED',connectionEpoch:epoch});
};

test('confirmed reconnect clears idle external-traffic block but not terminal unsafe state',()=>{
  const blocked=createDeviceRuntimeState();
  connectReady(blocked,1);
  blocked.dispatch({type:'UNEXPECTED_FILE_TRAFFIC',connectionEpoch:1,requestId:77});
  assert.equal(blocked.getSnapshot().status,'blocked');
  blocked.dispatch({type:'DEVICE_DISCONNECTED',connectionEpoch:2});
  blocked.dispatch({
    type:'DEVICE_CONNECTED',connectionEpoch:3,
    device:{sku:'TE032AS006',firmware:'2.5.1',deviceKey:'test-device',identityVerified:true}
  });
  blocked.dispatch({type:'RECOVERY_SCAN_STARTED',connectionEpoch:3});
  blocked.dispatch({type:'RECOVERY_SCAN_COMPLETED',connectionEpoch:3});
  assert.equal(blocked.getSnapshot().safety.status,'safe');
  assert.equal(blocked.getSnapshot().externalInterference,null);
  assert.equal(blocked.getSnapshot().status,'ready');

  const unsafe=createDeviceRuntimeState();
  connectReady(unsafe,1);
  unsafe.dispatch({type:'FIRMWARE_DEBUG_DETECTED',connectionEpoch:1,reason:'err lfs 6327'});
  unsafe.dispatch({type:'DEVICE_DISCONNECTED',connectionEpoch:2});
  unsafe.dispatch({
    type:'DEVICE_CONNECTED',connectionEpoch:3,
    device:{sku:'TE032AS006',firmware:'2.5.1',deviceKey:'test-device',identityVerified:true}
  });
  unsafe.dispatch({type:'RECOVERY_SCAN_STARTED',connectionEpoch:3});
  unsafe.dispatch({type:'RECOVERY_SCAN_COMPLETED',connectionEpoch:3});
  assert.equal(unsafe.getSnapshot().safety.status,'unsafe');
  assert.equal(unsafe.getSnapshot().status,'unsafe');
});

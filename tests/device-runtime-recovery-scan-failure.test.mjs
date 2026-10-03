import test from 'node:test';
import assert from 'node:assert/strict';
import{createDeviceRuntimeState}from '../js/ep133/deviceRuntimeState.js';
import{syncDeviceRuntimeRecovery}from '../js/ep133/deviceRecoveryRuntimeBridge.js';

const connectRuntime=runtime=>{
  runtime.dispatch({type:'OWNERSHIP_ACQUIRED'});
  runtime.dispatch({
    type:'DEVICE_CONNECTED',
    connectionEpoch:1,
    device:{sku:'TE032AS001',firmware:'2.5.1',deviceKey:'test-device',identityVerified:true}
  });
};

test('failed local recovery scan blocks FILE admission instead of leaving hydration wait pending',async()=>{
  const runtime=createDeviceRuntimeState();
  connectRuntime(runtime);
  const deviceInfo={sku:'TE032AS001',metadata:{os_version:'2.5.1',serial:'LOCAL-ONLY'}};

  await assert.rejects(
    syncDeviceRuntimeRecovery({
      runtime,
      deviceInfo,
      listSampleTransactions:async()=>{throw new Error('recovery store unavailable');},
      listProjectCheckpoints:async()=>[]
    }),
    /recovery store unavailable/
  );

  const snapshot=runtime.getSnapshot();
  assert.equal(snapshot.recovery.hydrated,false);
  assert.equal(snapshot.safety.status,'blocked');
  assert.equal(snapshot.status,'blocked');
  assert.match(snapshot.safety.reason||'',/recovery scan/i);
  assert.throws(
    ()=>runtime.assertCanStartFileOperation({mode:'read'}),
    error=>error?.code==='EP_DEVICE_RUNTIME_OPERATION_BLOCKED'
  );
});

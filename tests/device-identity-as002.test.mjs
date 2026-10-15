import test from 'node:test';
import assert from 'node:assert/strict';
import{createFakeEpMidi}from './helpers/fake-ep-midi.mjs';
import{isDiscoverableEpIdentitySku,isSupportedEpSku}from '../js/ep133/sysex.js';
import{getEpDeviceProfile}from '../js/ep133/deviceProfile.js';
import{getEpProjectProfile}from '../js/ep133/projectProfile.js';
// Reuse a single device runtime instance across the simulated connect/disconnects.
const device=await import('../js/ep133/device.js?as002-identity-tests');
let activeMidiAccess=null;

/** Connect through the production identity -> GREET path, without FILE writes. */
async function withFakeDevice({sku,baseSku=sku,osVersion='2.5.1'},verify){
  const fake=createFakeEpMidi({sku,baseSku,osVersion,identityCode:sku==='TE032AS006'?0x3c:0x33});
  fake.install();
  // Browser MIDIAccess is persistent. USB reconnect changes its live port maps,
  // it does not create a new access object for each physical device.
  if(!activeMidiAccess)activeMidiAccess=fake.access;
  else{
    activeMidiAccess.inputs.clear();
    activeMidiAccess.outputs.clear();
    for(const[id,port]of fake.access.inputs)activeMidiAccess.inputs.set(id,port);
    for(const[id,port]of fake.access.outputs)activeMidiAccess.outputs.set(id,port);
  }
  try{
    return await verify(device,fake);
  }finally{
    device.disconnectEp133();
    fake.restore();
  }
}

test('AS002 is discoverable for GREET but NOT registered as a verified SKU',()=>{
  assert.equal(isDiscoverableEpIdentitySku('TE032AS002'),true);
  assert.equal(isSupportedEpSku('TE032AS002'),false);
  assert.equal(isDiscoverableEpIdentitySku('TE032AS003'),false);
  assert.equal(isSupportedEpSku('TE032AS001'),true);
  assert.equal(isSupportedEpSku('TE032AS006'),true);
});

test('EP-133 identity AS002 with GREET base_sku AS001 connects to the canonical EP-133 profile',async()=>{
  await withFakeDevice({sku:'TE032AS002',baseSku:'TE032AS001'},async(device,fake)=>{
    const connected=await device.connectEp133();
    assert.equal(device.isConnected(),true);
    assert.equal(connected.sku,'TE032AS001');
    assert.equal(connected.identitySku,'TE032AS002');
    assert.equal(connected.baseSku,'TE032AS001');
    assert.equal(device.getConnectedDeviceInfo().identitySku,'TE032AS002');
    assert.equal(device.getConnectedDeviceInfo().sku,'TE032AS001');
    assert.equal(fake.requests.length,1,'GREET must be the first and only non-identity request');
    assert.equal(fake.requests[0].command,1);
    const profile=getEpDeviceProfile(connected.sku,connected.metadata.os_version);
    assert.equal(profile.id,'ep133');
    assert.equal(profile.advancedSampleMetadataWrites,true);
  });
});

test('AS002 with unconfirmed or wrong GREET base_sku remains read-only, not an EP-40 alias',async()=>{
  for(const baseSku of ['TE032AS002','TE032AS006','']){
    await withFakeDevice({sku:'TE032AS002',baseSku},async(device,fake)=>{
      const connected=await device.connectEp133();
      assert.equal(connected.sku,'TE032AS002');
      assert.equal(connected.identitySku,'TE032AS002');
      assert.equal(connected.baseSku,baseSku||null);
      assert.equal(device.isConnected(),true);
      const profile=getEpDeviceProfile(connected.sku,connected.metadata.os_version);
      assert.equal(profile.advancedSampleMetadataWrites,false);
      const projectProfile=getEpProjectProfile(connected.sku,connected.metadata.os_version);
      assert.equal(projectProfile.projectAuthoring,false);
      assert.equal(projectProfile.projectTransport,false);
      // Even when FILE flags advertise writable slots, transport is the
      // final safety gate. No mutating command must reach the hardware.
      const before=fake.requests.length;
      await assert.rejects(
        device.requestFile(5,Uint8Array.from([6,0,7])),
        /FILE writes are disabled/
      );
      await assert.rejects(
        device.requestFile(5,Uint8Array.from([7,1,0,7])),
        /FILE writes are disabled/
      );
      assert.equal(fake.requests.length,before);
    });
  }
});

test('AS002 with unsupported firmware is rejected, even in read-only mode',async()=>{
  await withFakeDevice({sku:'TE032AS002',baseSku:'TE032AS002',osVersion:'1.0.0'},async device=>{
    await assert.rejects(device.connectEp133(),/too old/);
    assert.equal(device.isConnected(),false);
  });
});

test('existing EP-133 AS001 and EP-40 AS006 continue to connect unchanged',async()=>{
  for(const sku of ['TE032AS001','TE032AS006']){
    await withFakeDevice({sku},async device=>{
      const connected=await device.connectEp133();
      assert.equal(connected.sku,sku);
      assert.equal(connected.identitySku,sku);
      assert.equal(device.isConnected(),true);
    });
  }
});

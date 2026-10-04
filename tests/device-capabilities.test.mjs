import test from 'node:test';
import assert from 'node:assert/strict';

import{
  TE_SYSEX_FILE_CAPABILITY_READ,
  TE_SYSEX_FILE_CAPABILITY_WRITE,
  TE_SYSEX_FILE_CAPABILITY_DELETE,
  TE_SYSEX_FILE_CAPABILITY_MOVE,
  TE_SYSEX_FILE_CAPABILITY_PLAYBACK
}from '../js/ep133/constants.js';
import{
  decodeFileRights,resolveDeviceCapabilities
}from '../js/ep133/deviceCapabilities.js';

const ALL_FILE_RIGHTS=
  TE_SYSEX_FILE_CAPABILITY_READ|
  TE_SYSEX_FILE_CAPABILITY_WRITE|
  TE_SYSEX_FILE_CAPABILITY_DELETE|
  TE_SYSEX_FILE_CAPABILITY_MOVE|
  TE_SYSEX_FILE_CAPABILITY_PLAYBACK;

test('decodeFileRights exposes named immutable FILE rights',()=>{
  const rights=decodeFileRights(ALL_FILE_RIGHTS);
  assert.deepEqual(rights,{read:true,write:true,delete:true,move:true,playback:true});
  assert.equal(Object.isFrozen(rights),true);
  assert.deepEqual(
    decodeFileRights(TE_SYSEX_FILE_CAPABILITY_READ|TE_SYSEX_FILE_CAPABILITY_PLAYBACK),
    {read:true,write:false,delete:false,move:false,playback:true}
  );
  assert.deepEqual(decodeFileRights(),{read:false,write:false,delete:false,move:false,playback:false});
});

test('resolveDeviceCapabilities resolves EP-133 2.5.1 evidence from the registry',()=>{
  const capabilities=resolveDeviceCapabilities({
    sku:'te032as001',firmware:'2.5.1',fileCapabilities:ALL_FILE_RIGHTS
  });
  assert.equal(capabilities.sku,'TE032AS001');
  assert.equal(capabilities.firmware,'2.5.1');
  assert.deepEqual(capabilities.fileRights,{read:true,write:true,delete:true,move:true,playback:true});
  assert.equal(capabilities.evidence.sampleMetadata.level,'hardware-verified');
  assert.equal(capabilities.evidence.sampleMetadata.write,true);
  assert.equal(capabilities.evidence.sampleTransfers.level,'hardware-verified');
  assert.equal(capabilities.evidence.projectTransport.level,'hardware-verified');
  assert.equal(capabilities.evidence.projectAuthoring.level,'hardware-verified');
  assert.equal(capabilities.evidence.projectReload.level,'hardware-verified');
});

test('resolveDeviceCapabilities resolves EP-40 2.5.1 evidence without inventing unsupported authoring',()=>{
  const capabilities=resolveDeviceCapabilities({sku:'TE032AS006',firmware:'2.5.1'});
  assert.equal(capabilities.evidence.sampleMetadata.write,true);
  assert.equal(capabilities.evidence.sampleTransfers.write,true);
  assert.equal(capabilities.evidence.sampleBars.write,false);
  assert.equal(capabilities.evidence.projectAuthoring.write,true);
  assert.equal(capabilities.evidence.projectReload.write,true);
  assert.equal(capabilities.evidence.sceneTimeSignature.write,false);
  assert.equal(capabilities.evidence.liveWithPatterns.preserve,true);
  assert.equal(capabilities.evidence.liveWithFx.preserve,true);
});

test('EP-1320 evidence never grants unverified write authority',()=>{
  const capabilities=resolveDeviceCapabilities({
    sku:'TE032AS005',firmware:'1.0.2',fileCapabilities:ALL_FILE_RIGHTS
  });
  assert.equal(capabilities.fileRights.write,true);
  assert.equal(capabilities.evidence.sampleMetadata.write,false);
  assert.equal(capabilities.evidence.sampleTransfers.write,false);
  assert.equal(capabilities.evidence.projectTransport.write,false);
  assert.equal(capabilities.evidence.projectAuthoring.write,false);
  assert.equal(capabilities.evidence.projectReload.write,false);
});

test('unknown SKU remains fail-closed even when FILE rights advertise writes',()=>{
  const capabilities=resolveDeviceCapabilities({
    sku:'TE999UNKNOWN',firmware:'9.9.9',fileCapabilities:ALL_FILE_RIGHTS
  });
  for(const evidence of Object.values(capabilities.evidence)){
    assert.equal(evidence.level,'unverified');
    assert.equal(evidence.write,false);
  }
});

test('missing firmware cannot inherit firmware-scoped write evidence',()=>{
  const capabilities=resolveDeviceCapabilities({sku:'TE032AS001',fileCapabilities:ALL_FILE_RIGHTS});
  assert.equal(capabilities.evidence.sampleMetadata.level,'unverified');
  assert.equal(capabilities.evidence.sampleMetadata.firmwareMatch,false);
  assert.equal(capabilities.evidence.sampleMetadata.write,false);
  assert.equal(capabilities.evidence.projectAuthoring.write,false);
});

test('out-of-range firmware downgrades verified evidence to unverified',()=>{
  const capabilities=resolveDeviceCapabilities({sku:'TE032AS006',firmware:'2.5.2'});
  assert.equal(capabilities.evidence.sampleTransfers.baseLevel,'hardware-verified');
  assert.equal(capabilities.evidence.sampleTransfers.level,'unverified');
  assert.equal(capabilities.evidence.sampleTransfers.firmwareMatch,false);
  assert.equal(capabilities.evidence.sampleTransfers.write,false);
  assert.equal(capabilities.evidence.projectAuthoring.write,false);
});

test('device profiles delegate evidence resolution through the capability facade',async()=>{
  const fs=await import('node:fs/promises');
  const[deviceProfile,deviceCapabilities]=await Promise.all([
    fs.readFile(new URL('../js/ep133/deviceProfile.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../js/ep133/deviceCapabilities.js',import.meta.url),'utf8')
  ]);
  assert.match(deviceProfile,/resolveDeviceCapabilities\s*\(/);
  assert.doesNotMatch(deviceProfile,/resolveRegisteredCapabilityEvidence\s*\(/);
  assert.match(deviceCapabilities,/resolveRegisteredCapabilityEvidence\s*\(/);
  assert.match(deviceCapabilities,/\.\/evidenceRegistry\.js\?v=/);
});

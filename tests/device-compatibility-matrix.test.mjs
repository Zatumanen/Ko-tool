import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import{
  CAPABILITY_KEYS,CAPABILITY_NAMES,DEVICE_COMPATIBILITY_MATRIX,SUPPORTED_EP_SKUS,
  getEpCompatibility,isKnownEpSku,assessEpFirmwareCompatibility,
  validateEpCompatibilityMatrix,GENERIC_EP_PROJECT
}from '../js/ep133/deviceCompatibilityMatrix.js';
import{getEpDeviceProfile}from '../js/ep133/deviceProfile.js';
import{
  getEpProjectProfile,assertProjectAuthoringSupported
}from '../js/ep133/projectProfile.js';
import{resolveDeviceCapabilities}from '../js/ep133/deviceCapabilities.js';
import{isSupportedEpSku}from '../js/ep133/sysex.js';
import{
  EVIDENCE_REGISTRY,validateEvidenceRegistry,listCapabilityEvidence
}from '../js/ep133/evidenceRegistry.js';

const cases=[
  {sku:'TE032AS001',model:'EP-133',id:'ep133',beta:'0.100.38',production:'2.0.5',
    padRecordSize:26,patternDialect:'ep133',uiTitle:'MY EP-133'},
  {sku:'TE032AS005',model:'EP-1320',id:'ep1320',beta:'0.2.13',production:'1.0.2',
    padRecordSize:null,patternDialect:'unverified',uiTitle:'MY EP-1320'},
  {sku:'TE032AS006',model:'EP-40',id:'ep40',beta:'0.4.7',production:'1.0.5',
    padRecordSize:29,patternDialect:'ep40',uiTitle:'MY EP-40'}
];

test('one compatibility matrix enumerates the known EP-series families',()=>{
  assert.equal(validateEpCompatibilityMatrix(),true);
  assert.deepEqual(Object.keys(DEVICE_COMPATIBILITY_MATRIX),cases.map(x=>x.sku));
  assert.deepEqual(SUPPORTED_EP_SKUS,cases.map(x=>x.sku));
  assert.deepEqual(new Set(Object.values(CAPABILITY_NAMES)),new Set(Object.values(CAPABILITY_KEYS)));
  assert.equal(validateEvidenceRegistry(),true);
  assert.equal(EVIDENCE_REGISTRY.length,cases.length*Object.keys(CAPABILITY_KEYS).length);
  for(const spec of cases){
    const entry=getEpCompatibility(spec.sku);
    assert.equal(entry.model,spec.model);
    assert.equal(entry.ui.id,spec.id);
    assert.equal(entry.project.id,spec.id);
    assert.equal(entry.project.padRecordSize,spec.padRecordSize);
    assert.equal(entry.project.patternDialect,spec.patternDialect);
    assert.deepEqual(entry.minimumFirmware,{beta:spec.beta,production:spec.production});
    assert.equal(isKnownEpSku(spec.sku.toLowerCase()),true);
    assert.equal(isSupportedEpSku(spec.sku),true);
    assert.equal(listCapabilityEvidence({sku:spec.sku}).length,Object.keys(CAPABILITY_KEYS).length);
    assert.equal(Object.isFrozen(entry),true);
  }
});

test('the device and project profiles both read the same record, without shared mutable arrays',()=>{
  for(const spec of cases){
    const ui=getEpDeviceProfile(spec.sku,'2.5.1');
    const project=getEpProjectProfile(spec.sku,'2.5.1');
    const record=getEpCompatibility(spec.sku);
    assert.equal(ui.title,spec.uiTitle);
    assert.equal(ui.id,record.ui.id);
    assert.deepEqual(ui.fallbackTabs,record.ui.fallbackTabs);
    assert.deepEqual(ui.playModes,record.ui.playModes);
    assert.equal(project.id,record.project.id);
    assert.equal(project.padRecordSize,record.project.padRecordSize);
    assert.deepEqual(project.settingsSizes,record.project.settingsSizes);
    assert.equal(project.supportsLive,record.project.supportsLive);
    ui.fallbackTabs[0].name='mutated';
    project.settingsSizes.push(9999);
    assert.notEqual(getEpDeviceProfile(spec.sku).fallbackTabs[0].name,'mutated');
    assert.equal(getEpProjectProfile(spec.sku).settingsSizes.includes(9999),false);
  }
});

test('firmware floor is declarative and unknown or old firmware fails closed',()=>{
  for(const spec of cases){
    for(const[channel,version]of [
      ['beta',spec.beta],['production',spec.production]
    ]){
      const accepted=assessEpFirmwareCompatibility(spec.sku,version);
      assert.equal(accepted.supported,true,spec.sku+' '+version);
      assert.equal(accepted.channel,channel);
      assert.equal(accepted.minimum,version);
    }
    for(const version of ['','junk','0.1.0','0.0.1']){
      const rejected=assessEpFirmwareCompatibility(spec.sku,version);
      assert.equal(rejected.supported,false,spec.sku+' '+version);
      assert.match(rejected.reason,/firmware|old/i);
    }
  }
  assert.equal(assessEpFirmwareCompatibility('TE999AS999','2.5.1').supported,false);
  assert.equal(isSupportedEpSku('TE999AS999'),false);
  assert.equal(getEpCompatibility('TE999AS999'),null);
});

test('firmware meeting device minimum does not grant unverified write rights',()=>{
  for(const sku of SUPPORTED_EP_SKUS){
    for(const version of ['','2.5.2','3.0.0']){
      const data=resolveDeviceCapabilities({sku,firmware:version,fileCapabilities:255});
      assert.equal(data.fileRights.write,true);
      for(const evidence of Object.values(data.evidence)){
        assert.equal(evidence.write,false,sku+' '+version);
        assert.ok(evidence.evidenceId||evidence.reason);
      }
      assert.equal(getEpProjectProfile(sku,version).projectAuthoring,false);
    }
  }
  assert.equal(getEpProjectProfile('TE032AS001','2.5.1').projectAuthoring,true);
  assert.equal(getEpProjectProfile('TE032AS006','2.5.1').projectAuthoring,true);
  assert.equal(getEpProjectProfile('TE032AS005','1.0.2').projectAuthoring,false);
  assert.throws(()=>assertProjectAuthoringSupported('TE032AS005','1.0.2'),/not been hardware-verified/);
});

test('unknown SKU yields conservative visible profile and no project authoring',()=>{
  const ui=getEpDeviceProfile('TE999AS999','2.5.1');
  const project=getEpProjectProfile('TE999AS999','2.5.1');
  assert.equal(ui.id,'ep');
  assert.deepEqual(ui.fallbackTabs.map(x=>x.range),[[1,999]]);
  assert.equal(ui.sampleTransfers,false);
  assert.equal(ui.advancedSampleMetadataWrites,false);
  assert.equal(project.id,GENERIC_EP_PROJECT.id);
  assert.equal(project.projectTransport,false);
  assert.equal(project.projectAuthoring,false);
  assert.equal(project.projectReloadVerified,false);
});

test('every capability has a provenance-bearing evidence record and recognized scope',()=>{
  for(const sku of SUPPORTED_EP_SKUS){
    const resolved=resolveDeviceCapabilities({sku,firmware:'2.5.1'});
    const registryRecords=listCapabilityEvidence({sku});
    assert.equal(registryRecords.length,Object.keys(CAPABILITY_NAMES).length);
    for(const[name,key]of Object.entries(CAPABILITY_NAMES)){
      const match=registryRecords.find(record=>record.capability===key);
      const capability=resolved.evidence[name];
      assert.ok(match,sku+' '+key+' evidence missing');
      assert.equal(capability.evidenceId,match.id);
      assert.equal(capability.sourceType,match.sourceType);
      assert.ok(capability.recordedAt);
      if(capability.write){
        assert.equal(capability.level,'hardware-verified');
        assert.ok(capability.firmwareRange);
        assert.equal(capability.sourceType,'hil');
      }
    }
  }
});

test('matrix validation rejects incomplete or corrupt model entries',()=>{
  const missing={
    TE000AS999:{sku:'TE000AS999',ui:{id:'other',fallbackTabs:[]},
      project:{id:'other'},minimumFirmware:{beta:'0.1.0'}}
  };
  assert.throws(()=>validateEpCompatibilityMatrix(missing),/Incomplete/);
  const malformed={
    invalid:{sku:'invalid',ui:{id:'a',fallbackTabs:[]},
      project:{id:'a'},minimumFirmware:{beta:'0.1',production:'1.0'}}
  };
  assert.throws(()=>validateEpCompatibilityMatrix(malformed),/Invalid EP compatibility SKU/);
});

test('connection, protocols and profile facades consume one matrix; no duplicate SKU tables',async()=>{
  const read=async name=>fs.readFile(new URL('../js/ep133/'+name,import.meta.url),'utf8');
  const [device,sysex,deviceProfile,projectProfile,evidenceRegistry]=await Promise.all([
    read('device.js'),read('sysex.js'),read('deviceProfile.js'),
    read('projectProfile.js'),read('evidenceRegistry.js')
  ]);
  assert.match(device,/assessEpFirmwareCompatibility/);
  assert.doesNotMatch(device,/MIN_FIRMWARE\s*=/);
  assert.match(sysex,/isKnownEpSku/);
  assert.match(deviceProfile,/getEpCompatibility/);
  assert.match(projectProfile,/getEpCompatibility/);
  assert.match(evidenceRegistry,/SUPPORTED_EP_SKUS/);
  for(const source of [deviceProfile,projectProfile]){
    assert.doesNotMatch(source,/const PROFILES\s*=/);
    assert.doesNotMatch(source,/resolveRegisteredCapabilityEvidence/);
  }
});

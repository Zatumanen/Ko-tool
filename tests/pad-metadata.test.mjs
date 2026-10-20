import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPadMetadataAvailability,normalizePadMetadata,preparePadMetadataPayload,verifyPadMetadata
} from '../js/ep133/padMetadata.js';
import {getEpDeviceProfile} from '../js/ep133/deviceProfile.js';
import {getEpProjectProfile} from '../js/ep133/projectProfile.js';

// Synthetic pure-contract vectors. These are not pad-operation HIL evidence.
const profile=getEpDeviceProfile('TE032AS001','2.5.1');
const snapshot=()=>({
  sym:'1','sound.playmode':'oneshot','sample.start':12,'sample.end':4200,
  'envelope.attack':5,'envelope.release':90,'sound.pitch':0,
  'sound.amplitude':72,'sound.pan':-3,'sound.mutegroup':2,'time.mode':'off','midi.channel':4
});

test('sample and project permissions do not authorize pad metadata, even at their exact firmware',()=>{
  assert.equal(profile.advancedSampleMetadataWrites,true);
  assert.equal(getEpProjectProfile('TE032AS001','2.5.1').projectAuthoring,true);
  for(const sku of ['TE032AS001','TE032AS005','TE032AS006']){
    for(const firmware of ['2.5.1','2.5.2']){
      const availability=getPadMetadataAvailability({sku,firmware,fileCapabilities:255});
      assert.equal(availability.read,true);
      assert.equal(availability.write,false);
      assert.equal(availability.evidence.level,'unverified');
      assert.match(availability.reason,/pad.*(hardware|verified|evidence)/i);
    }
  }
});

test('unknown SKU and missing, malformed or obsolete firmware refuse pad access',()=>{
  for(const info of [
    {sku:'TE999AS999',firmware:'2.5.1'},
    ...['','junk','0.0.1'].map(firmware=>({sku:'TE032AS001',firmware}))
  ]){
    const result=getPadMetadataAvailability(info);
    assert.equal(result.read,false);
    assert.equal(result.write,false);
    assert.ok(result.reason);
  }
  assert.equal(getPadMetadataAvailability().read,false);
});

test('normalization clones documented values without inventing defaults',()=>{
  const before=snapshot();
  const normalized=normalizePadMetadata(before,{profile});
  assert.deepEqual(normalized,before);
  normalized['envelope.release']=10;
  assert.equal(before['envelope.release'],90);
  assert.deepEqual(normalizePadMetadata({'sound.pitch':2},{profile}),{'sound.pitch':2});
});

test('numeric and unknown enum encodings refuse rather than guessing sample enum maps',()=>{
  for(const field of ['sound.playmode','time.mode']){
    for(const value of [0,1,2,255,'unknown','0',null]){
      assert.throws(()=>normalizePadMetadata({...snapshot(),[field]:value},{profile}),/enum|mode/i);
    }
  }
  assert.throws(()=>normalizePadMetadata({...snapshot(),'sound.playmode':'loop'},
    {profile:getEpDeviceProfile('TE032AS006','2.5.1')}),/mode/i);
});

test('only documented string enums permitted by the profile normalize',()=>{
  for(const mode of ['oneshot','key','legato'])
    assert.equal(normalizePadMetadata({'sound.playmode':mode},{profile})['sound.playmode'],mode);
  for(const mode of ['off','bpm','bar'])
    assert.equal(normalizePadMetadata({'time.mode':mode},{profile})['time.mode'],mode);
  assert.throws(()=>normalizePadMetadata({'sound.playmode':'key'},
    {profile:{playModes:['oneshot']}}),/profile|mode/i);
});

test('pitch-only payload preserves the complete supported snapshot exactly',()=>{
  const before=snapshot();
  const payload=preparePadMetadataPayload(before,{'sound.pitch':-12},{profile});
  assert.deepEqual(payload,{...before,'sound.pitch':-12});
  assert.equal(payload['envelope.release'],before['envelope.release']);
  assert.equal(before['sound.pitch'],0);
  assert.notEqual(payload,before);
});

test('play mode is paired with the existing release or an explicit release companion',()=>{
  const before=snapshot();
  const preserved=preparePadMetadataPayload(before,{'sound.playmode':'key'},{profile});
  assert.equal(preserved['sound.playmode'],'key');
  assert.equal(preserved['envelope.release'],90);
  const paired=preparePadMetadataPayload(before,{'sound.playmode':'key','envelope.release':110},{profile});
  assert.equal(paired['envelope.release'],110);
  assert.throws(()=>preparePadMetadataPayload(before,{'envelope.release':110},{profile}),/companion|playmode/i);
});

test('every missing snapshot field refuses, including the release companion',()=>{
  for(const field of Object.keys(snapshot())){
    const incomplete=snapshot();
    delete incomplete[field];
    assert.throws(()=>preparePadMetadataPayload(incomplete,{'sound.pitch':2},{profile}),/missing|complete/i,field);
  }
});

test('unknown fields and assignment or unrelated edits refuse without partial payloads',()=>{
  for(const field of ['sym','sample.start','sound.pan','midi.channel','unknown'])
    assert.throws(()=>preparePadMetadataPayload(snapshot(),{[field]:3},{profile}),/unsupported|allowed|change/i);
  assert.throws(()=>preparePadMetadataPayload({...snapshot(),unknown:1},{'sound.pitch':2},{profile}),/unknown|unsupported/i);
  assert.throws(()=>normalizePadMetadata(null,{profile}),/metadata/i);
});

test('invalid requested values and incomplete numeric data refuse',()=>{
  for(const value of [NaN,Infinity,-13,13,'2',null])
    assert.throws(()=>preparePadMetadataPayload(snapshot(),{'sound.pitch':value},{profile}),/pitch|number/i);
  assert.throws(()=>preparePadMetadataPayload(snapshot(),{'time.mode':1},{profile}),/mode|enum/i);
  assert.throws(()=>preparePadMetadataPayload(snapshot(),{'sound.playmode':'key','envelope.release':null},{profile}),/release|number/i);
  assert.throws(()=>preparePadMetadataPayload({...snapshot(),'sound.pan':NaN},{'sound.pitch':2},{profile}),/pan|number/i);
});

test('verification confirms edited and preserved fields against authoritative readback',()=>{
  const before=snapshot();
  const payload=preparePadMetadataPayload(before,{'sound.pitch':2},{profile});
  const result=verifyPadMetadata(before,payload,{...payload});
  assert.equal(result.ok,true);
  assert.deepEqual(result.intendedFields,['sound.pitch']);
  assert.ok(result.preservedFields.includes('envelope.release'));
  assert.deepEqual(result.mismatches,[]);
});

test('verification catches ignored edits, missing fields and clobbered overrides',()=>{
  const before=snapshot();
  const payload=preparePadMetadataPayload(before,{'sound.pitch':2},{profile});
  const ignored=verifyPadMetadata(before,payload,before);
  assert.equal(ignored.ok,false);
  assert.ok(ignored.mismatches.some(x=>x.field==='sound.pitch'&&x.kind==='intended'));
  const clobbered=verifyPadMetadata(before,payload,{...payload,'envelope.release':255});
  assert.equal(clobbered.ok,false);
  assert.ok(clobbered.mismatches.some(x=>x.field==='envelope.release'&&x.kind==='preserved'));
  const missing={...payload};
  delete missing.sym;
  assert.equal(verifyPadMetadata(before,payload,missing).ok,false);
  assert.equal(verifyPadMetadata(before,payload,null).ok,false);
});

test('verification refuses a payload that already clobbered protected values',()=>{
  const before=snapshot();
  const payload={...before,'sound.pitch':2,sym:'7'};
  const result=verifyPadMetadata(before,payload,{...payload});
  assert.equal(result.ok,false);
  assert.ok(result.mismatches.some(x=>x.field==='sym'&&x.kind==='payload'));
});

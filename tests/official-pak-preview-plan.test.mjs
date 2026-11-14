import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOfficialPakPreviewPlan} from '../js/ep133/officialPakPreviewPlan.js';

const inventory=()=>({
  format:'ppak',
  metadata:{device_sku:'TE032AS002',base_sku:'TE032AS001',device_version:'2.5.1'},
  projects:[{number:'06',size:2048,padReferences:[
    {slot:7,group:'A',pad:1},{slot:8,group:'A',pad:2},{slot:8,group:'B',pad:1}
  ]}],
  sounds:[{slot:7,name:'kick',pcmBytes:128,sampleFrames:64}],
  warnings:[]
});
const device=()=>({identitySku:'TE032AS002',baseSku:'TE032AS001',metadata:{os_version:'2.5.1'}});

test('valid archive inventory is preview-only, even for matching EP',()=>{
  const plan=buildOfficialPakPreviewPlan(inventory(),{device:device(),getSlot:()=>({state:'empty'})});
  assert.equal(plan.identity,'match');
  assert.equal(plan.restoreAllowed,false);
  assert.equal(plan.kind,'official-pak-read-only-preview');
  assert.deepEqual(plan.projects[0].missingInArchive,[8]);
  assert.equal(plan.summary.missingReferences,1);
  assert.equal(plan.summary.candidateEmpty,1);
  assert.equal(plan.summary.requiredPcmBytes,128);
  assert.equal(plan.projects[0].state,'target-unverified');
  assert.equal(plan.slots[0].state,'ui-empty-unverified');
  assert.deepEqual(Object.keys(plan.slots[0]).sort(),
    ['name','pcmBytes','reason','sampleFrames','slot','state'].sort());
  assert.equal('data' in plan.slots[0],false);
  assert.equal('file' in plan.slots[0],false);
  assert.equal('restorePlan' in plan,false);
  assert.equal('write' in plan,false);
  assert.ok(plan.warnings.some(v=>v.includes('AUTHORITATIVE FILE')));
});

test('occupied UI slots never count as matching or safe to overwrite, even if CRC is equal',()=>{
  const plan=buildOfficialPakPreviewPlan(inventory(),{
    device:device(),getSlot:()=>({state:'ready',file:{fileSize:128},meta:{crc:1234}})
  });
  assert.equal(plan.slots[0].state,'occupied-unverified');
  assert.equal(plan.summary.occupied,1);
  assert.equal(plan.summary.candidateEmpty,0);
  assert.equal(plan.restoreAllowed,false);
});

test('unknown/stale UI slot, missing permissions and available memory fail closed',()=>{
  const plan=buildOfficialPakPreviewPlan(inventory(),{device:device(),getSlot:()=>null});
  assert.equal(plan.slots[0].state,'unknown');
  assert.equal(plan.summary.unknown,1);
  assert.equal(plan.summary.candidateEmpty,0);
  assert.equal(plan.restoreAllowed,false);
  assert.ok(plan.warnings.some(x=>x.includes('FREE SPACE')));
  assert.ok(plan.warnings.some(x=>x.includes('WRITE RIGHTS')));
});

test('unknown firmware cannot claim identity match',()=>{
  const d=device();delete d.metadata.os_version;
  const plan=buildOfficialPakPreviewPlan(inventory(),{device:d,getSlot:()=>({state:'empty'})});
  assert.equal(plan.identity,'unverified');
  assert.equal(plan.restoreAllowed,false);
});

test('mismatched exact SKU/base firmware refuses identity match',()=>{
  for(const change of [
    d=>d.identitySku='TE032AS006',
    d=>d.baseSku='TE032AS006',
    d=>d.metadata.os_version='2.5.2'
  ]){
    const d=device();change(d);
    const plan=buildOfficialPakPreviewPlan(inventory(),{device:d});
    assert.equal(plan.identity,'mismatch');
    assert.equal(plan.restoreAllowed,false);
    assert.ok(plan.warnings.some(x=>x.includes('DOES NOT MATCH')));
  }
});

test('missing archive references are distinguished from confirmed missing on EP',()=>{
  const plan=buildOfficialPakPreviewPlan(inventory(),{device:device()});
  assert.deepEqual(plan.projects[0].references,[7,8]);
  assert.deepEqual(plan.projects[0].missingInArchive,[8]);
  assert.equal(plan.projects[0].reason.includes('unverified'),true);
});

test('throws for invalid input instead of treating malformed archive as empty plan',()=>{
  for(const value of [null,{}, {projects:null,sounds:[]}]){
    assert.throws(()=>buildOfficialPakPreviewPlan(value),/validated archive inventory/);
  }
});

test('preview data and children cannot be mutated into an executable restore plan',()=>{
  const plan=buildOfficialPakPreviewPlan(inventory(),{device:device()});
  assert.equal(Object.isFrozen(plan),true);
  assert.equal(Object.isFrozen(plan.slots),true);
  assert.equal(Object.isFrozen(plan.slots[0]),true);
  assert.equal(Object.isFrozen(plan.projects[0].missingInArchive),true);
  assert.throws(()=>{plan.restoreAllowed=true;},TypeError);
});

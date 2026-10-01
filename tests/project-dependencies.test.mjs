import test from 'node:test';
import assert from 'node:assert/strict';
import{
  buildProjectDependencyReport,assertProjectDependenciesAvailable
}from '../js/ep133/projectDependencies.js';

test('project dependency report keeps device preflight authoritative and enriches from SampleStore',()=>{
  const slots=new Map([
    [7,{file:{name:'kick808.wav',size:128},meta:{name:'kick808',channels:1,samplerate:46875},verification:{file:'verified',metadata:'verified'}}],
    [8,{file:{name:'snare.wav',size:96},meta:{name:'snare',channels:1,samplerate:46875},verification:{file:'verified',metadata:'verified'}}],
    [9,{file:{name:'stale-local.wav',size:64},meta:{name:'stale-local'},verification:{file:'cached',metadata:'cached'}}]
  ]);
  const report=buildProjectDependencyReport({
    referencedSampleSlots:[9,7,8,7],
    missingSampleSlots:[9],
    allSamplesAvailable:false
  },{getSampleSlot:id=>slots.get(id)||null});

  assert.equal(report.referenced,3);
  assert.equal(report.available,2);
  assert.equal(report.missing,1);
  assert.equal(report.allAvailable,false);
  assert.deepEqual(report.referencedSlots,[7,8,9]);
  assert.deepEqual(report.missingSlots,[9]);
  assert.equal(report.entries[0].name,'kick808');
  assert.equal(report.entries[1].name,'snare');
  assert.equal(report.entries[2].name,'stale-local');
  assert.equal(report.entries[2].status,'missing');
  assert.equal(report.entries[2].available,false);
});

test('project dependency assertion fails closed when any referenced slot is missing',()=>{
  const complete=buildProjectDependencyReport({
    referencedSampleSlots:[7,8],missingSampleSlots:[],allSamplesAvailable:true
  });
  assert.equal(assertProjectDependenciesAvailable(complete),complete);

  const incomplete=buildProjectDependencyReport({
    referencedSampleSlots:[7,8,9],missingSampleSlots:[9],allSamplesAvailable:false
  });
  assert.throws(
    ()=>assertProjectDependenciesAvailable(incomplete),
    /missing sample slots: 009/i
  );
});

test('project dependency report tolerates no sample references',()=>{
  const report=buildProjectDependencyReport({
    referencedSampleSlots:[],missingSampleSlots:[],allSamplesAvailable:true
  });
  assert.equal(report.referenced,0);
  assert.equal(report.available,0);
  assert.equal(report.missing,0);
  assert.equal(report.allAvailable,true);
  assert.deepEqual(report.entries,[]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import{
  buildSampleDependencyIndex,getSampleDependencyBlockers,assertSampleSlotsUnreferenced
}from '../js/ep133/projectDependencies.js';

const model=pads=>({pads:{a:[],b:[],c:[],d:[],...pads}});

test('reverse sample dependency index maps slots to exact projects groups and pads',()=>{
  const index=buildSampleDependencyIndex([
    {
      project:'1',nodeId:201,active:true,
      model:model({
        a:[{sampleSlot:7,pad:1,path:'pads/a/p01'},{sampleSlot:8,pad:2,path:'pads/a/p02'}],
        b:[{sampleSlot:7,pad:4,path:'pads/b/p04'}]
      })
    },
    {
      project:'12',nodeId:212,active:false,
      model:model({c:[{sampleSlot:7,pad:3,path:'pads/c/p03'}],d:[{sampleSlot:null,pad:1,path:'pads/d/p01'}]})
    }
  ]);

  assert.equal(index.projectsScanned,2);
  assert.equal(index.sampleCount,2);
  assert.equal(index.referenceCount,4);
  assert.deepEqual(index.slots,[7,8]);
  const slot7=index.entries.find(entry=>entry.slot===7);
  assert.equal(slot7.referenceCount,3);
  assert.equal(slot7.projectCount,2);
  assert.deepEqual(slot7.projects,['01','12']);
  assert.deepEqual(
    slot7.references.map(ref=>[ref.project,ref.group,ref.pad,ref.path]),
    [['01','a',1,'pads/a/p01'],['01','b',4,'pads/b/p04'],['12','c',3,'pads/c/p03']]
  );
});

test('dependency blocker lookup filters requested slots and mutation assertion fails closed',()=>{
  const index=buildSampleDependencyIndex([
    {project:'03',nodeId:203,model:model({a:[{sampleSlot:7,pad:1,path:'pads/a/p01'}]})},
    {project:'12',nodeId:212,model:model({c:[{sampleSlot:7,pad:4,path:'pads/c/p04'}],d:[{sampleSlot:9,pad:2,path:'pads/d/p02'}]})}
  ]);
  assert.deepEqual(getSampleDependencyBlockers(index,[8]),[]);
  assert.equal(getSampleDependencyBlockers(index,[7,8]).length,1);
  assert.equal(assertSampleSlotsUnreferenced(index,[8],{operation:'delete'}),index);
  assert.throws(
    ()=>assertSampleSlotsUnreferenced(index,[7,9],{operation:'move'}),
    /slot 007 is used by P03 A01, P12 C04; slot 009 is used by P12 D02\. MOVE would break project pad references/i
  );
});

test('sample delete and move transactions pass the complete source slot set into the filesystem dependency preflight',async()=>{
  const fs=await import('node:fs/promises');
  const [filesystem,del,move]=await Promise.all([
    fs.readFile(new URL('../js/ep133/filesystem.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../js/ep133/ui/sampleDeleteController.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../js/ep133/ui/sampleMoveController.js',import.meta.url),'utf8')
  ]);
  assert.match(filesystem,/buildDeviceSampleDependencyIndex/);
  assert.match(filesystem,/assertSampleSlotsUnreferenced\(dependencyIndex,dependencySlots/);
  assert.ok(filesystem.indexOf('buildDeviceSampleDependencyIndex(fileOps)')<filesystem.indexOf('return operation(Object.freeze'));
  assert.match(del,/sampleDependencySlots:slots/);
  assert.match(del,/canonicalTargets\.map\(slot=>slot\.id\)/);
  assert.match(move,/sampleDependencySlots:slots/);
  assert.match(move,/plan\.map\(pair=>pair\.sourceId\)/);
});

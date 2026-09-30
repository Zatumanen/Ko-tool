import test from 'node:test';
import assert from 'node:assert/strict';
import{createSampleStore,prioritizeSampleSlots}from '../js/ep133/sampleStore.js';

const file=(id,name='sample',size=id*10)=>({
  nodeId:id,
  fileName:'/sounds/'+name,
  fileSize:size,
  fileType:'file',
  isReadable:true,isWritable:true,isDeletable:true,isMovable:true,isPlayable:true
});

test('SampleStore owns inventory metadata verification and operation state',()=>{
  const store=createSampleStore();
  store.replaceFiles([
    {nodeId:1000,fileName:'/sounds',fileType:'folder'},
    file(7,'kick',100)
  ]);
  store.setMetadata(7,{name:'kick',crc:123});
  store.setVerification(7,{metadata:'verified'});
  store.setOperation(7,{status:'uploading',label:'UPLOADING',progress:50});

  const slot=store.getSlot(7);
  assert.equal(slot.file.name,'kick');
  assert.equal(slot.meta.crc,123);
  assert.equal(slot.verification.file,'verified');
  assert.equal(slot.verification.metadata,'verified');
  assert.deepEqual(slot.operation,{status:'uploading',label:'UPLOADING',progress:50});
  assert.equal(store.countOccupied(),1);
  assert.equal(store.findNextFree(7),8);
});

test('SampleStore preserves metadata only while the exact file fingerprint stays stable',()=>{
  const store=createSampleStore();
  store.replaceFiles([file(7,'kick',100)]);
  store.setMetadata(7,{name:'cached',crc:111});

  store.replaceFiles([file(7,'kick',100)]);
  assert.equal(store.getSlot(7).meta.name,'cached');

  store.replaceFiles([file(7,'kick',101)]);
  assert.equal(store.getSlot(7).meta,null);

  store.setMetadata(7,{name:'again'});
  store.replaceFiles([file(7,'kick2',101)]);
  assert.equal(store.getSlot(7).meta,null);
});

test('SampleStore projects canonical mutations into sampleMemory without making memory authoritative',()=>{
  const calls=[];
  const memory={
    setSlots:slots=>calls.push(['setSlots',slots.length]),
    setSlot:item=>calls.push(['setSlot',item.nodeId]),
    clearSlot:id=>calls.push(['clearSlot',id]),
    setMetadata:(id,meta)=>calls.push(['setMetadata',id,meta?.name||null]),
    mergeMetadata:(id,patch)=>calls.push(['mergeMetadata',id,patch?.name||null]),
    setOperation:(id,operation)=>calls.push(['setOperation',id,operation.label]),
    clearOperation:id=>calls.push(['clearOperation',id]),
    clearOperations:()=>calls.push(['clearOperations'])
  };
  const store=createSampleStore();
  store.bindMemory(memory);
  store.upsertFile(file(8,'snare',80));
  store.setMetadata(8,{name:'snare'});
  store.mergeMetadata(8,{name:'snare 2'});
  store.setOperation(8,{label:'MOVING'});
  store.clearOperation(8);
  store.removeFile(8);

  assert.deepEqual(calls.slice(0,1),[['setSlots',999]]);
  assert.equal(calls.some(call=>call[0]==='setSlot'&&call[1]===8),true);
  assert.equal(calls.some(call=>call[0]==='setMetadata'&&call[1]===8&&call[2]==='snare'),true);
  assert.equal(calls.some(call=>call[0]==='mergeMetadata'&&call[1]===8&&call[2]==='snare 2'),true);
  assert.equal(calls.some(call=>call[0]==='setOperation'&&call[1]===8),true);
  assert.equal(calls.some(call=>call[0]==='clearSlot'&&call[1]===8),true);
});

test('SampleStore moveLocal atomically moves file metadata and projection state',()=>{
  const store=createSampleStore();
  store.replaceFiles([file(7,'kick',100)]);
  store.setMetadata(7,{name:'kick',crc:123});
  store.setOperation(7,{label:'MOVING',progress:50});
  store.moveLocal(7,file(8,'kick',100),{
    metadata:{name:'kick',crc:123},
    verification:'verified'
  });

  assert.equal(store.getSlot(7).file,null);
  const moved=store.getSlot(8);
  assert.equal(moved.file.name,'kick');
  assert.equal(moved.meta.crc,123);
  assert.equal(moved.operation.label,'MOVING');
  assert.equal(moved.verification.file,'verified');
  assert.equal(moved.verification.metadata,'verified');
});

test('SampleStore prioritization keeps selected then active-range then remaining slots',()=>{
  const slots=[{id:9},{id:2},{id:5},{id:3}];
  assert.deepEqual(
    prioritizeSampleSlots(slots,{selectedId:5,activeRange:[2,3]}).map(slot=>slot.id),
    [5,2,3,9]
  );
});


test('SampleStore preserves exact metadata history across inventory refresh without treating it as current state',()=>{
  const store=createSampleStore();
  store.replaceFiles([file(7,'kick',100),file(8,'snare',80)]);
  store.setMetadata(7,{name:'cached kick',crc:111});
  store.setMetadata(8,{name:'cached snare',crc:222});

  store.resetInventory({preserveMetadata:true});
  assert.equal(store.countOccupied(),0);
  assert.equal(store.getSlot(7).meta,null);

  store.replaceFiles([file(7,'kick',100),file(8,'snare',81)]);
  assert.equal(store.getCachedMetadata(store.getSlot(7)).name,'cached kick');
  assert.equal(store.getSlot(7).meta.name,'cached kick');
  assert.equal(store.getSlot(8).meta,null);
});

test('SampleStore invalidation prevents stale metadata from being reused after a device event',()=>{
  const store=createSampleStore();
  store.replaceFiles([file(7,'kick',100)]);
  store.setMetadata(7,{name:'old',crc:111});
  store.invalidateMetadata(7);
  store.resetInventory({preserveMetadata:true});
  store.replaceFiles([file(7,'kick',100)]);
  assert.equal(store.getCachedMetadata(store.getSlot(7)),null);
  assert.equal(store.getSlot(7).meta,null);
});

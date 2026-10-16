import test from 'node:test';
import assert from 'node:assert/strict';
import{createSampleStore}from '../js/ep133/sampleStore.js';
import{numberedSampleSlot,planSampleUploadTargets}from '../js/ep133/ui/sampleUploadPlan.js';
import{createSampleUploadController}from '../js/ep133/ui/sampleUploadController.js';

const file=name=>({name,type:'audio/wav'});
const withFiles=(ids=[])=>{
 const store=createSampleStore();
 store.replaceFiles([
  {nodeId:1000,fileName:'/sounds',fileType:'folder'},
  ...ids.map(id=>({nodeId:id,fileName:'/sounds/'+id,fileType:'file',fileSize:22,
   isReadable:true,isWritable:true,isDeletable:true}))
 ]);
 store.setSoundsParentId(1000);
 return store;
};
const ids=plan=>plan.targets.map(item=>item.slot.id);

test('1–999 sample prefixes accept spaces or underscore before a nonempty name',()=>{
 for(const [name,slot] of [
  ['1_micro kick.wav',1],['2 snare.wav',2],['9\tHat.wav',9],
  ['10_snare.wav',10],['12 Kick.wav',12],['99_Bass.wav',99],
  ['01 Kick.wav',1],['099_bass.wav',99],
  ['001 Kick.wav',1],['056  Snare.wav',56],['055_808.wav',55],
  ['999 Bass.wav',999],['008\tClap.wav',8],
  ['000 Kick.wav',null],['0_Kick.wav',null],['1000 Kick.wav',null],
  ['056.wav',null],['1.wav',null],['1_.wav',null],
  ['056 .wav',null],['other 056 Kick.wav',null],
  ['1-Kick.wav',null],['1Kick.wav',null],['1234_Kick.wav',null]
 ])assert.equal(numberedSampleSlot(name),slot,name);
});
test('explicit numbered mode ignores drop slot for valid named sources but does not overwrite',()=>{
 const store=withFiles([7,8]);
 const list=[file('056 Snare.wav'),file('001 Kick.wav'),file('999 Bass.wav')];
 const numbered=planSampleUploadTargets(list,{startSlot:9,sampleStore:store,mode:'numbered'});
 assert.deepEqual(ids(numbered),[56,1,999]);
 assert.equal(numbered.numberedCount,3);
 assert.deepEqual(ids(planSampleUploadTargets(list,{startSlot:9,sampleStore:store,mode:'sequential'})),[9,10,11]);
 assert.throws(()=>planSampleUploadTargets([file('007 Kick.wav')],{startSlot:9,sampleStore:store,mode:'numbered'}),/already contains.*Nothing will be overwritten/);
});
test('mixed numbered and unnumbered sources are assigned disjoint slots in original order',()=>{
 const store=withFiles([9,10]);
 const list=[file('012 Pad.wav'),file('Loose.wav'),file('013 Hat.wav'),file('Unnumbered.wav')];
 const planned=planSampleUploadTargets(list,{startSlot:9,sampleStore:store,mode:'numbered'});
 assert.deepEqual(ids(planned),[12,11,13,14]);
});
test('duplicate numeric prefixes and insufficient empty slots fail BEFORE any writes',()=>{
 const store=withFiles([]);
 assert.throws(()=>planSampleUploadTargets([file('056 A.wav'),file('056 B.wav')],{
  startSlot:1,sampleStore:store,mode:'numbered'
 }),/Multiple files specify slot 056/);
 assert.throws(()=>planSampleUploadTargets([file('Loose.wav'),file('999 Hat.wav')],{
  startSlot:999,sampleStore:store,mode:'numbered'
 }),/Not enough free sample slots/);
 assert.throws(()=>planSampleUploadTargets([file('001 A.wav')],{
  startSlot:1,sampleStore:store,mode:'surprise'
 }),/Unknown sample upload destination mode/);
});

const harness=choice=>{
 const store=withFiles([7,8]);let mutations=0,chosenOptions=null;
 const preflights=[],uploadedNames=new Map();
 const created=[],sampleNames=[];
 const memory={selectSlots(){}};
 const controller=createSampleUploadController({
  sampleStore:store,getMemory:()=>memory,getSoundsParentId:()=>1000,
  getSoundFormats:()=>[],getSoundsMetadata:()=>({free_space_in_bytes:500}),
  setSoundsMetadata:()=>{},getActiveDeviceProfile:()=>({playModes:['oneshot'],advancedSampleMetadataWrites:true}),
  isConnected:()=>true,isSynchronized:()=>true,isDeviceUnsafe:()=>false,
  captureBatchSession:()=> 'S1',assertBatchSession:token=>assert.equal(token,'S1'),
  setMutating:flag=>{if(flag)mutations++;},setGlobalProgress(){},hideGlobalProgress(){},
  withFileTransaction:async(_name,op)=>op({
   uploadSampleToSlot:async options=>{
    created.push(options.destinationId);
    sampleNames.push(options.filename);
     uploadedNames.set(options.destinationId,options.filename.replace(/\.wav$/i,'').toLowerCase());
    options.onCreated?.(options.destinationId);
    return options.destinationId;
   },getFileInfo:async id=>({nodeId:id,parentId:1000,fileSize:12,fileName:uploadedNames.get(id)}),
    getFileMetadata:async id=>({name:uploadedNames.get(id),channels:1,samplerate:46875,format:'s16'}),
    deleteFile:async()=>{throw new Error('Should not delete existing samples');}
  }),
  assertSlotsEmpty:async chosen=>{preflights.push([...chosen]);},
  refreshSoundsRuntimeMetadata:async()=>({free_space_in_bytes:500}),
  prepareSampleLocalMetadata:x=>({...x,name:x.name.replace(/\.wav$/i,'').toLowerCase()}),
  normalizeFileName:x=>x.replace(/\.wav$/i,'').toLowerCase(),
  fileItemFromInfo:info=>({nodeId:info.nodeId,fileName:'/sounds/'+info.fileName,fileSize:info.fileSize,isWritable:true,isDeletable:true,isReadable:true,isPlayable:true}),getFileInfo:async()=>null,getFileMetadata:async()=>null,
  renderDeviceStats(){},markUploadPending(){},clearUploadPending(){},
  waitForMetadataUpdate:async()=>null,deleteFile:async()=>{},
  syncMetadataAfterMutation:async()=>{},assertSlotsDeleted:async()=>{},
  logTechnical(){},showError(){},setTimeoutFn:()=>1,
  prepareSample:async()=>({data:new Uint8Array(12),channels:1,samplerate:46875,format:'s16',metadata:{}}),
  chooseUploadTargets:async options=>{chosenOptions=options;return typeof choice==='function'?choice(options):choice;}
 });
 return{controller,store,created,sampleNames,get mutations(){return mutations;},
  get preflights(){return preflights;},get chosenOptions(){return chosenOptions;}};
};
test('cancelled numbered upload sends no FILE mutation and does not set busy',async()=>{
 const h=harness(null);
 const result=await h.controller.uploadFilesToSlot(h.store.getSlot(9),[file('056 Snare.wav')]);
 assert.equal(result.cancelled,true);
 assert.deepEqual(h.created,[]);
 assert.equal(h.mutations,0);
 assert.deepEqual(ids(h.chosenOptions.numberedPlan),[56]);
 assert.deepEqual(ids(h.chosenOptions.sequentialPlan),[9]);
});
test('numbered selection preflights exact destinations and cleans names without rewriting local files',async()=>{
 const h=harness('numbered');
 const files=[file('056 Snare.wav'),file('001 Kick.wav')];
 const result=await h.controller.uploadFilesToSlot(h.store.getSlot(9),files);
 assert.deepEqual(result.successes,[56,1]);
 assert.deepEqual(h.preflights,[[56],[1]]);
 assert.deepEqual(h.created,[56,1]);
 assert.deepEqual(h.sampleNames,['Snare.wav','Kick.wav']);
 assert.equal(files[0].name,'056 Snare.wav');
 assert.equal(h.mutations,1);
});
test('1_micro kick target is slot 001 and its upload name has no prefix',async()=>{
 const h=harness('numbered');
 const original=file('1_micro kick.wav');
 const result=await h.controller.uploadFilesToSlot(h.store.getSlot(9),[original]);
 assert.deepEqual(ids(h.chosenOptions.numberedPlan),[1]);
 assert.deepEqual(result.successes,[1]);
 assert.deepEqual(h.created,[1]);
 assert.deepEqual(h.preflights,[[1]]);
 assert.deepEqual(h.sampleNames,['micro kick.wav']);
 assert.equal(original.name,'1_micro kick.wav');
});
test('1_micro kick can instead upload to the next free slot, still without prefix',async()=>{
 const h=harness('sequential');
 const result=await h.controller.uploadFilesToSlot(h.store.getSlot(9),[file('1_micro kick.wav')]);
 assert.deepEqual(result.successes,[9]);
 assert.deepEqual(h.preflights,[[9]]);
 assert.deepEqual(h.sampleNames,['micro kick.wav']);
});
test('short and padded prefixes targeting same slot are rejected before FILE write',()=>{
 const store=withFiles([]);
 assert.throws(
   ()=>planSampleUploadTargets([file('1_kick.wav'),file('001 Snare.wav')],{startSlot:9,sampleStore:store,mode:'numbered'}),
   /Multiple files specify slot 001/
 );
 const occupied=withFiles([1]);
 assert.throws(
   ()=>planSampleUploadTargets([file('1_kick.wav')],{startSlot:9,sampleStore:occupied,mode:'numbered'}),
   /Slot 001 already contains a sample/
 );
});

test('next free choice preserves current slot-first semantics even with numbered files',async()=>{
 const h=harness('sequential');
 const result=await h.controller.uploadFilesToSlot(h.store.getSlot(9),[file('056 Snare.wav')]);
 assert.deepEqual(result.successes,[9]);
 assert.deepEqual(h.preflights,[[9]]);
 assert.deepEqual(h.sampleNames,['Snare.wav']);
});

test('a second drag or paste cannot mutate while numbered target dialog is unresolved',async()=>{
 let dismiss;
 const h=harness(()=>new Promise(resolve=>{dismiss=resolve;}));
 const pending=h.controller.uploadFilesToSlot(h.store.getSlot(9),[file('056 Snare.wav')]);
 await assert.rejects(
  ()=>h.controller.uploadFilesToSlot(h.store.getSlot(10),[file('Loose.wav')]),
  /Finish or cancel the open upload destination choice/
 );
 assert.equal(h.mutations,0);
 dismiss(null);
 assert.equal((await pending).cancelled,true);
 assert.deepEqual(h.created,[]);
});

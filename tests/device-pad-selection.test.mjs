import test from 'node:test';
import assert from 'node:assert/strict';
import{createDevicePadSelectionController}from '../js/ep133/ui/devicePadSelectionController.js';
import{TE_SYSEX_FILE_EVENT_METADATA_UPDATED}from '../js/ep133/constants.js';

const wait=()=>new Promise(resolve=>setTimeout(resolve,30));
const event=(id,metadata)=>({type:TE_SYSEX_FILE_EVENT_METADATA_UPDATED,data:{nodeId:id,metadata}});
const build=({assigned=9,occupied=[9],connected=true}={})=>{
  const calls=[],notes=[];
  const metadata=new Map([
    [601,{active:700}],[700,{active:701}],[701,{sym:assigned}],
    [2000,{active:3001}]
  ]);
  const infos=new Map([
    [2000,{nodeId:2000,fileName:'projects',parentId:0}],
    [3001,{nodeId:3001,fileName:'01',parentId:2000}],
    [601,{nodeId:601,fileName:'groups',parentId:3001}],
    [700,{nodeId:700,fileName:'A',parentId:601}],
    [701,{nodeId:701,fileName:'01',parentId:700}]
  ]);
  const ops={
    getFileInfo:async id=>infos.get(Number(id)),
    getFileMetadata:async id=>metadata.get(Number(id))||{},
    listDirectory:async(id,path)=>Number(id)===3001
      ?[{nodeId:601,fileName:'/projects/01/groups',fileType:'folder'}]:[]
  };
  const controller=createDevicePadSelectionController({
    isConnected:()=>connected,isSynchronized:()=>true,
    sampleStore:{getSlot:id=>({id,file:occupied.includes(id)?{name:'sample'}:null})},
    getMemory:()=>({selectSlots:(ids,options)=>calls.push({ids,options})}),
    withFileTransaction:async(label,fn)=>fn(ops),
    getFileInfo:ops.getFileInfo,getFileMetadata:ops.getFileMetadata,listDirectory:ops.listDirectory,
    logTechnical:(label,error)=>notes.push(String(error?.message||error)),
    schedule:fn=>setTimeout(fn,0)
  });
  return{controller,calls,notes,metadata};
};

test('EP group active pad event selects assigned sample without preview playback',async()=>{
  const x=build();
  x.controller.handleFileEvent(event(700,{active:701}));
  await wait();
  assert.equal(x.notes.length,0);
  assert.deepEqual(x.calls,[{ids:[9],options:{activeId:9,preview:false,navigate:true}}]);
  x.metadata.set(701,{sym:8});
  x.controller.handleFileEvent(event(701,{sym:8}));
  await wait();
  assert.equal(x.calls.length,1,'unoccupied slot is not selected');
});

test('EP group and project navigation resolve the active pad without playing',async()=>{
  const x=build();
  x.controller.handleFileEvent(event(601,{active:700}));
  await wait();
  x.controller.handleFileEvent(event(2000,{active:3001}));
  await wait();
  assert.deepEqual(x.calls.map(item=>item.ids),[[9],[9]]);
  assert.ok(x.calls.every(item=>item.options.preview===false));
});

test('sample metadata and stale/disconnected events do not hijack selection',async()=>{
  const x=build({connected:false});
  x.controller.handleFileEvent(event(700,{active:701}));
  x.controller.handleFileEvent(event(9,{name:'new name'}));
  await wait();
  assert.equal(x.calls.length,0);
});

test('optional active-pad callback receives guarded authoritative FID and assignment',async()=>{
  const active=[];
  const controller=createDevicePadSelectionController({isConnected:()=>true,isSynchronized:()=>true,
    withFileTransaction:async(label,fn)=>fn({getFileInfo:async()=>({fileName:'A',parentId:4500}),getFileMetadata:async()=>({sym:7})}),
    captureBatchSession:()=>1,assertBatchSession:token=>assert.equal(token,1),onActivePad:value=>active.push(value),schedule:fn=>setTimeout(fn,0)});
  // Parent INFO must identify the group collection before active selection is accepted.
  controller.handleFileEvent(event(4501,{active:6107}));await wait();assert.equal(active.length,0);
  controller.reset();
  const accepted=createDevicePadSelectionController({isConnected:()=>true,isSynchronized:()=>true,
    withFileTransaction:async(label,fn)=>fn({getFileInfo:async id=>id===4501?{fileName:'A',parentId:4500}:{fileName:'groups'},getFileMetadata:async()=>({sym:7})}),
    captureBatchSession:()=>1,assertBatchSession:()=>{},onActivePad:value=>active.push(value),schedule:fn=>setTimeout(fn,0)});
  accepted.handleFileEvent(event(4501,{active:6107}));await wait();assert.deepEqual(active,[{padId:6107,sym:7}]);accepted.reset();
});

test('active-pad callback resolves cross-project/group literal target through INFO parents',async()=>{
 const received=[],infos=new Map([[6207,{nodeId:6207,fileName:'12',parentId:4600}],[4600,{nodeId:4600,fileName:'B',parentId:4300}],[4300,{nodeId:4300,fileName:'groups',parentId:3100}],[3100,{nodeId:3100,fileName:'02',parentId:2000}],[2000,{nodeId:2000,fileName:'projects',parentId:0}]]);
 const controller=createDevicePadSelectionController({isConnected:()=>true,isSynchronized:()=>true,onActivePad:selection=>received.push(selection),withFileTransaction:async(label,fn)=>fn({getFileInfo:async id=>infos.get(id),getFileMetadata:async()=>({sym:8})}),captureBatchSession:()=>1,assertBatchSession:()=>{},schedule:fn=>setTimeout(fn,0)});
 controller.handleFileEvent(event(4600,{active:6207}));await wait();assert.deepEqual(received,[{padId:6207,sym:8,target:{project:'02',group:'B',pad:'12',projectFid:3100,groupFid:4600,padFid:6207,sampleSlot:8}}]);controller.reset();
});

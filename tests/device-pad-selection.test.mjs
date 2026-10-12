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

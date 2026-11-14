import test from 'node:test';
import assert from 'node:assert/strict';
import {createSampleCopyController} from '../js/ep133/ui/sampleCopyController.js';

const PCM=Uint8Array.from([0,1,2,3,254,255]);

function harness({readback=PCM,readbackError=null,changeSession=false,sourceReadable=true}={}){
  const events=[];
  const files=new Map([[7,{id:7,nodeId:7,node:{isReadable:sourceReadable},file:{name:'source',fileSize:PCM.length}}]]);
  const metadata=new Map();
  const operations=new Map();
  let session='a';
  const sampleStore={
    getSlot:id=>files.get(id)||{id,nodeId:id},
    upsertFile:(item,{state,verification})=>{files.set(item.nodeId,{id:item.nodeId,nodeId:item.nodeId,file:item,state,verification:{file:verification}});events.push(['upsert',item.nodeId,state,verification]);},
    setMetadata:(id,value,opts)=>{metadata.set(id,{value,verification:opts.verification});events.push(['set-metadata',id]);},
    setOperation:(id,value)=>{operations.set(id,value);events.push(['operation',id,value.label]);},
    clearOperation:id=>{operations.delete(id);},
    clearOperations:()=>{operations.clear();},
    removeFile:id=>{files.delete(id);events.push(['remove',id]);},
    countOccupied:()=>files.size
  };
  const fileOps={
    getFile:async id=>{
      events.push(['get',id]);
      if(id===7)return{data:PCM.slice()};
      if(id===8){
        if(changeSession)session='b';
        if(readbackError)throw readbackError;
        return{data:readback};
      }
      throw new Error('unexpected get '+id);
    },
    getFileMetadata:async id=>{events.push(['metadata',id]);return{name:'source',pitch:-12};},
    uploadSampleToSlot:async options=>{
      events.push(['put',options.destinationId]);
      options.onCreated?.(options.destinationId);
      return options.destinationId;
    },
    getFileInfo:async id=>{events.push(['info',id]);return{nodeId:id,fileName:'copy',fileSize:PCM.length};},
    deleteFile:async id=>events.push(['delete',id])
  };
  const controller=createSampleCopyController({
    sampleStore,
    getSoundsParentId:()=>1000,getSoundsMetadata:()=>({free_space_in_bytes:100}),
    getActiveDeviceProfile:()=>({playModes:[],advancedSampleMetadataWrites:true}),
    isConnected:()=>true,
    withFileTransaction:async(_name,operation,{strict})=>{
      assert.equal(strict,true);
      events.push(['transaction']);
      return operation(fileOps);
    },
    captureBatchSession:()=>session,
    assertBatchSession:token=>{if(session!==token)throw new Error('session changed');},
    getDeviceSessionToken:()=>session,
    setMutating:value=>events.push(['mutating',value]),
    setGlobalProgress:label=>events.push(['progress',label]),hideGlobalProgress:()=>events.push(['hide']),
    assertSlotsEmpty:async()=>{},refreshSoundsRuntimeMetadata:async()=>({free_space_in_bytes:100}),
    getFile:fileOps.getFile,getFileMetadata:fileOps.getFileMetadata,
    prepareSampleTransferMetadata:value=>value,
    createTransferFileName:()=> 'cp007_008',
    uploadSampleToSlot:fileOps.uploadSampleToSlot,
    waitForMetadataUpdate:()=>Promise.resolve(null),syncMetadataAfterMutation:async()=>events.push(['sync']),
    getFileInfo:fileOps.getFileInfo,
    fileItemFromInfo:info=>info,
    prepareSampleLocalMetadata:value=>value,renderDeviceStats:()=>{},
    deleteFile:fileOps.deleteFile,readDevice:async()=>events.push(['resync']),
    markDeviceUnsafe:reason=>events.push(['unsafe',reason]),
    logTechnical:()=>{}
  });
  const source=sampleStore.getSlot(7);
  return{
    events,files,metadata,operations,
    run:()=>controller.copyTransfer([{sourceId:7,targetId:8}],new Map([[7,source]]),[source])
  };
}

test('COPY does not announce success until destination PCM is byte-exact',async()=>{
  const h=harness();
  assert.deepEqual(await h.run(),{targetIds:[8]});
  assert.deepEqual(h.events.filter(e=>e[0]==='get').map(e=>e[1]),[7,8]);
  assert.ok(h.events.findIndex(e=>e[0]==='info')<h.events.findIndex(e=>e[0]==='get'&&e[1]===8));
  assert.equal(h.files.get(8).verification.file,'verified');
  assert.equal(h.metadata.get(8).verification,'expected');
  assert.equal(h.events.some(e=>e[0]==='operation'&&e[2]==='COPIED'),true);
  assert.equal(h.events.some(e=>e[0]==='unsafe'||e[0]==='delete'),false);
});

for(const [name,readback] of [
  ['one different byte',Uint8Array.from([0,1,2,9,254,255])],
  ['truncated destination',PCM.subarray(0,5)],
  ['expanded destination',Uint8Array.from([0,1,2,3,254,255,0])],
  ['invalid result',null]
]){
  test('COPY fails closed on '+name+' without deleting the written slot',async()=>{
    const h=harness({readback});
    await assert.rejects(h.run,/COPY PCM verification failed/);
    assert.ok(h.files.has(7),'source stays intact');
    assert.equal(h.files.get(8).verification.file,'unverified');
    assert.equal(h.events.some(e=>e[0]==='operation'&&e[2]==='COPIED'),false);
    assert.equal(h.events.some(e=>e[0]==='delete'||e[0]==='resync'),false);
    assert.equal(h.events.filter(e=>e[0]==='unsafe').length,1);
    assert.equal(h.events.filter(e=>e[0]==='put').length,1);
    assert.equal(h.operations.get(8).label,'UNVERIFIED');
  });
}

test('COPY readback transport error does not trigger an automatic DELETE or retry',async()=>{
  const h=harness({readbackError:new Error('FILE_GET timeout')});
  await assert.rejects(h.run,/COPY PCM verification failed: FILE_GET timeout/);
  assert.deepEqual(h.events.filter(e=>e[0]==='get').map(e=>e[1]),[7,8]);
  assert.equal(h.events.some(e=>e[0]==='delete'||e[0]==='resync'),false);
  assert.equal(h.files.get(8).verification.file,'unverified');
});

test('COPY session change during destination GET fails closed',async()=>{
  const h=harness({changeSession:true});
  await assert.rejects(h.run,/COPY PCM verification failed: session changed/);
  assert.equal(h.events.filter(e=>e[0]==='unsafe').length,0);
  assert.equal(h.events.some(e=>e[0]==='delete'||e[0]==='resync'),false);
  assert.equal(h.files.has(8),false,'stale readback must not update a new session inventory');
});

test('COPY refuses unreadable source before any FILE transaction',async()=>{
  const h=harness({sourceReadable:false});
  await assert.rejects(h.run,/cannot be read/);
  assert.equal(h.events.some(e=>e[0]==='transaction'||e[0]==='put'),false);
});

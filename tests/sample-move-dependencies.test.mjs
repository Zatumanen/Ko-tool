import test from 'node:test';
import assert from 'node:assert/strict';
import{createSampleMoveController}from '../js/ep133/ui/sampleMoveController.js';
import{createSampleStore}from '../js/ep133/sampleStore.js';
import{createSampleDependencyGuard}from '../js/ep133/sampleDependencyGuard.js';

// Synthetic pad-only TAR: enough for the production read-only dependency reader.
const projectTar=length=>{
  const bytes=new Uint8Array(2048),header=bytes.subarray(0,512);
  const text=(offset,value)=>header.set(new TextEncoder().encode(value),offset);
  text(0,'pads/a/p01');text(124,length.toString(8));header[156]=48;
  header.fill(32,148,156);
  text(148,header.reduce((sum,byte)=>sum+byte,0).toString(8)+'\0');
  bytes[513]=7;
  return bytes;
};
const makeHarness=({sku='TE032AS001',failure=null,withoutTransaction=false,crcVerified=true}={})=>{
  const sampleStore=createSampleStore(),events=[];
  const entry=id=>({nodeId:id,fileName:'/sounds/sample'+id,fileType:'file',fileSize:64});
  sampleStore.replaceFiles([entry(7),entry(10)]);
  for(const id of [7,10])sampleStore.setMetadata(id,{name:'sample'+id,crc:id*1001});
  const guard=createSampleDependencyGuard({getConnectedDeviceInfo:()=>({sku,metadata:{os_version:'2.5.1'}})});
  const archive=projectTar(failure==='unsupported'?3:sku==='TE032AS006'?29:26);
  if(failure==='corrupt')archive[0]^=1;
  const fileOps={
    async listDirectory(node){
      events.push(['list',node]);
      if(failure==='missing-projects')return[];
      return node===0?[{nodeId:2000,fileName:'/projects',fileType:'folder'}]
        :[{nodeId:3001,fileName:'/projects/01',fileType:'folder'}];
    },
    async getFile(id){
      events.push(['get',id]);
      if(failure==='unavailable')throw new Error('Project read unavailable');
      return{data:archive};
    },
    async moveFile(sourceId,parentId,targetId,options){
      events.push(['move',sourceId,targetId,options]);
      return{oldFileId:sourceId,newFileId:targetId,sourceCrc:sourceId*1001,
        destinationCrc:sourceId*1001,crcVerified,metadata:{crc:sourceId*1001},
        info:entry(targetId)};
    }
  };
  const controller=createSampleMoveController({
    sampleStore,getSoundsParentId:()=>1000,getSoundsMetadata:()=>({}),fileItemFromInfo:info=>info,
    remapCurrentPropertySlot(){},renderDeviceStats(){},
    withFileTransaction:withoutTransaction?undefined:async(label,operation,options)=>{
      assert.equal(options.strict,true);
      events.push(['transaction']);
      // Same preflight contract as filesystem.withFileTransaction; real guard/parser.
      await guard.assertOperationSafe(fileOps,operation);
      return operation(fileOps);
    },
    captureBatchSession:()=> 'session',assertBatchSession(){},getDeviceSessionToken:()=> 'session',
    isConnected:()=>true,setMutating(){},setGlobalProgress(){},hideGlobalProgress(){},
    suppressNativeMoveEvent:()=>()=>{},clearNativeMoveSuppression(){},
    moveFile:fileOps.moveFile,readDevice:async()=>{},logTechnical(){}
  });
  return{events,sampleStore,run:ids=>controller.nativeMoveTransfer(
    ids.map((sourceId,index)=>({sourceId,targetId:20+index})),
    new Map(ids.map(id=>[id,sampleStore.getSlot(id)]))
  )};
};

for(const sku of ['TE032AS001','TE032AS006']){
  test(sku+': unreferenced MOVE reads project before mutation and retains CRC verification',async()=>{
    const h=makeHarness({sku});
    assert.deepEqual(await h.run([10]),{targetIds:[20]});
    const get=h.events.findIndex(e=>e[0]==='get'),move=h.events.findIndex(e=>e[0]==='move');
    assert.ok(get>=0&&get<move);
    assert.equal(h.events[move][3].verifyCrc,true);
    assert.equal(h.sampleStore.getSlot(10).file,null);
    assert.ok(h.sampleStore.getSlot(20).file);
  });
  test(sku+': referenced source blocks MOVE without mutation',async()=>{
    const h=makeHarness({sku});
    await assert.rejects(()=>h.run([7]),/slot 007 is used by P01 A01.*MOVE would break/);
    assert.deepEqual(h.events.filter(e=>e[0]==='move'),[]);
    assert.ok(h.sampleStore.getSlot(7).file);
  });
  test(sku+': later referenced source blocks the entire batch before its first MOVE',async()=>{
    const h=makeHarness({sku});
    await assert.rejects(()=>h.run([10,7]),/slot 007 is used by P01 A01/);
    assert.deepEqual(h.events.filter(e=>e[0]==='move'),[]);
    assert.ok(h.sampleStore.getSlot(10).file);
    assert.ok(h.sampleStore.getSlot(7).file);
  });
  for(const failure of ['corrupt','unsupported','unavailable','missing-projects']){
    test(sku+': '+failure+' project blocks MOVE without mutation',async()=>{
      const h=makeHarness({sku,failure});
      await assert.rejects(()=>h.run([10]),/TAR|pad-record size|unavailable|not available/);
      assert.deepEqual(h.events.filter(e=>e[0]==='move'),[]);
      assert.ok(h.sampleStore.getSlot(10).file);
    });
  }
}

test('MOVE fails closed when strict FILE transaction API is missing',async()=>{
  const h=makeHarness({withoutTransaction:true});
  await assert.rejects(()=>h.run([10]),/MOVE requires.*FILE transaction/);
  assert.deepEqual(h.events.filter(e=>e[0]==='move'),[]);
});

test('MOVE still rejects a destination CRC mismatch',async()=>{
  const h=makeHarness({crcVerified:false});
  await assert.rejects(()=>h.run([10]),/CRC verification failed/);
  assert.ok(h.events.some(e=>e[0]==='get'));
  assert.equal(h.sampleStore.getSlot(20).file,null);
});

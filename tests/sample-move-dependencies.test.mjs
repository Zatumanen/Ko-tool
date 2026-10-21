import test from 'node:test';
import assert from 'node:assert/strict';
import{createSampleMoveController}from '../js/ep133/ui/sampleMoveController.js';
import{createSampleStore}from '../js/ep133/sampleStore.js';
import{createSampleDependencyGuard}from '../js/ep133/sampleDependencyGuard.js';
import{verifyNativeProjectSlotMove}from '../js/ep133/sampleMoveProjectVerification.js';

// Synthetic pad-only TARs exercise the real read-only dependency parser.
const projectTar=(slot,length)=>{
  const bytes=new Uint8Array(2048),header=bytes.subarray(0,512);
  const text=(offset,value)=>header.set(new TextEncoder().encode(value),offset);
  text(0,'pads/a/p01');text(124,length.toString(8));header[156]=48;
  header.fill(32,148,156);
  text(148,header.reduce((sum,byte)=>sum+byte,0).toString(8)+'\0');
  bytes[513]=slot&255;bytes[514]=slot>>>8;
  return bytes;
};

const harness=({sku='TE032AS001',firmware='2.5.1',failure=null,
  withoutTransaction=false,crcVerified=true,afterRead=()=>{},referenced=[7,12]}={})=>{
  const sampleStore=createSampleStore(),events=[];
  const entry=id=>({nodeId:id,fileName:'/sounds/sample'+id,fileType:'file',fileSize:64});
  sampleStore.replaceFiles([7,10,12].map(entry));
  for(const id of [7,10,12])sampleStore.setMetadata(id,{name:'sample'+id,crc:id*1001});
  let session='session-a';
  const guard=createSampleDependencyGuard({
    getConnectedDeviceInfo:()=>({sku,metadata:{os_version:firmware}})
  });
  const archives=new Map([3001,3002].map((id,index)=>{
    const bytes=projectTar(referenced[index],failure==='unsupported'?3:sku==='TE032AS006'?29:26);
    if(failure==='corrupt'&&index===1)bytes[0]^=1;
    return[id,bytes];
  }));
  const fileOps={
    async listDirectory(node){
      events.push(['list',node]);
      if(failure==='missing-projects')return[];
      return node===0?[{nodeId:2000,fileName:'/projects',fileType:'folder'}]
        :[1,2].map(n=>({nodeId:3000+n,fileName:'/projects/0'+n,fileType:'folder'}));
    },
    async getFile(id){
      events.push(['get',id]);
      if(failure==='unavailable'&&id===3002)throw new Error('Project read unavailable');
      afterRead(id);
      if(failure==='session-change')session='session-b';
      return{data:archives.get(id)};
    },
    async moveFile(sourceId,parentId,targetId,options){
      events.push(['move',sourceId,targetId,options]);
      if(failure==='second-move-fails'&&sourceId===12)throw new Error('Second MOVE request failed');
      // Firmware simulation is scoped to the observed EP-133 2.5.1 behavior.
      if(sku==='TE032AS001'&&firmware==='2.5.1'){
        for(const [projectId,bytes] of archives){
          const stored=bytes[513]|bytes[514]<<8;
          if(stored===sourceId&&failure!=='firmware-did-not-remap'){
            bytes[513]=targetId&255;bytes[514]=(targetId>>>8)&255;
            if(failure==='unrelated-project-edit'&&projectId===3001)bytes[515]^=1;
          }
        }
      }
      if(failure==='timeout-after-move')throw new Error('FILE_MOVE response timeout');
      return{oldFileId:sourceId,newFileId:targetId,sourceCrc:sourceId*1001,
        destinationCrc:sourceId*1001,crcVerified,metadata:{crc:sourceId*1001},info:entry(targetId)};
    }
  };
  fileOps.getFileInInitializedSession=async id=>{
    events.push(['fast-get',id]);
    return fileOps.getFile(id);
  };
  const controller=createSampleMoveController({
    sampleStore,getSoundsParentId:()=>1000,getSoundsMetadata:()=>({}),fileItemFromInfo:info=>info,
    remapCurrentPropertySlot(){},renderDeviceStats(){},
    withFileTransaction:withoutTransaction?undefined:async(label,operation,options)=>{
      assert.equal(options.strict,true);
      events.push(['transaction']);
      // Production filesystem performs this preflight inside the FILE lease.
      await guard.assertOperationSafe(fileOps,operation);
      return operation(fileOps);
    },
    captureBatchSession:()=>session,
    assertBatchSession:token=>{if(token!==session)throw new Error('Device session changed');},
    getDeviceSessionToken:()=>session,isConnected:()=>true,
    markDeviceUnsafe:reason=>events.push(['unsafe',reason]),
    verifyNativeProjectSlotMove,
    setMutating:value=>events.push(['mutating',value]),
    setGlobalProgress:(label,value)=>events.push(['progress',label,value]),
    hideGlobalProgress:()=>events.push(['hide-progress']),
    suppressNativeMoveEvent:()=>()=>{},clearNativeMoveSuppression(){},
    moveFile:fileOps.moveFile,readDevice:async()=>events.push(['resync']),logTechnical(){}
  });
  const sourceById=new Map([7,10,12].map(id=>[id,sampleStore.getSlot(id)]));
  const runPlan=plan=>controller.nativeMoveTransfer(plan,sourceById);
  return{events,sampleStore,runPlan,run:ids=>runPlan(ids.map((sourceId,index)=>({sourceId,targetId:20+index})))};
};

const assertNoMove=h=>{
  assert.deepEqual(h.events.filter(e=>e[0]==='move'),[]);
  for(const id of [7,10,12])assert.ok(h.sampleStore.getSlot(id).file);
  assert.deepEqual(h.events.at(-2),['hide-progress']);
  assert.deepEqual(h.events.at(-1),['mutating',false]);
};

for(const sku of ['TE032AS001','TE032AS006']){
  test(sku+': unreferenced MOVE checks CRC using firmware-scoped dependency policy',async()=>{
    const h=harness({sku});
    assert.deepEqual(await h.run([10]),{targetIds:[20]});
    const move=h.events.findIndex(e=>e[0]==='move');
    assert.deepEqual(h.events.slice(0,move).filter(e=>e[0]==='get'),
      sku==='TE032AS001'?[]:[['get',3001],['get',3002]]);
    assert.equal(h.events[move][3].verifyCrc,true);
    assert.equal(h.sampleStore.getSlot(10).file,null);
    assert.ok(h.sampleStore.getSlot(20).file);
  });
  for(const id of [7,12])test(sku+': reference to '+id+' follows firmware-scoped MOVE rules',async()=>{
    const h=harness({sku});
    if(sku==='TE032AS006'){
      await assert.rejects(()=>h.run([id]),/is used by P0[12] A01.*MOVE would break/);
      assertNoMove(h);
    }else{
      assert.deepEqual(await h.run([id]),{targetIds:[20]});
      assert.equal(h.events.filter(e=>e[0]==='move').length,1);
      assert.deepEqual(h.events.filter(e=>e[0]==='get'),[]);
      assert.deepEqual(h.events.filter(e=>e[0]==='list'),[]);
      assert.ok(h.sampleStore.getSlot(20).file);
      assert.equal(h.events.some(e=>e[0]==='unsafe'),false);
    }
  });
  test(sku+': batch references are checked and verified under one strict lease',async()=>{
    const h=harness({sku});
    if(sku==='TE032AS006'){
      await assert.rejects(()=>h.run([10,7]),/slot 007 is used by P01 A01/);
      assertNoMove(h);
    }else{
      assert.deepEqual(await h.run([10,7]),{targetIds:[20,21]});
      assert.deepEqual(h.events.filter(e=>e[0]==='move').map(e=>e.slice(1,3)),
        [[10,20],[7,21]]);
      assert.equal(h.events.filter(e=>e[0]==='get').length,0);
    }
  });
  for(const failure of ['corrupt','unsupported','unavailable','missing-projects']){
    test(sku+': '+failure+' project integrity is scanned only when firmware remap is unverified',async()=>{
      const h=harness({sku,failure});
      if(sku==='TE032AS001'){
        assert.deepEqual(await h.run([10]),{targetIds:[20]});
        assert.equal(h.events.filter(e=>e[0]==='get').length,0);
      }else{
        await assert.rejects(()=>h.run([10]),/TAR|pad-record size|unavailable|not available/);
        assertNoMove(h);
      }
    });
  }
}

test('MOVE fails closed without the strict FILE transaction API',async()=>{
  const h=harness({withoutTransaction:true});
  await assert.rejects(()=>h.run([10]),/MOVE requires.*FILE transaction/);
  assertNoMove(h);
});

test('session change during strict dependency reads prevents MOVE on unverified firmware',async()=>{
  const h=harness({sku:'TE032AS006',failure:'session-change'});
  await assert.rejects(()=>h.run([10]),/session changed/);
  assertNoMove(h);
});

test('unknown SKU cannot bypass project dependency preflight',async()=>{
  const h=harness({sku:'UNKNOWN'});
  await assert.rejects(()=>h.run([10]),/unverified/i);
  assertNoMove(h);
});

test('caller plan changes during preflight cannot move an unscanned source',async()=>{
  const plan=[{sourceId:10,targetId:20}];
  const h=harness({sku:'TE032AS006',afterRead:()=>{plan[0].sourceId=7;}});
  await h.runPlan(plan);
  assert.deepEqual(h.events.filter(e=>e[0]==='move').map(e=>e.slice(1,3)),[[10,20]]);
  assert.ok(h.sampleStore.getSlot(7).file);
});

test('MOVE still rejects destination CRC mismatch after dependency preflight',async()=>{
  const h=harness({crcVerified:false});
  await assert.rejects(()=>h.run([10]),/CRC verification failed/);
  assert.deepEqual(h.events.filter(e=>e[0]==='get'),[]);
  assert.equal(h.sampleStore.getSlot(20).file,null);
});

test('EP-133 firmware remaps one sample in two saved projects without TAR writes',async()=>{
  const h=harness({referenced:[7,7]});
  assert.deepEqual(await h.run([7]),{targetIds:[20]});
  assert.deepEqual(h.events.filter(e=>e[0]==='get'),[]);
  assert.deepEqual(h.events.filter(e=>e[0]==='list'),[]);
  assert.deepEqual(h.events.filter(e=>e[0]==='move').map(e=>e.slice(1,3)),[[7,20]]);
  assert.equal(h.events.some(e=>e[0]==='unsafe'),false);
});

test('native-only route cannot detect a hypothetical broken firmware project remap',async()=>{
  const h=harness({failure:'firmware-did-not-remap'});
  assert.deepEqual(await h.run([7]),{targetIds:[20]});
  assert.equal(h.events.filter(e=>e[0]==='get').length,0);
  assert.equal(h.events.filter(e=>e[0]==='unsafe').length,0);
});
test('native-only route does not inspect unrelated simulated project changes',async()=>{
  const h=harness({failure:'unrelated-project-edit'});
  assert.deepEqual(await h.run([7]),{targetIds:[20]});
  assert.equal(h.events.filter(e=>e[0]==='get').length,0);
});
test('EP-133 does not retry or reverse MOVE after an ambiguous timeout',async()=>{
  const h=harness({failure:'timeout-after-move'});
  await assert.rejects(()=>h.run([7]),/Native MOVE may have changed/);
  assert.deepEqual(h.events.filter(e=>e[0]==='move').map(e=>e.slice(1,3)),[[7,20]]);
  assert.equal(h.events.filter(e=>e[0]==='unsafe').length,1);
});

test('a failed second native MOVE never automatically reverses the first',async()=>{
  const h=harness({failure:'second-move-fails'});
  await assert.rejects(()=>h.run([7,12]),/Second MOVE request failed/);
  assert.deepEqual(h.events.filter(e=>e[0]==='move').map(e=>e.slice(1,3)),[[7,20],[12,21]]);
  assert.equal(h.events.filter(e=>e[0]==='unsafe').length,1);
});

test('referenced MOVE remains blocked on an unverified firmware',async()=>{
  const h=harness({firmware:'2.5.2'});
  await assert.rejects(()=>h.run([7]),/unverified|not supported|reference|lock/i);
  assertNoMove(h);
});

test('verified EP-133 mirrors official MOVE: no project reads, still checks CRC and progress',async()=>{
  const h=harness({referenced:[7,7]});
  assert.deepEqual(await h.run([7]),{targetIds:[20]});
  assert.deepEqual(h.events.filter(e=>e[0]==='fast-get'),[]);
  assert.deepEqual(h.events.filter(e=>e[0]==='get'),[]);
  const progress=h.events.filter(e=>e[0]==='progress');
  const labels=progress.map(e=>e[1]);
  assert.deepEqual([...new Set(labels)],['MOVE','VERIFY']);
  assert.equal(progress.at(-1)[2],100);
  assert.equal(h.events.filter(e=>e[0]==='move').length,1);
});

test('EP-40 retains traditional FILE_GET init before every project read',async()=>{
  const h=harness({sku:'TE032AS006'});
  assert.deepEqual(await h.run([10]),{targetIds:[20]});
  assert.deepEqual(h.events.filter(e=>e[0]==='fast-get'),[]);
  assert.deepEqual(h.events.filter(e=>e[0]==='get').map(e=>e[1]),[3001,3002]);
});

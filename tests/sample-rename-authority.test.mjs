import test from 'node:test';
import assert from 'node:assert/strict';
import {createSampleStore} from '../js/ep133/sampleStore.js';
import {getEpDeviceProfile} from '../js/ep133/deviceProfile.js';
import {createSampleRenameController} from '../js/ep133/ui/sampleRenameController.js';

const makeStore=()=>{
  const store=createSampleStore();
  store.replaceFiles([{
    nodeId:7,fileName:'/sounds/kick',fileType:'file',fileSize:4,
    isReadable:true,isWritable:true,isDeletable:true
  }]);
  store.setMetadata(7,{name:'kick'});
  return store;
};

const makeController=({firmware='2.5.1',hold=null}={})=>{
  let session='ep-a:epoch-1',currentFirmware=firmware;
  let setCount=0,transactionCount=0;
  const store=makeStore();
  const controller=createSampleRenameController({
    sampleStore:store,
    isConnected:()=>true,isSynchronized:()=>true,
    getActiveDeviceProfile:()=>getEpDeviceProfile('TE032AS001',currentFirmware),
    captureBatchSession:()=>session,
    assertBatchSession:token=>{
      if(token!==session)throw Error('EP session changed while queued.');
    },
    withFileTransaction:async(label,operation,options)=>{
      transactionCount++;
      assert.equal(label,'sample rename transaction');
      assert.equal(options.strict,true);
      if(hold)await hold;
      return operation({
        setFileMetadata:async()=>{setCount++;},
        getFileMetadata:async()=>({name:'renamed'})
      });
    },
    normalizeFileName:value=>String(value).trim().toLowerCase(),
    setFileMetadata:async()=>{throw Error('Unleased SET must not run.');},
    getFileMetadata:async()=>{throw Error('Unleased GET must not run.');}
  });
  return{
    controller,store,
    swap:()=>{session='ep-b:epoch-2';},
    changeFirmware:value=>{currentFirmware=value;},
    counts:()=>({setCount,transactionCount})
  };
};

test('Rename denies writable FILE slot when exact firmware metadata capability is unverified',async()=>{
  const f=makeController({firmware:'2.5.2'});
  assert.equal(getEpDeviceProfile('TE032AS001','2.5.2').advancedSampleMetadataWrites,false);
  await assert.rejects(()=>f.controller.rename(f.store.getSlot(7),'renamed'),
    /metadata.*(not|unverified|unsupported|disabled)|firmware/i);
  assert.deepEqual(f.counts(),{setCount:0,transactionCount:0});
});

test('Rename rechecks original EP session inside queued FILE mutation before SET',async()=>{
  let release;
  const hold=new Promise(resolve=>{release=resolve;});
  const f=makeController({hold});
  const pending=f.controller.rename(f.store.getSlot(7),'renamed');
  await new Promise(resolve=>setImmediate(resolve));
  f.swap();
  release();
  await assert.rejects(pending,/session changed/i);
  assert.equal(f.counts().setCount,0);
});

test('Rename rechecks firmware capability inside queued FILE mutation before SET',async()=>{
  let release;
  const hold=new Promise(resolve=>{release=resolve;});
  const f=makeController({hold});
  const pending=f.controller.rename(f.store.getSlot(7),'renamed');
  await new Promise(resolve=>setImmediate(resolve));
  f.changeFirmware('2.5.2');
  release();
  await assert.rejects(pending,/metadata.*(not|unverified|unsupported|disabled)|firmware/i);
  assert.equal(f.counts().setCount,0);
});

test('Rename on exact verified firmware uses one strict lease and verified metadata readback',async()=>{
  const f=makeController();
  const result=await f.controller.rename(f.store.getSlot(7),'renamed');
  assert.equal(result,'renamed');
  assert.deepEqual(f.counts(),{setCount:1,transactionCount:1});
  assert.equal(f.store.getSlot(7).verification.metadata,'verified');
});

test('Rename refuses a sample removed while the FILE mutation was waiting in the queue',async()=>{
  let release;
  const hold=new Promise(resolve=>{release=resolve;});
  const f=makeController({hold});
  const pending=f.controller.rename(f.store.getSlot(7),'renamed');
  await new Promise(resolve=>setImmediate(resolve));
  f.store.removeFile(7);
  release();
  await assert.rejects(pending,/no longer available/i);
  assert.equal(f.counts().setCount,0);
  assert.equal(f.store.getSlot(7).file,null);
});

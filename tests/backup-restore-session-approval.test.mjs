import test from 'node:test';
import assert from 'node:assert/strict';
import {createEpBackupBundle} from '../js/ep133/backupBundle.js';
import {createBackupRestoreController} from '../js/ep133/ui/backupRestoreController.js';

const fakeElement=()=>({
  hidden:true,disabled:false,dataset:{},innerHTML:'',textContent:'',value:'',
  addEventListener(){},append(){},querySelector(){return null;}
});

async function fixture({deferPreflight=false}={}){
  const previousDocument=globalThis.document;
  globalThis.document={createElement:()=>fakeElement()};
  let session='device-a:epoch-1',approved=null,queueWait=null,queueEnter=null,afterConfirmation=false;
  const writes=[];
  const transactions=[];
  const queued=new Promise(resolve=>{queueEnter=resolve;});
  const stalled=new Promise(resolve=>{queueWait=resolve;});
  const device={sku:'TE032AS001',metadata:{os_version:'2.5.1'}};
  const {blob}=await createEpBackupBundle({
    scope:'project',device,projects:[{project:'02',data:Uint8Array.from([1,2,3]),
      dependencies:{referencedSampleSlots:[]}}]
  });
  const button=fakeElement();
  const controller=createBackupRestoreController({
    dialog:fakeElement(),restoreButton:button,restoreSummary:fakeElement(),
    restoreProjectSelect:fakeElement(),getConnectedDeviceInfo:()=>device,
    getActiveDeviceProfile:()=>({sampleTransfers:true,playModes:[],sampleBars:{writeValues:[]}}),
    captureBatchSession:()=>session,
    assertBatchSession:token=>{if(token!==session)throw new Error('EP device session changed; restore rejected.');},
    withFileTransaction:async(label,operation)=>{
      transactions.push(label);
      if(deferPreflight&&afterConfirmation&&label==='backup restore preflight'){
        queueEnter();
        await stalled;
      }
      return operation({
        listDirectory:async(nodeId)=>nodeId===0
          ?[{nodeId:1000,fileName:'/sounds',fileType:'folder'}]:[],
        getFileMetadata:async()=>({}),
        deleteFile:async()=>{writes.push('DELETE');}
      });
    },
    uploadProjectArchive:async(file,options)=>{
      options.assertSession?.();
      writes.push({name:file.name,session,options});
    },
    confirmAction:()=>new Promise(resolve=>{approved=resolve;}),
    readDevice:async()=>{},refreshProjects:async()=>{},listProjectRecoveryCheckpoints:async()=>[],markDeviceUnsafe:()=>{},
    setStatus(){},setGlobalProgress(){},hideGlobalProgress(){}
  });
  const restoreFile=new File([blob],'backup.zip',{type:'application/zip'});
  await controller.onRestoreFile(restoreFile);
  assert.equal(button.disabled,false,'preflight permits an empty-dependency project');
  return{
    controller,writes,transactions,
    swap:()=>{session='device-b:epoch-2';},
    accept:()=>{afterConfirmation=true;assert.ok(approved);approved(true);},
    queued,release:()=>queueWait(),
    cleanup:()=>{globalThis.document=previousDocument;}
  };
}

test('restore confirmation cannot authorize another connected session with the same SKU/firmware',async()=>{
  const f=await fixture();
  try{
    const pending=f.controller.executeRestore();
    f.swap();
    f.accept();
    await assert.rejects(pending,/session changed|restore rejected/i);
    assert.equal(f.writes.length,0,'zero project or sample mutations on the replacement EP');
  }finally{f.cleanup();}
});

test('restore preflight queued after approval fails closed when session changes before lease execution',async()=>{
  const f=await fixture({deferPreflight:true});
  try{
    const pending=f.controller.executeRestore();
    f.accept();
    await f.queued;
    f.swap();
    f.release();
    await assert.rejects(pending,/session changed|restore rejected/i);
    assert.equal(f.writes.length,0);
  }finally{f.cleanup();}
});

test('restore on the same authorized session keeps strict project writer admission',async()=>{
  const f=await fixture();
  try{
    const pending=f.controller.executeRestore();
    f.accept();
    await pending;
    assert.equal(f.writes.length,1);
    assert.equal(f.writes[0].name,'P02.tar');
    assert.equal(typeof f.writes[0].options.assertSession,'function',
      'the queued project writer must check approval inside its own FILE lease');
    f.writes[0].options.assertSession();
  }finally{f.cleanup();}
});

test('legacy TAR Restore rejects invalid sizes before reading file bytes',async()=>{
  const f=await fixture();
  try{
    const transactions=f.transactions.length;
    for(const size of [0,1023,1025,128*1024*1024+512]){
      const file=new File([],'P02.tar');
      let reads=0;
      Object.defineProperty(file,'size',{value:size});
      file.arrayBuffer=async()=>{reads++;throw Error('Unexpected TAR read');};
      await assert.rejects(f.controller.onRestoreFile(file),/TAR.*invalid size/i);
      assert.equal(reads,0);
    }
    assert.equal(f.transactions.length,transactions);
    assert.deepEqual(f.writes,[]);
  }finally{f.cleanup();}
});

test('legacy TAR Restore rejects a short read before FILE preflight',async()=>{
  const f=await fixture();
  const file=new File([new Uint8Array(1024)],'P02.tar');
  file.arrayBuffer=async()=>new ArrayBuffer(512);
  try{
    const transactions=f.transactions.length;
    await assert.rejects(f.controller.onRestoreFile(file),/TAR size changed during read/i);
    assert.equal(f.transactions.length,transactions);
    assert.deepEqual(f.writes,[]);
  }finally{f.cleanup();}
});

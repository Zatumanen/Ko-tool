import test from 'node:test';
import assert from 'node:assert/strict';
import{createProjectFilesystem}from '../js/ep133/projectFilesystem.js';
import{createMemoryProjectRecoveryStore,createProjectRecoveryCheckpoint}from '../js/ep133/projectRecovery.js';

const emptyTar=()=>new Uint8Array(1024);
const projectFile=data=>({name:'P01.tar',async arrayBuffer(){return data.slice().buffer;}});
const device={sku:'TE032AS001',metadata:{os_version:'2.5.1',serial:'PROJECT-EVENT-DEVICE'}};

function makeHarness({failReadback=false,unsafeAfterWrite=false,failRollback=false,recoveryStore=createMemoryProjectRecoveryStore()}={}){
  const events=[];
  const backup=emptyTar();
  const candidate=emptyTar();
  candidate[0]=1;
  let projectData=backup.slice();
  let afterCandidate=false;
  let readbackFailed=false;
  let unsafe=false;
  let putCount=0;
  const filesystem=createProjectFilesystem({
    runFileOperation:operation=>operation(),
    withStrictFirmwareDebugGuard:operation=>operation(),
    getConnectedDeviceInfo:()=>device,
    markDeviceUnsafe:()=>{unsafe=true;},
    isDeviceUnsafe:()=>unsafe,
    initRead:async()=>{},
    initFileSystem:async()=>{
      if(unsafeAfterWrite&&afterCandidate){unsafe=true;throw new Error('device disconnected after candidate write');}
    },
    listDirectory:async(nodeId)=>{
      if(nodeId===0)return[{nodeId:2000,fileName:'/projects',fileType:'folder'}];
      if(nodeId===2000)return[{nodeId:3001,fileName:'/projects/01',fileType:'folder'}];
      return[];
    },
    listDeviceFiles:async()=>[],
    getFile:async()=>{
      if(afterCandidate&&failReadback&&!readbackFailed){readbackFailed=true;throw new Error('candidate readback failed');}
      return{name:'P01.tar',size:projectData.byteLength,data:projectData.slice()};
    },
    putFile:async({data})=>{
      putCount+=1;
      if(failRollback&&putCount>1)throw new Error('rollback write failed');
      projectData=new Uint8Array(data).slice();
      afterCandidate=true;
      return 3001;
    },
    getFileMetadata:async()=>({}),
    setFileMetadata:async()=>{},
    recoveryStore,
    onRecoveryEvent:event=>events.push(event)
  });
  return{filesystem,events,recoveryStore,backup,candidate};
}

test('project write requiring recovery emits required only after checkpoint status is persisted',async()=>{
  const harness=makeHarness({unsafeAfterWrite:true});
  await assert.rejects(()=>harness.filesystem.uploadProjectArchive(projectFile(harness.candidate),{performReload:false}),/disconnected/);
  assert.equal(harness.events.length,1);
  assert.equal(harness.events[0].type,'required');
  assert.equal(harness.events[0].status,'requires-recovery');
  assert.equal(harness.events[0].projectNumber,'01');
  const saved=await harness.recoveryStore.getCheckpoint(harness.events[0].checkpointId);
  assert.equal(saved.status,'requires-recovery');
});

test('successful project rollback emits resolved after rollback readback succeeds',async()=>{
  const harness=makeHarness({failReadback:true});
  await assert.rejects(()=>harness.filesystem.uploadProjectArchive(projectFile(harness.candidate),{performReload:false}),/candidate readback failed/);
  assert.equal(harness.events.length,1);
  assert.equal(harness.events[0].type,'resolved');
  assert.equal(harness.events[0].status,'rolled-back');
  const saved=await harness.recoveryStore.getCheckpoint(harness.events[0].checkpointId);
  assert.equal(saved.status,'rolled-back');
});

test('failed project rollback emits required with rollback-failed status',async()=>{
  const harness=makeHarness({failReadback:true,failRollback:true});
  await assert.rejects(()=>harness.filesystem.uploadProjectArchive(projectFile(harness.candidate),{performReload:false}),error=>{
    return error?.projectRollbackSucceeded===false&&/rollback write failed/.test(String(error?.rollbackError?.message||''));
  });
  assert.equal(harness.events.length,1);
  assert.equal(harness.events[0].type,'required');
  assert.equal(harness.events[0].status,'rollback-failed');
  const saved=await harness.recoveryStore.getCheckpoint(harness.events[0].checkpointId);
  assert.equal(saved.status,'rollback-failed');
});

test('successful restore resolves the source checkpoint only after the replacement write verifies',async()=>{
  const store=createMemoryProjectRecoveryStore();
  const original=emptyTar();
  const checkpoint=createProjectRecoveryCheckpoint({
    device,projectNumber:'01',destinationFid:3001,parentFid:2000,
    backup:{name:'P01.tar',data:original},candidate:emptyTar()
  });
  await store.saveCheckpoint(checkpoint);
  await store.updateCheckpoint(checkpoint.id,{status:'requires-recovery',transactionStatus:'requires-recovery'});
  const harness=makeHarness({recoveryStore:store});
  await harness.filesystem.restoreProjectRecoveryCheckpoint(checkpoint.id,{performReload:false});
  const sourceEvent=harness.events.find(event=>event.checkpointId===checkpoint.id&&event.type==='resolved');
  assert.ok(sourceEvent);
  assert.equal(sourceEvent.status,'restored');
  assert.equal((await store.getCheckpoint(checkpoint.id)).status,'restored');
  assert.ok(harness.events.some(event=>event.type==='resolved'&&event.status==='verified'&&event.checkpointId!==checkpoint.id));
});

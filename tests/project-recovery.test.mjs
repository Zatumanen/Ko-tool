import test from 'node:test';
import assert from 'node:assert/strict';
import{
  crc32Hex,hashDeviceIdentity,createProjectRecoveryCheckpoint,createMemoryProjectRecoveryStore
}from '../js/ep133/projectRecovery.js';
import{createProjectFilesystem}from '../js/ep133/projectFilesystem.js';

const emptyTar=()=>new Uint8Array(1024);
const projectFile=data=>({
  name:'P01.tar',
  async arrayBuffer(){return data.slice().buffer;}
});

const makeHarness=({
  recoveryStore=createMemoryProjectRecoveryStore(),
  failCheckpoint=false,
  failReadback=false,
  unsafeAfterWrite=false
}={})=>{
  const actions=[];
  const backup=emptyTar();
  const candidate=emptyTar();
  let projectData=backup.slice();
  let afterCandidate=false;
  let unsafe=false;
  let readbackFailed=false;
  const store=failCheckpoint?{
    persistent:true,
    async saveCheckpoint(){actions.push('checkpoint-save');throw new Error('checkpoint unavailable');},
    async updateCheckpoint(){throw new Error('should not update');},
    async getCheckpoint(){return null;},
    async listCheckpoints(){return[];},
    async deleteCheckpoint(){return false;}
  }:{
    persistent:recoveryStore.persistent,
    async saveCheckpoint(checkpoint){
      actions.push('checkpoint-save');
      return recoveryStore.saveCheckpoint(checkpoint);
    },
    async updateCheckpoint(id,patch){
      actions.push('checkpoint-'+patch.status);
      return recoveryStore.updateCheckpoint(id,patch);
    },
    getCheckpoint:id=>recoveryStore.getCheckpoint(id),
    listCheckpoints:()=>recoveryStore.listCheckpoints(),
    deleteCheckpoint:id=>recoveryStore.deleteCheckpoint(id)
  };

  const filesystem=createProjectFilesystem({
    runFileOperation:operation=>operation(),
    withStrictFirmwareDebugGuard:operation=>operation(),
    getConnectedDeviceInfo:()=>({
      sku:'TE032AS001',
      metadata:{os_version:'2.5.1',serial:'SERIAL-SHOULD-NOT-BE-STORED'}
    }),
    markDeviceUnsafe:reason=>{unsafe=true;actions.push(['unsafe',reason]);},
    isDeviceUnsafe:()=>unsafe,
    initRead:async()=>{actions.push('init-read');},
    initFileSystem:async()=>{
      actions.push('init-file-system');
      if(unsafeAfterWrite&&afterCandidate){
        unsafe=true;
        throw new Error('device disconnected after candidate write');
      }
    },
    listDirectory:async(nodeId,path)=>{
      actions.push(['list',nodeId,path]);
      if(nodeId===0)return[{nodeId:2000,fileName:'/projects',fileType:'folder'}];
      if(nodeId===2000)return[{nodeId:3001,fileName:'/projects/01',fileType:'folder'}];
      return[];
    },
    listDeviceFiles:async()=>[],
    getFile:async nodeId=>{
      actions.push(['get',nodeId]);
      if(afterCandidate&&failReadback&&!readbackFailed){
        readbackFailed=true;
        throw new Error('candidate readback failed');
      }
      return{name:'P01.tar',size:projectData.byteLength,data:projectData.slice()};
    },
    putFile:async({data})=>{
      actions.push('put');
      projectData=new Uint8Array(data).slice();
      afterCandidate=true;
      return 3001;
    },
    getFileMetadata:async()=>({}),
    setFileMetadata:async()=>{},
    recoveryStore:store
  });

  return{filesystem,actions,recoveryStore:store,candidate,backup,get unsafe(){return unsafe;}};
};

test('project recovery checkpoint stores original TAR context without raw device serial',()=>{
  const backup=Uint8Array.from([1,2,3,4]);
  const candidate=Uint8Array.from([4,3,2,1]);
  const device={sku:'TE032AS001',metadata:{os_version:'2.5.1',serial:'SECRET-SERIAL'}};
  const checkpoint=createProjectRecoveryCheckpoint({
    device,projectNumber:'01',destinationFid:3001,parentFid:2000,
    backup:{name:'P01.tar',data:backup},candidate,
    activation:{activeProject:3002},createdAt:new Date('2026-09-30T17:00:00Z')
  });

  assert.equal(checkpoint.status,'pending');
  assert.equal(checkpoint.operation,'project-write');
  assert.equal(checkpoint.device.sku,'TE032AS001');
  assert.equal(checkpoint.device.firmware,'2.5.1');
  assert.equal(checkpoint.device.identityHash,hashDeviceIdentity(device));
  assert.equal(JSON.stringify(checkpoint).includes('SECRET-SERIAL'),false);
  assert.equal(checkpoint.project.number,'01');
  assert.equal(checkpoint.project.destinationFid,3001);
  assert.equal(checkpoint.original.crc32,crc32Hex(backup));
  assert.equal(checkpoint.candidate.crc32,crc32Hex(candidate));
  assert.deepEqual([...checkpoint.original.data],[1,2,3,4]);
});

test('memory recovery store clones TAR bytes and preserves lifecycle state',async()=>{
  const store=createMemoryProjectRecoveryStore();
  const source=Uint8Array.from([8,7,6,5]);
  const checkpoint=createProjectRecoveryCheckpoint({
    device:{sku:'TE032AS001',metadata:{os_version:'2.5.1',serial:'A'}},
    projectNumber:'01',destinationFid:3001,parentFid:2000,
    backup:{name:'P01.tar',data:source},candidate:Uint8Array.from([1])
  });
  await store.saveCheckpoint(checkpoint);
  source[0]=0;

  const saved=await store.getCheckpoint(checkpoint.id);
  assert.equal(saved.original.data[0],8);
  saved.original.data[0]=1;
  assert.equal((await store.getCheckpoint(checkpoint.id)).original.data[0],8);

  await store.updateCheckpoint(checkpoint.id,{status:'verified'});
  assert.equal((await store.getCheckpoint(checkpoint.id)).status,'verified');
  assert.equal((await store.listCheckpoints()).length,1);
  assert.equal(await store.deleteCheckpoint(checkpoint.id),true);
  assert.equal(await store.getCheckpoint(checkpoint.id),null);
});

test('project write persists recovery checkpoint before the first PUT and marks verified after readback',async()=>{
  const harness=makeHarness();
  const result=await harness.filesystem.uploadProjectArchive(projectFile(harness.candidate),{performReload:false});
  const saveIndex=harness.actions.indexOf('checkpoint-save');
  const putIndex=harness.actions.indexOf('put');
  assert.ok(saveIndex>=0&&putIndex>saveIndex);
  assert.equal(result.recoveryCheckpoint.status,'verified');
  const records=await harness.filesystem.listProjectRecoveryCheckpoints();
  assert.equal(records.length,1);
  assert.equal(records[0].status,'verified');
  assert.deepEqual([...records[0].original.data],[...harness.backup]);
  assert.equal(records[0].device.identityHash.length,8);
});

test('project write fails closed before PUT when persistent checkpoint creation fails',async()=>{
  const harness=makeHarness({failCheckpoint:true});
  await assert.rejects(
    ()=>harness.filesystem.uploadProjectArchive(projectFile(harness.candidate),{performReload:false}),
    /checkpoint unavailable/
  );
  assert.equal(harness.actions.includes('put'),false);
});

test('project write marks a checkpoint rolled-back after a post-write verification failure',async()=>{
  const harness=makeHarness({failReadback:true});
  await assert.rejects(
    ()=>harness.filesystem.uploadProjectArchive(projectFile(harness.candidate),{performReload:false}),
    error=>error?.message==='candidate readback failed'&&error?.projectRollbackSucceeded===true
  );
  const records=await harness.filesystem.listProjectRecoveryCheckpoints();
  assert.equal(records.length,1);
  assert.equal(records[0].status,'rolled-back');
  assert.equal(harness.actions.filter(action=>action==='put').length,2);
});

test('unsafe/disconnect after candidate write retains a requires-recovery checkpoint without another PUT',async()=>{
  const harness=makeHarness({unsafeAfterWrite:true});
  await assert.rejects(
    ()=>harness.filesystem.uploadProjectArchive(projectFile(harness.candidate),{performReload:false}),
    /device disconnected after candidate write/
  );
  const records=await harness.filesystem.listProjectRecoveryCheckpoints();
  assert.equal(records.length,1);
  assert.equal(records[0].status,'requires-recovery');
  assert.equal(harness.actions.filter(action=>action==='put').length,1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createSampleUploadController} from '../js/ep133/ui/sampleUploadController.js';
import {createSampleStore} from '../js/ep133/sampleStore.js';
import {createSampleTransactionRuntime} from '../js/ep133/sampleTransactionRuntime.js';
import {createMemorySampleRecoveryStore} from '../js/ep133/sampleRecovery.js';
import {createFileEventController} from '../js/ep133/ui/fileEvents.js';
import {TE_SYSEX_FILE_EVENT_FILE_UPDATED} from '../js/ep133/constants.js';

const PCM=Uint8Array.from([0,1,2,3,254,255]);
const REPITCH_PCM=Uint8Array.from([9,8,7,6]);
const file=name=>{
  const wav=new Uint8Array(44+PCM.length),view=new DataView(wav.buffer),text=new TextEncoder();
  wav.set(text.encode('RIFF'));view.setUint32(4,wav.length-8,true);wav.set(text.encode('WAVEfmt '),8);
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,46875,true);view.setUint32(28,93750,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
  wav.set(text.encode('data'),36);view.setUint32(40,PCM.length,true);wav.set(PCM,44);
  return new File([wav],name,{type:'audio/wav'});
};
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};

function harness({readback,readbackError,changeSessionAt,repitch=false,hold=null,failPreparation=false,unsafeOnRead=false,failFinalization=false,rejectSlot=null}={}){
  const store=createSampleStore(),events=[],timers=[],written=new Map(),pending=new Set();
  store.replaceFiles([{nodeId:1000,fileName:'/sounds',fileType:'folder'}]);
  let session='a',epoch=1,unsafe=false,time=0;
  const recoveryStore=createMemorySampleRecoveryStore();
  const runtime=createSampleTransactionRuntime({recoveryStore,getConnectedDeviceInfo:()=>({sku:'TE032AS001',metadata:{os_version:'2.5.1'}})});
  const assertSession=token=>{if(token!==session)throw Error('session changed');};
  const changeSession=()=>{session='b';epoch++;store.replaceFiles([{nodeId:1000,fileName:'/sounds',fileType:'folder'},{nodeId:50,fileName:'/sounds/replacement',fileSize:2}]);};
  const fileOps={
    uploadSampleToSlot:async options=>{
      events.push(['put',options.destinationId]);
      if(options.destinationId===rejectSlot)throw Error('upload rejected');
      written.set(options.destinationId,{data:options.data.slice(),metadata:{...options.metadata,name:options.filename.replace(/\.wav$/,'')}});
      if(changeSessionAt==='created')changeSession();
      options.onCreated(options.destinationId);
      events.push(['writer-metadata',options.destinationId]);
      options.onProgress?.(options.data.length,options.data.length);
      if(changeSessionAt==='put')changeSession();
      return options.destinationId;
    },
    getFileInfo:async id=>{
      events.push(['info',id]);
      if(changeSessionAt==='info')changeSession();
      return{nodeId:id,fileName:'/sounds/'+written.get(id).metadata.name,fileSize:written.get(id).data.length,isReadable:true,isWritable:true,isDeletable:true,isPlayable:true};
    },
    getFileMetadata:async id=>{
      events.push(['metadata',id]);
      if(changeSessionAt==='metadata')changeSession();
      return written.get(id).metadata;
    },
    getFile:async(id,onProgress)=>{
      events.push(['get',id]);
      onProgress?.(0,written.get(id).data.length);
      if(hold)await hold.promise;
      time+=25;
      if(changeSessionAt==='get')changeSession();
      if(unsafeOnRead){unsafe=true;session=null;}
      if(readbackError)throw readbackError;
      const data=readback===undefined?written.get(id).data.slice():typeof readback==='function'?readback(id):readback;
      onProgress?.(data?.length||0,written.get(id).data.length);
      return{data};
    },
    deleteFile:async id=>{events.push(['delete',id]);written.delete(id);}
  };
  const controller=createSampleUploadController({
    sampleStore:store,getMemory:()=>({selectSlots:ids=>events.push(['select',...ids])}),
    getSoundsParentId:()=>1000,getSoundFormats:()=>[],getSoundsMetadata:()=>({free_space_in_bytes:1000}),setSoundsMetadata(){},
    getActiveDeviceProfile:()=>({playModes:[],advancedSampleMetadataWrites:true}),
    isConnected:()=>true,isSynchronized:()=>true,isDeviceUnsafe:()=>unsafe,
    captureBatchSession:()=>session,assertBatchSession:assertSession,getDeviceSessionToken:()=>session,getDeviceConnectionEpoch:()=>epoch,
    setMutating:value=>events.push(['mutating',value]),
    setGlobalProgress:(label,value)=>events.push(['progress',label,value]),hideGlobalProgress:()=>events.push(['hide']),
    withFileTransaction:async(label,operation,options={})=>{
      if(label==='sample upload hydration')return operation(fileOps);
      assert.equal(options.strict,true);events.push(['transaction']);
      // Production's coordinator rejects new mutations with unresolved recovery.
      if((await recoveryStore.listTransactions()).some(t=>t.status==='requires-recovery'))
        throw Error('FILE coordinator blocked by pending recovery');
      if(changeSessionAt==='lease')changeSession();
      return runtime.run({label,operation:async ops=>{
        const result=await operation(ops);
        if(failFinalization)throw Error('transaction finalization failed');
        return result;
      },fileOps});
    },
    assertSlotsEmpty:async()=>{},refreshSoundsRuntimeMetadata:async()=>({free_space_in_bytes:1000}),
    ...fileOps,prepareSampleLocalMetadata:value=>value,normalizeFileName:name=>name.replace(/\.wav$/,''),fileItemFromInfo:info=>info,
    renderDeviceStats(){},markUploadPending:id=>pending.add(id),clearUploadPending:id=>pending.delete(id),
    waitForMetadataUpdate:async()=>null,syncMetadataAfterMutation:async()=>{},assertSlotsDeleted:async()=>{},
    logTechnical:(label,error)=>events.push(['error',label,error.message]),showError:message=>events.push(['show-error',message]),
    markDeviceUnsafe:reason=>{events.push(['unsafe',reason]);unsafe=true;session=null;},
    onUploadTiming:value=>events.push(['timing',value]),clock:()=>time,
    prepareSample:async input=>{
      if(failPreparation&&input.name==='bad.wav')throw Error('decode failed');
      return{data:PCM.slice(),channels:1,samplerate:46875,format:'s16'};
    },
    getRepitchEnabled:()=>repitch,
    prepareRepitchSample:async()=>({data:REPITCH_PCM.slice(),channels:1,samplerate:46875,format:'s16',metadata:{'sound.pitch':-12}}),
    setTimeoutFn:(callback,delay)=>{timers.push({callback,delay});}
  });
  return{controller,store,events,written,pending,timers,recoveryStore,changeSession,fileOps,
    run:(names=['sample.wav'])=>controller.uploadFilesToSlot(store.getSlot(50),names.map(file))};
}

test('Upload waits for full PCM readback before success or the next PUT and includes VERIFY time',async()=>{
  const hold=deferred(),h=harness({hold});
  let finished=false;
  const resultPromise=h.run(['a.wav','b.wav']).finally(()=>{finished=true;});
  // Wait on the actual read boundary, not an elapsed timer.
  while(!finished&&!h.events.some(e=>e[0]==='get'))await new Promise(r=>setImmediate(r));
  assert.ok(h.events.some(e=>e[0]==='get'),'Upload must read back the destination');
  assert.deepEqual(h.events.filter(e=>e[0]==='put'),[['put',50]]);
  assert.notEqual(h.store.getSlot(50).verification.file,'verified');
  assert.equal(h.events.some(e=>e[0]==='timing'),false);
  assert.equal(h.events.some(e=>e[0]==='progress'&&e[2]===100),false);
  hold.resolve();
  const result=await resultPromise;
  assert.deepEqual(result.successes,[50,51]);assert.deepEqual(result.failures,[]);
  assert.deepEqual(h.events.filter(e=>e[0]==='put'||e[0]==='get'),[['put',50],['get',50],['put',51],['get',51]]);
  assert.equal(h.store.getSlot(50).verification.file,'verified');
  assert.equal(h.store.getSlot(50).operation.label,'WRITTEN');
  assert.equal(h.events.find(e=>e[0]==='timing')[1].verifyingMs,25);
});

for(const [name,options] of [
  ['same-size changed PCM',{readback:Uint8Array.from([0,1,2,9,254,255])}],
  ['short PCM',{readback:PCM.subarray(0,4)}],
  ['long PCM',{readback:Uint8Array.from([...PCM,0])}],
  ['invalid PCM',{readback:null}],
  ['GET rejection',{readbackError:Error('GET refused')}],
  ['incomplete GET and transport safety lock',{readbackError:Error('Incomplete FILE_GET'),unsafeOnRead:true}]
])test('Upload fails closed on '+name+' without DELETE/retry/next PUT or journal success',async()=>{
  const h=harness(options),result=await h.run(['first.wav','second.wav']);
  assert.deepEqual(result.successes,[]);assert.equal(result.failures.length,1);
  assert.deepEqual(h.events.filter(e=>e[0]==='put'),[['put',50]]);
  assert.equal(h.events.some(e=>e[0]==='delete'),false);
  assert.equal(h.events.some(e=>e[0]==='timing'),false);
  assert.ok(h.written.has(50));
  assert.equal(h.store.getSlot(50).verification.file,'unverified');
  assert.equal(h.store.getSlot(50).operation.label,'UNVERIFIED');
  h.timers.forEach(t=>t.callback());
  assert.equal(h.store.getSlot(50).operation.label,'UNVERIFIED');
  const transactions=await h.recoveryStore.listTransactions();
  assert.equal(transactions.length,1);assert.equal(transactions[0].status,'requires-recovery');
});

for(const stage of ['lease','created','put','info','metadata','get'])test('Upload session replacement at '+stage+' stops old work and never repaints/deletes replacement inventory',async()=>{
  const h=harness({changeSessionAt:stage}),result=await h.run(['a.wav','b.wav']);
  assert.deepEqual(result.successes,[]);assert.equal(result.failures.length,1);
  assert.deepEqual(h.events.filter(e=>e[0]==='put'),stage==='lease'?[]:[['put',50]]);
  assert.equal(h.events.some(e=>e[0]==='delete'||e[0]==='unsafe'),false);
  assert.equal(h.store.getSlot(50).file.name,'replacement');
  assert.equal(h.store.getSlot(50).operation,null);
  h.store.setOperation(50,{label:'NEW SESSION'});
  h.timers.forEach(t=>t.callback());
  assert.equal(h.store.getSlot(50).operation.label,'NEW SESSION');
  if(stage==='info')assert.equal(h.events.some(e=>e[0]==='metadata'),false);
  if(stage==='metadata')assert.equal(h.events.some(e=>e[0]==='get'),false);
  if(stage==='created')assert.equal(h.events.some(e=>e[0]==='writer-metadata'),false);
});

test('a preparation failure continues the queue without any rollback write',async()=>{
  const h=harness({failPreparation:true}),result=await h.run(['bad.wav','good.wav']);
  assert.deepEqual(result.successes,[51]);assert.equal(result.failures.length,1);
  assert.deepEqual(h.events.filter(e=>e[0]==='put'||e[0]==='get'),[['put',51],['get',51]]);
  assert.equal(h.events.some(e=>e[0]==='delete'||e[0]==='unsafe'),false);
});

test('a clean rejected create retains per-file failure handling and allows the next sample',async()=>{
  const h=harness({rejectSlot:50}),result=await h.run(['bad.wav','good.wav']);
  assert.deepEqual(result.successes,[51]);assert.equal(result.failures.length,1);
  assert.equal(h.store.getSlot(50).operation.label,'FAILED');
  assert.equal(h.store.getSlot(50).file,null);
  assert.equal(h.events.some(e=>e[0]==='delete'||e[0]==='unsafe'),false);
});

test('REPITCH verification uses exactly the prepared PCM passed to PUT',async()=>{
  const h=harness({repitch:true}),result=await h.run();
  assert.deepEqual(result.successes,[50]);
  assert.deepEqual(h.written.get(50).data,REPITCH_PCM);
  assert.equal(h.written.get(50).metadata['sound.pitch'],-12);
});

test('returning input PCM instead of prepared REPITCH PCM cannot pass verification',async()=>{
  const h=harness({repitch:true,readback:PCM}),result=await h.run();
  assert.deepEqual(result.successes,[]);assert.equal(result.failures.length,1);
  assert.equal(h.events.some(e=>e[0]==='delete'),false);
});

test('delayed upload cleanup from a verified batch does not affect a replacement session',async()=>{
  const h=harness();await h.run();h.changeSession();
  h.store.setOperation(50,{label:'NEW SESSION'});
  h.timers.forEach(t=>t.callback());
  assert.equal(h.store.getSlot(50).operation.label,'NEW SESSION');
});

test('a later PCM failure preserves earlier successes and skips the remainder of the batch',async()=>{
  const h=harness({readback:id=>id===51?Uint8Array.from([0,1,2,9,254,255]):PCM});
  const result=await h.run(['a.wav','b.wav','c.wav']);
  assert.deepEqual(result.successes,[50]);assert.equal(result.failures.length,1);
  assert.deepEqual(h.events.filter(e=>e[0]==='put'),[['put',50],['put',51]]);
  assert.equal(h.store.getSlot(50).verification.file,'verified');
  assert.equal(h.store.getSlot(51).verification.file,'unverified');
  assert.equal(h.events.some(e=>e[0]==='delete'),false);
});

test('FILE events and hydration cannot promote an Upload with unverified PCM',async()=>{
  const h=harness({readback:null});await h.run();
  const before=h.events.length;
  await h.controller.hydrateUploadedFileItem(50);
  const events=createFileEventController({sampleStore:h.store,isConnected:()=>true,
    getSoundsParentId:()=>1000,getSoundsMetadata:()=>({}),...h.fileOps,fileItemFromInfo:info=>info,
    withFileTransaction:async(_label,op)=>op(h.fileOps)});
  await events.handleFileEvent({type:TE_SYSEX_FILE_EVENT_FILE_UPDATED,data:{nodeId:50}});
  assert.equal(h.events.slice(before).some(e=>e[0]==='info'||e[0]==='metadata'),false);
  assert.equal(h.store.getSlot(50).verification.file,'unverified');
  assert.equal(h.store.getSlot(50).operation.label,'UNVERIFIED');
});

test('Upload cannot announce success if its FILE transaction fails after the callback',async()=>{
  const h=harness({failFinalization:true}),result=await h.run();
  assert.deepEqual(result.successes,[]);assert.equal(result.failures.length,1);
  assert.notEqual(h.store.getSlot(50).verification.file,'verified');
  assert.notEqual(h.store.getSlot(50).operation?.label,'WRITTEN');
});

test('a safety lock in a replacement epoch cannot mark the new inventory as an old unverified Upload',async()=>{
  const h=harness({changeSessionAt:'get',unsafeOnRead:true,readbackError:Error('GET interrupted')});
  const result=await h.run(['a.wav','b.wav']);
  assert.deepEqual(result.successes,[]);assert.equal(result.failures.length,1);
  assert.equal(h.store.getSlot(50).file.name,'replacement');
  assert.equal(h.store.getSlot(50).operation,null);
  assert.equal(h.events.some(e=>e[0]==='delete'||e[0]==='unsafe'),false);
});

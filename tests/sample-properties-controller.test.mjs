import test from 'node:test';
import assert from 'node:assert/strict';
import{createSamplePropertiesController}from '../js/ep133/ui/samplePropertiesController.js';
import{createSampleStore}from '../js/ep133/sampleStore.js';
import{createSampleTransferCoordinator}from '../js/ep133/ui/sampleTransferCoordinator.js';
import{createFileScheduler}from '../js/ep133/fileScheduler.js';

// Library-only adaptation of PR #139's controller harness. No pad writer.
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
const setup=({transaction=true,sessions=true}={})=>{
  const sampleStore=createSampleStore();
  sampleStore.replaceFiles([{nodeId:7,fileName:'/sounds/kick',fileSize:64,isWritable:true}]);
  const original={'sound.pitch':0,'sound.playmode':'oneshot','time.mode':'off','envelope.release':44,custom:'preserve'};
  sampleStore.setMetadata(7,original);
  let deviceMeta={...original},session='first',connected=true,ignore=false,reject=null;
  let beforeLease=null,nextRead=null,nextReadPatch=null,failureGate=null;
  const scheduler=createFileScheduler();
  const profile={name:'K.O. II',advancedSampleMetadataWrites:true,playModes:['oneshot','key','legato'],sampleBars:{authoring:false}};
  const writes=[],reads=[],errors=[],timers=new Map(),gridHandlers=new Map(),documentHandlers=new Map();
  let timerId=0;
  const body={},propertiesGrid={innerHTML:'',addEventListener:(type,fn)=>gridHandlers.set(type,fn)};
  const properties={hidden:true,parentElement:body,style:{},getBoundingClientRect:()=>({width:220,height:150})};
  const ops={
    async setFileMetadata(id,patch){
      writes.push({id,patch:{...patch},session});
      if(reject){
        if(failureGate){const gate=failureGate;failureGate=null;scheduler.run('other FILE operation',async()=>{gate.entered.resolve();await gate.release.promise;});}
        throw Error(reject);
      }
      if(!ignore)deviceMeta={...deviceMeta,...patch};
    },
    async getFileMetadata(id){
      reads.push({id,session});
      const snapshot={...deviceMeta,...nextReadPatch},gate=nextRead;nextRead=null;nextReadPatch=null;
      if(gate){gate.entered.resolve();await gate.release.promise;}
      return snapshot;
    }
  };
  const controller=createSamplePropertiesController({
    sampleStore,propertiesGrid,properties,
    documentRef:{body,addEventListener:(type,fn)=>documentHandlers.set(type,fn),removeEventListener:(type,fn)=>{if(documentHandlers.get(type)===fn)documentHandlers.delete(type);}},
    windowRef:{innerWidth:1280,innerHeight:800},getActiveDeviceProfile:()=>profile,
    isConnected:()=>connected,isSynchronized:()=>true,isMetadataHydrating:()=>false,isMutating:()=>false,
    setTimeoutFn:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeoutFn:id=>timers.delete(id),
    captureBatchSession:sessions?()=>{if(!connected)throw Error('Disconnected');return session;}:undefined,
    assertBatchSession:sessions?token=>{if(!connected||token!==session)throw Error('Device session changed.');}:undefined,
    withFileTransaction:transaction?(label,operation,options)=>scheduler.run(label,async()=>{
      assert.equal(label,'sample property write');assert.equal(options.strict,true);
      if(beforeLease){const gate=beforeLease;beforeLease=null;gate.entered.resolve();await gate.release.promise;}
      return operation(ops);
    }):undefined,
    setFileMetadata:ops.setFileMetadata,getFileMetadata:id=>scheduler.run('standalone GET',()=>ops.getFileMetadata(id)),
    showError:message=>errors.push(message),logTechnical(){}
  });
  const slot=()=>sampleStore.getSlot(7);
  const flush=(key='sound.pitch')=>controller.flushPropertyWrite('7:'+key);
  return{controller,sampleStore,slot,flush,writes,reads,errors,profile,properties,propertiesGrid,gridHandlers,documentHandlers,timers,
    original,scheduler,open:()=>controller.open(slot(),{clientX:100,clientY:100}),
    ignore:value=>{ignore=value;},reject:value=>{reject=value;},
    replaceMetadata:patch=>{deviceMeta={...deviceMeta,...patch};sampleStore.setMetadata(7,deviceMeta);},
    changeSession:()=>{session='second';},disconnect:()=>{connected=false;session='disconnected';},
    reconnect:()=>{connected=true;session='second';},
    nextReadPatch:patch=>{nextReadPatch=patch;},
    holdAfterRejectedSet:()=>{const gate={entered:deferred(),release:deferred()};failureGate=gate;return gate;},
    deferRead:()=>{const gate={entered:deferred(),release:deferred()};nextRead=gate;return gate;},
    deferLease:()=>{const gate={entered:deferred(),release:deferred()};beforeLease=gate;return gate;}
  };
};

test('canonical library metadata and SAVED wait for verified GET, not SET acknowledgement',async()=>{
  const s=setup();s.open();const gate=s.deferRead();
  s.controller.change(s.slot(),'sound.pitch',1);
  assert.equal(s.slot().meta['sound.pitch'],0);
  const writing=s.flush();await gate.entered.promise;
  assert.equal(s.slot().meta['sound.pitch'],0);
  assert.match(s.propertiesGrid.innerHTML,/SAVING/);
  assert.doesNotMatch(s.propertiesGrid.innerHTML,/SAVED ON EP/);
  gate.release.resolve();await writing;
  assert.equal(s.slot().meta['sound.pitch'],1);
  assert.equal(s.slot().verification.metadata,'verified');
  assert.match(s.propertiesGrid.innerHTML,/SAVED ON EP/);
  assert.equal(s.controller.hasPendingWrites(),false);
});

test('rapid changes accumulate latest intent without marking unsent values verified',async()=>{
  const s=setup();
  for(let i=0;i<3;i++)s.controller.change(s.slot(),'sound.pitch',1);
  assert.equal(s.slot().meta['sound.pitch'],0);
  await s.flush();
  assert.equal(s.writes.length,1);assert.equal(s.writes[0].patch['sound.pitch'],3);
  assert.equal(s.slot().meta['sound.pitch'],3);
});

test('edits during readback retain the latest intent for the next strict transaction',async()=>{
  const s=setup();s.open();const gate=s.deferRead();
  s.controller.change(s.slot(),'sound.pitch',1);const first=s.flush();await gate.entered.promise;
  s.controller.change(s.slot(),'sound.pitch',1);s.controller.change(s.slot(),'sound.pitch',1);
  gate.release.resolve();await first;
  assert.equal(s.slot().meta['sound.pitch'],1);
  assert.equal(s.controller.hasPendingWrites(),true);
  assert.match(s.propertiesGrid.innerHTML,/SAVING/);
  await s.flush();
  assert.deepEqual(s.writes.map(w=>w.patch['sound.pitch']),[1,3]);
  assert.equal(s.slot().meta['sound.pitch'],3);
  assert.equal(s.controller.hasPendingWrites(),false);
});

for(const fault of ['ignored','rejected'])test(fault+' SET retains authoritative metadata and exposes refusal without retry',async()=>{
  const s=setup();s.open();
  if(fault==='ignored')s.ignore(true);else s.reject('Device refused metadata update');
  s.controller.change(s.slot(),'sound.pitch',1);await s.flush();
  assert.equal(s.slot().meta['sound.pitch'],0);
  assert.equal(s.writes.length,1);
  assert.match(s.propertiesGrid.innerHTML,/NOT SAVED/);
  assert.match(s.errors[0],fault==='ignored'?/did not confirm.*sound.pitch/:/Device refused/);
  assert.equal(s.controller.hasPendingWrites(),false);
});

for(const [name,value]of Object.entries({null:null,empty:'',false:false,array:[],object:{},whitespace:' ',missing:undefined}))
test('malformed '+name+' numeric readback cannot confirm a zero library pitch',async()=>{
  const s=setup();s.replaceMetadata({'sound.pitch':-1});s.open();
  s.nextReadPatch({'sound.pitch':value});
  s.controller.change(s.slot(),'sound.pitch',1);await s.flush();
  assert.equal(s.writes[0].patch['sound.pitch'],0);
  assert.match(s.propertiesGrid.innerHTML,/NOT SAVED/);
  assert.doesNotMatch(s.propertiesGrid.innerHTML,/SAVED ON EP/);
  assert.match(s.errors[0],/did not confirm.*sound.pitch/);
});

test('a finite nonblank numeric string readback still confirms the matching library pitch',async()=>{
  const s=setup();s.open();s.nextReadPatch({'sound.pitch':'1'});
  s.controller.change(s.slot(),'sound.pitch',1);await s.flush();
  assert.match(s.propertiesGrid.innerHTML,/SAVED ON EP/);assert.deepEqual(s.errors,[]);
});

for(const [key,value]of [['sound.playmode','key'],['time.mode','bpm']])
test('an array cannot confirm the scalar '+key+' library setting',async()=>{
  const s=setup();s.open();s.nextReadPatch({[key]:[value]});
  s.controller.change(s.slot(),key,1);await s.flush(key);
  assert.match(s.propertiesGrid.innerHTML,/NOT SAVED/);
  assert.match(s.errors[0],/did not confirm/);
});

for(const reset of [false,true])test('queued recovery GET cannot cross a reconnect'+(reset?' with reset':''),async()=>{
  const s=setup();s.reject('Device refused metadata update');const gate=s.holdAfterRejectedSet();
  s.controller.change(s.slot(),'sound.pitch',1);const writing=s.flush();await gate.entered.promise;
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(s.scheduler.getState().pending,1,'recovery must be queued behind the other FILE operation');
  if(reset)s.controller.reset();s.disconnect();s.reconnect();
  s.sampleStore.setMetadata(7,{...s.original,'sound.pitch':9});
  gate.release.resolve();await writing;
  assert.deepEqual(s.reads,[]);
  assert.equal(s.slot().meta['sound.pitch'],9);assert.equal(s.controller.hasPendingWrites(),false);
});

test('saving time mode does not conceal a previous unconfirmed pitch',async()=>{
  const s=setup();s.ignore(true);s.controller.change(s.slot(),'sound.pitch',1);await s.flush();
  s.ignore(false);s.controller.change(s.slot(),'time.mode',1);await s.flush('time.mode');
  s.controller.render(s.slot());assert.match(s.propertiesGrid.innerHTML,/NOT SAVED.*sound.pitch/);
  assert.equal(s.slot().meta['time.mode'],'bpm');assert.equal(s.slot().meta['sound.pitch'],0);
});

test('playmode keeps the library release companion and unknown metadata intact',async()=>{
  const s=setup();
  s.controller.change(s.slot(),'sound.playmode',1);await s.flush('sound.playmode');
  assert.deepEqual(s.writes[0].patch,{'sound.playmode':'key','envelope.release':44});
  assert.equal(s.slot().meta['envelope.release'],44);
  assert.equal(s.slot().meta.custom,'preserve');
});

test('playmode takes its release companion from current metadata after acquiring the FILE lease',async()=>{
  const s=setup(),gate=s.deferLease();s.controller.change(s.slot(),'sound.playmode',1);
  const writing=s.flush('sound.playmode');await gate.entered.promise;
  s.replaceMetadata({'envelope.release':90});gate.release.resolve();await writing;
  assert.deepEqual(s.writes[0].patch,{'sound.playmode':'key','envelope.release':90});
  assert.equal(s.slot().meta['envelope.release'],90);
});

test('a semitone library pitch change preserves a verified fractional component',async()=>{
  const s=setup();s.replaceMetadata({'sound.pitch':0.25});
  s.controller.change(s.slot(),'sound.pitch',1);await s.flush();
  assert.equal(s.writes[0].patch['sound.pitch'],1.25);
  assert.equal(s.slot().meta['sound.pitch'],1.25);
});

for(const copy of [false,true])test((copy?'COPY':'MOVE')+' remains blocked until library readback and resumes afterward',async()=>{
  const s=setup(),calls=[];s.profile.sampleTransfers=true;
  const transfer=createSampleTransferCoordinator({sampleStore:s.sampleStore,
    getActiveDeviceProfile:()=>s.profile,isConnected:()=>true,isSynchronized:()=>true,getSoundsParentId:()=>1000,
    hasPendingPropertyWrites:s.controller.hasPendingWrites,
    moveTransfer:async()=>{calls.push('move');return{targetIds:[20]};},
    copyTransfer:async()=>{calls.push('copy');return{targetIds:[20]};}
  });
  s.controller.change(s.slot(),'sound.pitch',1);
  await assert.rejects(()=>transfer.transfer([s.slot()],{id:20},{copy,draggedId:7}),/pending sample property write/);
  assert.deepEqual(calls,[]);await s.flush();
  assert.deepEqual(await transfer.transfer([s.slot()],{id:20},{copy,draggedId:7}),{targetIds:[20]});
  assert.deepEqual(calls,[copy?'copy':'move']);
});

for(const transition of ['changeSession','disconnect'])test(transition+' before debounce prevents any SET or cross-session recovery GET',async()=>{
  const s=setup();s.controller.change(s.slot(),'sound.pitch',1);s[transition]();await s.flush();
  assert.deepEqual(s.writes,[]);assert.deepEqual(s.reads,[]);
  assert.equal(s.slot().meta['sound.pitch'],0);assert.equal(s.controller.hasPendingWrites(),false);
});

test('a reconnect while waiting for the FILE lease cannot dispatch an old SET',async()=>{
  const s=setup(),gate=s.deferLease();s.controller.change(s.slot(),'sound.pitch',1);
  const writing=s.flush();await gate.entered.promise;s.disconnect();s.reconnect();gate.release.resolve();await writing;
  assert.deepEqual(s.writes,[]);assert.deepEqual(s.reads,[]);
});

test('reset cancels a waiting FILE callback even when its device session token is unchanged',async()=>{
  const s=setup(),gate=s.deferLease();s.controller.change(s.slot(),'sound.pitch',1);
  const writing=s.flush();await gate.entered.promise;s.controller.reset();gate.release.resolve();await writing;
  assert.deepEqual(s.writes,[]);assert.deepEqual(s.reads,[]);
  assert.equal(s.controller.hasPendingWrites(),false);
});

test('a stale readback after reset cannot overwrite a new library snapshot at the same slot',async()=>{
  const s=setup(),gate=s.deferRead();s.controller.change(s.slot(),'sound.pitch',1);
  const writing=s.flush();await gate.entered.promise;
  s.controller.reset();s.changeSession();s.sampleStore.setMetadata(7,{...s.original,'sound.pitch':9});
  gate.release.resolve();await writing;
  assert.equal(s.slot().meta['sound.pitch'],9);assert.equal(s.controller.hasPendingWrites(),false);
  assert.deepEqual(s.errors,[]);
});

test('session change during GET rejects the old readback and never reads the replacement device',async()=>{
  const s=setup(),gate=s.deferRead();s.controller.change(s.slot(),'sound.pitch',1);
  const writing=s.flush();await gate.entered.promise;s.changeSession();gate.release.resolve();await writing;
  assert.equal(s.slot().meta['sound.pitch'],0);
  assert.deepEqual(s.reads,[{id:7,session:'first'}]);
  assert.match(s.errors[0],/session changed/);
});

test('a session failure without a UI reset never restores old values over a replacement snapshot',async()=>{
  const s=setup(),gate=s.deferRead();s.controller.change(s.slot(),'sound.pitch',1);
  const writing=s.flush();await gate.entered.promise;s.changeSession();
  s.sampleStore.setMetadata(7,{...s.original,'sound.pitch':9});
  gate.release.resolve();await writing;
  assert.equal(s.slot().meta['sound.pitch'],9);
  assert.equal(s.slot().verification.metadata,'verified');
});

for(const action of ['close','reset'])test(action+' removes the active BPM gesture listeners',()=>{
  const s=setup();s.open();
  s.gridHandlers.get('pointerdown')({target:{closest:()=>({})},clientY:100,preventDefault(){}});
  assert.equal(typeof s.documentHandlers.get('pointermove'),'function');s.controller[action]();
  for(const type of ['pointermove','pointerup','pointercancel'])assert.equal(s.documentHandlers.has(type),false);
});

test('closing properties preserves a chosen edit, while reset cancels queued edits',async()=>{
  const s=setup();s.open();s.controller.change(s.slot(),'sound.pitch',1);s.controller.close();await s.flush();
  assert.equal(s.slot().meta['sound.pitch'],1);assert.equal(s.properties.hidden,true);
  s.controller.change(s.slot(),'sound.pitch',1);s.controller.reset();await s.flush();
  assert.equal(s.writes.length,1);assert.equal(s.controller.hasPendingWrites(),false);
});

for(const missing of ['transaction','sessions'])test('missing '+missing+' service fails closed rather than using a standalone SET',async()=>{
  const s=setup({[missing]:false});s.controller.change(s.slot(),'sound.pitch',1);await s.flush();
  assert.deepEqual(s.writes,[]);assert.equal(s.slot().meta['sound.pitch'],0);
  assert.equal(s.controller.hasPendingWrites(),false);
});

test('revoked metadata permission while waiting for the lease prevents SET',async()=>{
  const s=setup(),gate=s.deferLease();s.controller.change(s.slot(),'sound.pitch',1);
  const writing=s.flush();await gate.entered.promise;s.profile.advancedSampleMetadataWrites=false;
  gate.release.resolve();await writing;assert.deepEqual(s.writes,[]);
});

test('library properties expose library scope and no assigned-pad action',()=>{
  const s=setup();s.open();
  assert.match(s.propertiesGrid.innerHTML,/SAMPLE LIBRARY/);
  assert.match(s.propertiesGrid.innerHTML,/ASSIGNED PADS KEEP THEIR OWN SETTINGS/);
  assert.doesNotMatch(s.propertiesGrid.innerHTML,/data-edit-assigned-pad/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import{createSamplePropertiesController}from '../js/ep133/ui/samplePropertiesController.js';
import{createSampleStore}from '../js/ep133/sampleStore.js';

const setup=()=>{
  const sampleStore=createSampleStore();
  sampleStore.replaceFiles([{nodeId:7,fileName:'/sounds/7 kick',fileSize:64,isWritable:true}]);
  const original={'sound.pitch':0,'sound.playmode':'oneshot','time.mode':'off','envelope.release':255};
  sampleStore.setMetadata(7,original);
  let deviceMeta={...original},ignoreWrite=false,session='first';
  const writes=[],errors=[];
  const gridHandlers=new Map(),documentHandlers=new Map(),body={};
  const propertiesGrid={innerHTML:'',addEventListener:(type,handler)=>gridHandlers.set(type,handler)};
  const properties={hidden:true,parentElement:body,style:{},getBoundingClientRect:()=>({width:220,height:150})};
  const controller=createSamplePropertiesController({
    sampleStore,propertiesGrid,properties,
    documentRef:{body,addEventListener:(type,handler)=>documentHandlers.set(type,handler),removeEventListener:(type,handler)=>{if(documentHandlers.get(type)===handler)documentHandlers.delete(type);}},
    windowRef:{innerWidth:1280,innerHeight:800},
    getActiveDeviceProfile:()=>({advancedSampleMetadataWrites:true,playModes:['oneshot','key','legato']}),
    isConnected:()=>true,isSynchronized:()=>true,isMetadataHydrating:()=>false,isMutating:()=>false,
    setTimeoutFn:()=>1,clearTimeoutFn:()=>{},
    captureBatchSession:()=>session,
    assertBatchSession:token=>{if(token!==session)throw new Error('Device session changed.');},
    setFileMetadata:async(id,patch)=>{writes.push({id,patch});if(!ignoreWrite)deviceMeta={...deviceMeta,...patch};},
    getFileMetadata:async()=>({...deviceMeta}),showError:message=>errors.push(message)
  });
  return{controller,sampleStore,writes,errors,propertiesGrid,gridHandlers,documentHandlers,
    ignoreWrite:()=>{ignoreWrite=true;},changeSession:()=>{session='second';},
    allowWrite:()=>{ignoreWrite=false;},
    slot:()=>sampleStore.getSlot(7)};
};

test('property edits commit to the canonical sample only after device readback',async()=>{
  const s=setup();
  s.controller.change(s.slot(),'sound.pitch',1);
  assert.equal(s.slot().meta['sound.pitch'],0,'pending UI intent must not overwrite device-confirmed state');
  assert.equal(s.controller.hasPendingWrites(),true);
  await s.controller.flushPropertyWrite('7:sound.pitch');
  assert.equal(s.slot().meta['sound.pitch'],1);
  assert.equal(s.slot().verification.metadata,'verified');
  assert.deepEqual(s.writes,[{id:7,patch:{'sound.pitch':1}}]);
  assert.equal(s.controller.hasPendingWrites(),false);
});

test('rapid property edits accumulate without committing unsent values',async()=>{
  const s=setup();
  s.controller.change(s.slot(),'sound.pitch',1);
  s.controller.change(s.slot(),'sound.pitch',1);
  s.controller.change(s.slot(),'sound.pitch',1);
  assert.equal(s.slot().meta['sound.pitch'],0);
  await s.controller.flushPropertyWrite('7:sound.pitch');
  assert.equal(s.slot().meta['sound.pitch'],3);
  assert.equal(s.writes.length,1);
});

test('an acknowledged but ignored property write retains device state and reports the reason',async()=>{
  const s=setup();s.ignoreWrite();
  s.controller.change(s.slot(),'sound.pitch',1);
  await s.controller.flushPropertyWrite('7:sound.pitch');
  assert.equal(s.slot().meta['sound.pitch'],0);
  assert.equal(s.controller.hasPendingWrites(),false);
  assert.match(s.errors[0],/EP did not confirm sample property sound.pitch/);
});

test('a queued property edit cannot be sent to a reconnected device',async()=>{
  const s=setup();
  s.controller.change(s.slot(),'sound.pitch',1);s.changeSession();
  await s.controller.flushPropertyWrite('7:sound.pitch');
  assert.deepEqual(s.writes,[]);
  assert.equal(s.slot().meta['sound.pitch'],0);
  assert.equal(s.controller.hasPendingWrites(),false);
});

test('reset cancels queued edits without changing confirmed sample metadata',async()=>{
  const s=setup();
  s.controller.change(s.slot(),'sound.pitch',1);
  s.controller.reset();
  await s.controller.flushPropertyWrite('7:sound.pitch');
  assert.deepEqual(s.writes,[]);
  assert.equal(s.slot().meta['sound.pitch'],0);
  assert.equal(s.controller.hasPendingWrites(),false);
});

test('saving another property does not hide an unconfirmed property failure',async()=>{
  const s=setup();s.ignoreWrite();
  s.controller.change(s.slot(),'sound.pitch',1);
  await s.controller.flushPropertyWrite('7:sound.pitch');
  s.allowWrite();
  s.controller.change(s.slot(),'time.mode',1);
  await s.controller.flushPropertyWrite('7:time.mode');
  s.controller.render(s.slot());
  assert.match(s.propertiesGrid.innerHTML,/NOT SAVED.*sound.pitch/);
  assert.equal(s.slot().meta['sound.pitch'],0);
  assert.equal(s.slot().meta['time.mode'],'bpm');
});

for(const action of ['close','reset']){
  test(`${action} stops a BPM drag so it cannot edit a reconnected device`,()=>{
    const s=setup();
    s.controller.open(s.slot(),{clientX:100,clientY:100});
    s.gridHandlers.get('pointerdown')({target:{closest:()=>({})},clientY:100,preventDefault(){}});
    assert.equal(typeof s.documentHandlers.get('pointermove'),'function');
    s.controller[action]();
    assert.equal(s.documentHandlers.has('pointermove'),false);
    assert.equal(s.documentHandlers.has('pointerup'),false);
    assert.equal(s.documentHandlers.has('pointercancel'),false);
  });
}

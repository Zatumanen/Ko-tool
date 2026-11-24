import test from 'node:test';
import assert from 'node:assert/strict';
import{createFakeEpMidi,importFilesystemPair,waitFor}from './helpers/fake-ep-midi.mjs';
import{TE_SYSEX_GREET,TE_SYSEX_FILE,TE_SYSEX_FILE_INIT}from '../js/ep133/constants.js';

test('FILE admission and preflight stay bound to the verified device session',async t=>{
  const fake=createFakeEpMidi({onRequest:request=>request.rawData[0]===TE_SYSEX_FILE_INIT
    ?{payload:Uint8Array.of(0,0,0,2,0)}:{}});
  fake.install();
  const{device,filesystem}=await importFilesystemPair();
  let releaseLock;
  navigator.locks={request(_name,_options,operation){
    return new Promise((resolve,reject)=>{
      releaseLock=()=>{releaseLock=null;Promise.resolve().then(operation).then(resolve,reject);};
    });
  }};
  const fileCount=()=>fake.requests.filter(r=>r.command===TE_SYSEX_FILE).length;
  try{
    await t.test('an intent submitted during GREET cannot enter the browser lock queue',async()=>{
      const before=fileCount();
      let pending;
      const unsubscribe=device.onMidiActivity(event=>{
        if(event.direction==='tx'&&event.command===TE_SYSEX_GREET){
          pending=filesystem.deleteFile(7).catch(error=>error);
        }
      });
      try{await device.connectEp133();}finally{unsubscribe();}
      assert.ok(pending);
      releaseLock?.();
      assert.match((await pending)?.message||'',/not connected/);
      assert.equal(fileCount(),before);
    });

    await t.test('a mutation waiting for the browser lock cannot use a reconnected epoch',async()=>{
      const before=fileCount();
      const pending=filesystem.deleteFile(8).catch(error=>error);
      await waitFor(()=>!!releaseLock);
      device.disconnectEp133();
      await device.connectEp133();
      releaseLock();
      assert.match((await pending)?.message||'',/stale connection epoch/);
      assert.equal(fileCount(),before);
    });

    await t.test('a passive preflight cannot complete on a replacement session',async()=>{
      const before=fileCount();
      const preflight=device.passiveFirmwareDebugPreflight(25).catch(error=>error);
      device.disconnectEp133();
      await device.connectEp133();
      assert.match((await preflight)?.message||'',/connection changed during FILE preflight/);
      assert.equal(fileCount(),before);
    });
  }finally{
    releaseLock?.();
    device.disconnectEp133();
    fake.restore();
  }
});

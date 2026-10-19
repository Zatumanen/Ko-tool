import test from 'node:test';
import assert from 'node:assert/strict';
import {createFakeEpMidi,importFilesystemPair} from './helpers/fake-ep-midi.mjs';
import {dispatchDeviceRuntimeEvent,getDeviceRuntimeSnapshot} from '../js/ep133/deviceRuntime.js';
import {TE_SYSEX_FILE,TE_SYSEX_FILE_INIT,TE_SYSEX_FILE_METADATA} from '../js/ep133/constants.js';

test('real recovery transport lease permits GET while omitting every mutation method',async()=>{
  const fake=createFakeEpMidi({onRequest:request=>{
    if(request.command!==TE_SYSEX_FILE)return{};
    if(request.rawData[0]===TE_SYSEX_FILE_INIT)return{payload:Uint8Array.from([0,0,0,4,0])};
    if(request.rawData[0]===TE_SYSEX_FILE_METADATA)return{payload:Uint8Array.from([0,0,...new TextEncoder().encode('{"sym":7}'),0])};
    return{};
  }});
  fake.install();const{device,filesystem,token}=await importFilesystemPair();
  const{withFileTransportTransaction:transaction}=await import('../js/ep133/fileTransport.js?v='+token);
  filesystem.resetFileSystemState();
  try{
    await device.connectEp133();
    const epoch=getDeviceRuntimeSnapshot().connection.epoch;
    dispatchDeviceRuntimeEvent({type:'RECOVERY_REQUIRED',connectionEpoch:epoch,transactionId:'pad-transport',source:'pad'});
    await assert.rejects(()=>transaction('ordinary read',()=>{}),error=>error.code==='EP_DEVICE_RUNTIME_OPERATION_BLOCKED');
    await assert.rejects(()=>transaction('ordinary write',()=>{},{strict:true}),error=>error.code==='EP_DEVICE_RUNTIME_OPERATION_BLOCKED');
    assert.throws(()=>transaction('conflicting modes',()=>{},{strict:true,recoveryRead:true}),/recovery.*strict|strict.*recovery/i);
    const metadata=await transaction('pad recovery read',async lease=>{
      assert.equal(Object.isFrozen(lease),true);
      for(const method of ['setFileMetadata','putFile','deleteFile','moveFile'])assert.equal(method in lease,false);
      assert.equal(getDeviceRuntimeSnapshot().operation.active.mode,'recovery-read');
      return lease.getFileMetadata(6107);
    },{recoveryRead:true});
    assert.deepEqual(metadata,{sym:7});
    assert.equal(getDeviceRuntimeSnapshot().recovery.transaction.id,'pad-transport');
    dispatchDeviceRuntimeEvent({type:'DEVICE_MARKED_UNSAFE',connectionEpoch:epoch,reason:'test unsafe'});
    await assert.rejects(()=>transaction('unsafe recovery',()=>{},{recoveryRead:true}),/blocked|safety/i);
  }finally{device.disconnectEp133();fake.restore();}
});

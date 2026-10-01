import test from 'node:test';
import assert from 'node:assert/strict';
import{createFakeEpMidi,importFilesystemPair,waitFor}from './helpers/fake-ep-midi.mjs';
import{TE_SYSEX_FILE}from '../js/ep133/constants.js';

test('active FILE operation fails closed when an unmatched FILE response indicates external interference',async()=>{
  let holdFileTraffic=false;
  const fake=createFakeEpMidi({
    onRequest:request=>{
      if(request.command!==TE_SYSEX_FILE)return{};
      if(holdFileTraffic)return new Promise(()=>{});
      return{};
    }
  });
  fake.install();
  const{device,filesystem}=await importFilesystemPair();
  filesystem.resetFileSystemState();
  await device.connectEp133();

  holdFileTraffic=true;
  const before=fake.requests.filter(request=>request.command===TE_SYSEX_FILE).length;
  const operation=filesystem.getFileInfo(7);
  await waitFor(()=>fake.requests.filter(request=>request.command===TE_SYSEX_FILE).length===before+1);

  fake.emitResponse({requestId:0x6aa,command:TE_SYSEX_FILE,payload:new Uint8Array()});

  await assert.rejects(operation,/FILE safety lock is active/);
  assert.equal(device.isDeviceUnsafe(),true);
  const state=filesystem.getFileOperationCoordinatorState();
  assert.equal(state.state,'unsafe');
  assert.equal(state.externalInterference?.requestId,0x6aa);
  assert.match(state.externalInterference?.reason||'',/Another EP tool/);

  device.disconnectEp133();
  fake.restore();
});

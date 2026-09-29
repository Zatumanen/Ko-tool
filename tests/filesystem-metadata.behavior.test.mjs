import test from 'node:test';
import assert from 'node:assert/strict';
import{createFakeEpMidi,importFilesystemPair}from './helpers/fake-ep-midi.mjs';
import{TE_SYSEX_FILE}from '../js/ep133/constants.js';

test('sample upload rejects unsafe playmode metadata before sending any FILE mutation',async()=>{
  const fake=createFakeEpMidi();
  fake.install();
  const{device,filesystem}=await importFilesystemPair();
  filesystem.resetFileSystemState();
  await device.connectEp133();

  const before=fake.requests.filter(request=>request.command===TE_SYSEX_FILE).length;
  await assert.rejects(
    filesystem.uploadSampleToSlot({
      data:Uint8Array.from([1,2,3,4]),
      filename:'preflight.wav',
      parentId:1000,
      destinationId:7,
      metadata:{
        name:'preflight',
        channels:1,
        samplerate:46875,
        format:'s16',
        'sound.playmode':'key'
      },
      allowedPlayModes:['oneshot','key','legato']
    }),
    /requires 'envelope.release'/
  );
  assert.equal(
    fake.requests.filter(request=>request.command===TE_SYSEX_FILE).length,
    before
  );
  assert.equal(device.isDeviceUnsafe(),false);

  device.disconnectEp133();
  fake.restore();
});

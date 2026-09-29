import test from 'node:test';
import assert from 'node:assert/strict';
import{createFakeEpMidi,importFilesystemPair}from './helpers/fake-ep-midi.mjs';
import{
  TE_SYSEX_FILE,
  TE_SYSEX_FILE_INIT,
  TE_SYSEX_FILE_GET,
  TE_SYSEX_FILE_GET_TYPE_INIT,
  TE_SYSEX_FILE_GET_TYPE_DATA,
  TE_SYSEX_FILE_CAPABILITY_READ
}from '../js/ep133/constants.js';

const u16=(data,offset)=>(data[offset]<<8)|data[offset+1];
const initResponse=chunkSize=>{
  const data=new Uint8Array(5);
  new DataView(data.buffer).setUint32(1,chunkSize);
  return data;
};

test('filesystem marks the device unsafe when FILE_GET opens but cannot complete the declared byte count',async()=>{
  const fileData=Uint8Array.from([10,20,30,40]);
  const fake=createFakeEpMidi({
    onRequest:request=>{
      if(request.command!==TE_SYSEX_FILE)return{};
      const raw=request.rawData;
      const subcommand=raw[0];

      if(subcommand===TE_SYSEX_FILE_INIT){
        return{payload:initResponse(48)};
      }

      if(subcommand===TE_SYSEX_FILE_GET&&raw[1]===TE_SYSEX_FILE_GET_TYPE_INIT){
        const nodeId=u16(raw,2);
        const name=new TextEncoder().encode('broken-read');
        const payload=new Uint8Array(8+name.length);
        const view=new DataView(payload.buffer);
        view.setUint16(0,nodeId);
        payload[2]=TE_SYSEX_FILE_CAPABILITY_READ;
        view.setUint32(3,fileData.length);
        payload.set(name,7);
        payload[7+name.length]=0;
        return{payload};
      }

      if(subcommand===TE_SYSEX_FILE_GET&&raw[1]===TE_SYSEX_FILE_GET_TYPE_DATA){
        const page=u16(raw,2);
        const payload=new Uint8Array(2);
        new DataView(payload.buffer).setUint16(0,page);
        return{payload};
      }

      return{};
    }
  });

  fake.install();
  const{device,filesystem}=await importFilesystemPair();
  filesystem.resetFileSystemState();
  await device.connectEp133();

  await assert.rejects(
    filesystem.getFile(7),
    /Empty FILE_GET response for page 0/
  );
  assert.equal(device.isDeviceUnsafe(),true);

  await assert.rejects(
    filesystem.getFile(7),
    /FILE safety lock is active/
  );

  device.disconnectEp133();
  fake.restore();
});

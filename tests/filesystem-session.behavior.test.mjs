import test from 'node:test';
import assert from 'node:assert/strict';
import{createFakeEpMidi,importFilesystemPair}from './helpers/fake-ep-midi.mjs';
import{
  TE_SYSEX_FILE,TE_SYSEX_FILE_INIT,TE_SYSEX_FILE_METADATA,TE_SYSEX_FILE_METADATA_GET,TE_SYSEX_FILE_INFO
}from '../js/ep133/constants.js';

const initResponse=chunkSize=>{
  const data=new Uint8Array(5);
  new DataView(data.buffer).setUint32(1,chunkSize);
  return data;
};
const metadataResponse=(page,value)=>{
  const json=new TextEncoder().encode(JSON.stringify(value));
  const data=new Uint8Array(3+json.length);
  const view=new DataView(data.buffer);
  view.setUint16(0,page);
  data.set(json,2);
  data[data.length-1]=0;
  return data;
};
const infoResponse=(nodeId,parentId,name)=>{
  const text=new TextEncoder().encode(name);
  const data=new Uint8Array(10+text.length);
  const view=new DataView(data.buffer);
  view.setUint16(0,nodeId);
  view.setUint16(2,parentId);
  data[4]=0x05;
  view.setUint32(5,123);
  data.set(text,9);
  data[data.length-1]=0;
  return data;
};

test('standalone FILE operations initialize once per connected device session',async()=>{
  const fake=createFakeEpMidi({
    onRequest:request=>{
      if(request.command!==TE_SYSEX_FILE)return{};
      const raw=request.rawData;
      if(raw[0]===TE_SYSEX_FILE_INIT)return{payload:initResponse(512)};
      if(raw[0]===TE_SYSEX_FILE_METADATA&&raw[1]===TE_SYSEX_FILE_METADATA_GET)
        return{payload:metadataResponse((raw[4]<<8)|raw[5],{name:'kick'})};
      if(raw[0]===TE_SYSEX_FILE_INFO)return{payload:infoResponse((raw[1]<<8)|raw[2],1000,'kick')};
      return{};
    }
  });
  fake.install();
  const{device,filesystem}=await importFilesystemPair();
  filesystem.resetFileSystemState();
  await device.connectEp133();

  const before=fake.requests.filter(request=>request.command===TE_SYSEX_FILE).length;
  assert.deepEqual(await filesystem.getFileMetadata(7),{name:'kick'});
  let fileRequests=fake.requests.filter(request=>request.command===TE_SYSEX_FILE).slice(before);
  assert.deepEqual(fileRequests.map(request=>request.rawData[0]),[TE_SYSEX_FILE_INIT,TE_SYSEX_FILE_METADATA]);

  assert.equal((await filesystem.getFileInfo(7)).nodeId,7);
  fileRequests=fake.requests.filter(request=>request.command===TE_SYSEX_FILE).slice(before);
  assert.deepEqual(fileRequests.map(request=>request.rawData[0]),[TE_SYSEX_FILE_INIT,TE_SYSEX_FILE_METADATA,TE_SYSEX_FILE_INFO]);

  fake.disconnect();
  fake.reconnect();
  await device.connectEp133();

  const reconnectStart=fake.requests.filter(request=>request.command===TE_SYSEX_FILE).length;
  assert.equal((await filesystem.getFileInfo(8)).nodeId,8);
  fileRequests=fake.requests.filter(request=>request.command===TE_SYSEX_FILE).slice(reconnectStart);
  assert.deepEqual(fileRequests.map(request=>request.rawData[0]),[TE_SYSEX_FILE_INIT,TE_SYSEX_FILE_INFO]);

  device.disconnectEp133();
  fake.restore();
});

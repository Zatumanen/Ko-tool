import test from 'node:test';
import assert from 'node:assert/strict';
import{createFakeEpMidi,importFilesystemPair,waitFor}from './helpers/fake-ep-midi.mjs';
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
const deferred=()=>{
  let resolve;
  const promise=new Promise(res=>{resolve=res;});
  return{promise,resolve};
};

test('FILE transaction lease keeps ordinary FILE work queued until the whole compound operation finishes',async()=>{
  const fake=createFakeEpMidi({
    onRequest:request=>{
      if(request.command!==TE_SYSEX_FILE)return{};
      const raw=request.rawData;
      if(raw[0]===TE_SYSEX_FILE_INIT)return{payload:initResponse(512)};
      if(raw[0]===TE_SYSEX_FILE_METADATA&&raw[1]===TE_SYSEX_FILE_METADATA_GET)
        return{payload:metadataResponse((raw[4]<<8)|raw[5],{name:'kick'})};
      if(raw[0]===TE_SYSEX_FILE_INFO)
        return{payload:infoResponse((raw[1]<<8)|raw[2],1000,'slot'+((raw[1]<<8)|raw[2]))};
      return{};
    }
  });
  fake.install();
  const{device,filesystem}=await importFilesystemPair();
  filesystem.resetFileSystemState();
  await device.connectEp133();

  const gate=deferred();
  const actions=[];
  const before=fake.requests.filter(request=>request.command===TE_SYSEX_FILE).length;

  const transaction=filesystem.withFileTransaction('compound read',async tx=>{
    actions.push('tx:start');
    assert.deepEqual(await tx.getFileMetadata(7),{name:'kick'});
    actions.push('tx:metadata');
    await gate.promise;
    assert.equal((await tx.getFileInfo(7)).nodeId,7);
    actions.push('tx:info');
  });

  await waitFor(()=>actions.includes('tx:metadata'));
  const outside=filesystem.getFileInfo(8).then(info=>{
    actions.push('outside:info');
    return info;
  });

  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(actions.includes('outside:info'),false);
  assert.equal(
    fake.requests.some(request=>
      request.command===TE_SYSEX_FILE&&
      request.rawData[0]===TE_SYSEX_FILE_INFO&&
      ((request.rawData[1]<<8)|request.rawData[2])===8
    ),
    false
  );

  gate.resolve();
  await transaction;
  assert.equal((await outside).nodeId,8);
  assert.deepEqual(actions,['tx:start','tx:metadata','tx:info','outside:info']);

  const fileRequests=fake.requests.filter(request=>request.command===TE_SYSEX_FILE).slice(before);
  assert.deepEqual(fileRequests.map(request=>request.rawData[0]),[
    TE_SYSEX_FILE_INIT,
    TE_SYSEX_FILE_METADATA,
    TE_SYSEX_FILE_INFO,
    TE_SYSEX_FILE_INFO
  ]);

  device.disconnectEp133();
  fake.restore();
});

test('FILE transaction lease cannot be reused after its callback completes',async()=>{
  const fake=createFakeEpMidi({
    onRequest:request=>{
      if(request.command!==TE_SYSEX_FILE)return{};
      const raw=request.rawData;
      if(raw[0]===TE_SYSEX_FILE_INIT)return{payload:initResponse(512)};
      if(raw[0]===TE_SYSEX_FILE_INFO)
        return{payload:infoResponse((raw[1]<<8)|raw[2],1000,'slot')};
      return{};
    }
  });
  fake.install();
  const{device,filesystem}=await importFilesystemPair();
  filesystem.resetFileSystemState();
  await device.connectEp133();

  let escapedLease=null;
  await filesystem.withFileTransaction('lease lifetime',async tx=>{
    escapedLease=tx;
    assert.equal((await tx.getFileInfo(7)).nodeId,7);
  });
  assert.throws(()=>escapedLease.getFileInfo(8),/lease is no longer active/);

  device.disconnectEp133();
  fake.restore();
});

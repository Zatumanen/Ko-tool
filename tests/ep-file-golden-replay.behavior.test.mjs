import test from 'node:test';
import assert from 'node:assert/strict';
import{loadGoldenFixture}from './helpers/ep-file-golden-fixtures.mjs';
import{createGoldenFileReplay}from './helpers/ep-file-golden-replay.mjs';
import{createFakeEpMidi,importFilesystemPair}from './helpers/fake-ep-midi.mjs';
import{encodeTeSysex,parseTeSysex}from '../js/ep133/sysex.js';
import{TE_SYSEX_FILE,TE_SYSEX_FILE_DELETE}from '../js/ep133/constants.js';
import{buildFileDeletePayload}from '../js/ep133/fileProtocol.js';

const root=new URL('./fixtures/ep-series/file-traces/v1/real/',import.meta.url);
const initResponse=chunkSize=>Uint8Array.from([
  0,
  (chunkSize>>>24)&255,(chunkSize>>>16)&255,(chunkSize>>>8)&255,chunkSize&255
]);

test('golden replay extracts correlated FILE pairs and reports unconsumed requests',async()=>{
  const fixture=await loadGoldenFixture(new URL('ep133-official-delete-001.json',root),{requireReal:true});
  const replay=createGoldenFileReplay(fixture);
  assert.equal(replay.remaining(),1);
  assert.throws(()=>replay.assertComplete(),/count|unconsumed|expected/i);

  const live=parseTeSysex(encodeTeSysex(
    TE_SYSEX_FILE,
    buildFileDeletePayload(467),
    0x33,
    0x123
  ).bytes);
  const descriptor=await replay.onRequest(live);
  assert.equal(descriptor.status,0);
  assert.deepEqual([...descriptor.payload],[]);
  assert.equal(descriptor.delay,85);
  assert.equal(replay.remaining(),0);
  replay.assertComplete();

  const broken=structuredClone(fixture);
  const ack=Uint8Array.from(Buffer.from(broken.frames[2].hex,'hex'));
  ack[7]=(ack[7]+1)&0x7f;
  broken.frames[2].hex=Buffer.from(ack).toString('hex').toUpperCase();
  assert.throws(()=>createGoldenFileReplay(broken),/correlation|response|request/i);
});

test('real INIT/LIST golden trace replays through production listDirectory',async()=>{
  const fixture=await loadGoldenFixture(new URL('ep133-official-init-list-001.json',root),{requireReal:true});
  const replay=createGoldenFileReplay(fixture);
  const fake=createFakeEpMidi({sku:'TE032AS001',osVersion:'2.0.5',onRequest:replay.onRequest});
  fake.install();
  const{device,filesystem}=await importFilesystemPair();
  filesystem.resetFileSystemState();
  try{
    await device.connectEp133();
    const entries=await filesystem.listDirectory(0,'/');
    assert.deepEqual(entries.map(entry=>entry.fileName),['/sounds','/projects']);
    replay.assertComplete();
    assert.equal(device.isDeviceUnsafe(),false);
  }finally{
    device.disconnectEp133();
    fake.restore();
  }
});

test('real DELETE golden trace replays through production deleteFile inside synthetic session init',async()=>{
  const fixture=await loadGoldenFixture(new URL('ep133-official-delete-001.json',root),{requireReal:true});
  const replay=createGoldenFileReplay(fixture);
  const observed=[];
  const fake=createFakeEpMidi({
    sku:'TE032AS001',
    osVersion:'2.0.5',
    onRequest:request=>{
      if(request.command===TE_SYSEX_FILE)observed.push([...request.rawData]);
      if(request.command===TE_SYSEX_FILE&&request.rawData[0]===TE_SYSEX_FILE_DELETE)return replay.onRequest(request);
      if(request.command===TE_SYSEX_FILE&&request.rawData[0]===1)return{status:0,payload:initResponse(512)};
      return{status:3,payload:new Uint8Array()};
    }
  });
  fake.install();
  const{device,filesystem}=await importFilesystemPair();
  filesystem.resetFileSystemState();
  try{
    await device.connectEp133();
    try{
      await filesystem.deleteFile(467,{timeout:200});
    }catch(error){
      throw new Error(String(error?.message||error)+' | observed='+JSON.stringify(observed)+' | replay='+JSON.stringify(replay.seen.map(item=>[...item])));
    }
    replay.assertComplete();
    assert.equal(device.isDeviceUnsafe(),false);
  }finally{
    device.disconnectEp133();
    fake.restore();
  }
});

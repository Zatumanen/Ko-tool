import test from 'node:test';
import assert from 'node:assert/strict';
import{createFakeEpMidi,importFilesystemPair}from './helpers/fake-ep-midi.mjs';
import{createFileTraceReplay}from './helpers/file-trace-replay.mjs';

const initResponse=chunkSize=>Uint8Array.from([
  0,
  (chunkSize>>>24)&255,(chunkSize>>>16)&255,(chunkSize>>>8)&255,chunkSize&255
]);

test('paged METADATA SET fails closed when a data page is interrupted before EOF',async()=>{
  const metadata={name:'abcdefghijklmnopqrstuvwxyz0123456789'};
  const jsonBytes=new TextEncoder().encode(JSON.stringify(metadata));
  const chunkSize=32;
  const pageSize=11;
  const replay=createFileTraceReplay([
    {label:'FILE_INIT',request:[1,1,0,64,0,0],response:initResponse(chunkSize)},
    {
      label:'paged metadata init',
      request:[
        7,4,0,0,9,
        (jsonBytes.length>>>24)&255,(jsonBytes.length>>>16)&255,(jsonBytes.length>>>8)&255,jsonBytes.length&255
      ],
      response:[]
    },
    {
      label:'paged metadata page 0',
      request:[7,4,1,0,0,...jsonBytes.slice(0,pageSize)],
      response:[]
    },
    {
      label:'paged metadata page 1 interrupted',
      request:[7,4,1,0,1,...jsonBytes.slice(pageSize,pageSize*2)],
      drop:true
    }
  ]);

  const fake=createFakeEpMidi({onRequest:replay.onRequest});
  fake.install();
  const{device,filesystem}=await importFilesystemPair();
  filesystem.resetFileSystemState();
  await device.connectEp133();

  await assert.rejects(
    filesystem.setFileMetadata(9,metadata,{timeout:25}),
    error=>error?.name==='EPSeriesTimeoutError'||/timeout/i.test(String(error?.message||error))
  );

  replay.assertComplete();
  assert.equal(device.isDeviceUnsafe(),true);
  await assert.rejects(
    filesystem.getFileMetadata(9),
    /FILE safety lock is active/
  );

  device.disconnectEp133();
  fake.restore();
});

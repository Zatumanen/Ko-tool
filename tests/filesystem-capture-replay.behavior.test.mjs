import test from 'node:test';
import assert from 'node:assert/strict';
import{createFakeEpMidi,importFilesystemPair}from './helpers/fake-ep-midi.mjs';
import{createFileTraceReplay}from './helpers/file-trace-replay.mjs';

const initResponse=chunkSize=>Uint8Array.from([
  0,
  (chunkSize>>>24)&255,(chunkSize>>>16)&255,(chunkSize>>>8)&255,chunkSize&255
]);
const getInitResponse=(nodeId,size,name,flags=4)=>{
  const text=new TextEncoder().encode(name);
  return Uint8Array.from([
    (nodeId>>8)&255,nodeId&255,flags,
    (size>>>24)&255,(size>>>16)&255,(size>>>8)&255,size&255,
    ...text,0
  ]);
};
const metadataPage=(page,text,{done=false}={})=>Uint8Array.from([
  (page>>8)&255,page&255,
  ...new TextEncoder().encode(text),
  ...(done?[0]:[])
]);
const infoResponse=(nodeId,parentId,size,name,flags=0x25)=>{
  const text=new TextEncoder().encode(name);
  return Uint8Array.from([
    (nodeId>>8)&255,nodeId&255,
    (parentId>>8)&255,parentId&255,
    flags,
    (size>>>24)&255,(size>>>16)&255,(size>>>8)&255,size&255,
    ...text,0
  ]);
};

test('FILE trace replay enforces exact GET length and paged METADATA GET requests',async()=>{
  const fileData=Uint8Array.from([1,2,3,4,5,6,7,8,9,10]);
  const metadataJson='{"name":"kick","crc":123}';
  const split=13;
  const replay=createFileTraceReplay([
    {label:'GET FILE_INIT',request:[1,1,0,64,0,0],response:initResponse(512)},
    {label:'GET open slot 7',request:[3,0,0,7,0,0,0,0],response:getInitResponse(7,fileData.length,'trace')},
    {label:'GET page 0',request:[3,1,0,0],response:Uint8Array.from([0,0,...fileData.slice(0,6)])},
    {label:'GET page 1',request:[3,1,0,1],response:Uint8Array.from([0,1,...fileData.slice(6)])},

    {label:'META FILE_INIT',request:[1,1,0,64,0,0],response:initResponse(512)},
    {label:'META page 0',request:[7,2,0,9,0,0],response:metadataPage(0,metadataJson.slice(0,split))},
    {label:'META page 1',request:[7,2,0,9,0,1],response:metadataPage(1,metadataJson.slice(split),{done:true})}
  ]);

  const fake=createFakeEpMidi({onRequest:replay.onRequest});
  fake.install();
  const{device,filesystem}=await importFilesystemPair();
  filesystem.resetFileSystemState();
  await device.connectEp133();

  const file=await filesystem.getFile(7);
  assert.equal(file.name,'trace');
  assert.equal(file.size,fileData.length);
  assert.deepEqual([...file.data],[...fileData]);

  filesystem.resetFileSystemState();
  assert.deepEqual(await filesystem.getFileMetadata(9),{name:'kick',crc:123});

  replay.assertComplete();
  assert.equal(device.isDeviceUnsafe(),false);
  device.disconnectEp133();
  fake.restore();
});

test('FILE trace replay pins the verified DELETE and native MOVE wire payloads',async()=>{
  const replay=createFileTraceReplay([
    {label:'DELETE FILE_INIT',request:[1,1,0,64,0,0],response:initResponse(512)},
    {label:'DELETE slot 7',request:[6,0,7],response:[]},
    {label:'DELETE re-init',request:[1,1,0,64,0,0],response:initResponse(512)},

    {label:'MOVE FILE_INIT',request:[1,1,0,64,0,0],response:initResponse(512)},
    {label:'MOVE 7 -> 8 under /sounds',request:[12,0,7,3,232,0,8],response:[0,7,3,232,0,8]},
    {label:'MOVE re-init',request:[1,1,0,64,0,0],response:initResponse(512)},
    {label:'MOVE destination STAT',request:[11,0,8],response:infoResponse(8,1000,10,'moved')}
  ]);

  const fake=createFakeEpMidi({onRequest:replay.onRequest});
  fake.install();
  const{device,filesystem}=await importFilesystemPair();
  filesystem.resetFileSystemState();
  await device.connectEp133();

  await filesystem.deleteFile(7,{timeout:200});

  filesystem.resetFileSystemState();
  const moved=await filesystem.moveFile(7,1000,8,{timeout:200});
  assert.equal(moved.oldFileId,7);
  assert.equal(moved.parentId,1000);
  assert.equal(moved.newFileId,8);
  assert.equal(moved.info.nodeId,8);
  assert.equal(moved.info.parentId,1000);

  replay.assertComplete();
  assert.equal(device.isDeviceUnsafe(),false);
  device.disconnectEp133();
  fake.restore();
});

test('FILE trace replay pins paged METADATA SET page order and empty EOF terminator',async()=>{
  const metadata={name:'abcdefghijklmnopqrstuvwxyz'};
  const jsonBytes=new TextEncoder().encode(JSON.stringify(metadata));
  const chunkSize=32;
  const metadataPageSize=11;
  const steps=[
    {label:'METADATA SET FILE_INIT',request:[1,1,0,64,0,0],response:initResponse(chunkSize)},
    {
      label:'METADATA SET paged init',
      request:[
        7,4,0,0,9,
        (jsonBytes.length>>>24)&255,(jsonBytes.length>>>16)&255,(jsonBytes.length>>>8)&255,jsonBytes.length&255
      ],
      response:[]
    }
  ];
  let page=0;
  for(let offset=0;offset<jsonBytes.length;offset+=metadataPageSize,page++){
    steps.push({
      label:'METADATA SET page '+page,
      request:[7,4,1,(page>>8)&255,page&255,...jsonBytes.slice(offset,offset+metadataPageSize)],
      response:[]
    });
  }
  steps.push({
    label:'METADATA SET EOF',
    request:[7,4,1,(page>>8)&255,page&255],
    response:[]
  });

  const replay=createFileTraceReplay(steps);
  const fake=createFakeEpMidi({onRequest:replay.onRequest});
  fake.install();
  const{device,filesystem}=await importFilesystemPair();
  filesystem.resetFileSystemState();
  await device.connectEp133();

  await filesystem.setFileMetadata(9,metadata,{timeout:200});

  replay.assertComplete();
  assert.equal(device.isDeviceUnsafe(),false);
  device.disconnectEp133();
  fake.restore();
});

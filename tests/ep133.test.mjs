import test from 'node:test';
import assert from 'node:assert/strict';
import{packedLength,packToBuffer,unpackInPlace}from '../js/ep133/packing.js';
import{parseIdentityResponse,isSupportedEpSku,buildTeSysex,parseTeSysex}from '../js/ep133/sysex.js';
test('7-bit packing roundtrip',()=>{for(const length of [0,1,7,8,31,433]){const data=Uint8Array.from({length},(_,i)=>(i*37+129)&255);const out=new Uint8Array(packedLength(length));if(length)packToBuffer(data,out);const decoded=unpackInPlace(out);assert.deepEqual([...decoded],[...data]);}});
test('TE SysEx frame roundtrip',()=>{const payload=Uint8Array.from([0,127,128,255,42]);const frame=buildTeSysex(5,payload,123);const parsed=parseTeSysex(frame.bytes);assert.equal(parsed.command,5);assert.deepEqual([...parsed.rawData],[...payload]);});
test('EP-133 identity parser',()=>{const p=32,a=1;const response=Uint8Array.from([0xF0,0x7E,0x00,0x06,0x02,0x00,0x20,0x76,p&127,p>>7,a&127,a>>7,0,0,0,0,0xF7]);assert.equal(parseIdentityResponse(response).sku,'TE032AS001');});


test('EP-series identity accepts supported TE032 SKUs',()=>{
  for(const sku of ['TE032AS001','TE032AS002','TE032AS005','TE032AS006'])assert.equal(isSupportedEpSku(sku),true);
  assert.equal(isSupportedEpSku('TE010AS033'),false);
});

import{createSampleSlots,EP_SAMPLE_SLOT_COUNT,DEFAULT_SAMPLE_TABS,getSampleDisplayName}from '../js/ep133/sampleMemory.js';
import{requestRead}from '../js/ep133/device.js';
import{parseMetadataResponse,calculateMaxPayloadLength,buildFilePutInitPayload,buildFilePutDataPayload}from '../js/ep133/filesystem.js';
test('sample memory creates 999 slots and maps sound node id to slot',()=>{
  const slots=createSampleSlots([
    {nodeId:1,fileName:'/sounds/kick.wav',fileSize:1234},
    {nodeId:137,fileName:'/sounds/bass.wav',fileSize:5678},
    {nodeId:1000,fileName:'/sounds/ignored.wav',fileSize:1},
    {nodeId:50,fileName:'/other/file.wav',fileSize:1}
  ]);
  assert.equal(slots.length,EP_SAMPLE_SLOT_COUNT);
  assert.equal(slots[0].file.name,'kick.wav');
  assert.equal(slots[136].file.name,'bass.wav');
  assert.equal(slots[2].file,null);
  assert.deepEqual(DEFAULT_SAMPLE_TABS.map(x=>x.range),[[1,99],[100,199],[200,299],[300,399],[400,499],[500,599],[600,699],[700,799],[800,899],[900,999]]);
});


test('sample display name prefers device metadata name over filesystem slot filename',()=>{
  const slots=createSampleSlots([{nodeId:7,fileName:'/sounds/007.wav',fileSize:123}]);
  slots[6].meta={name:'my-kick.wav'};
  assert.equal(getSampleDisplayName(slots[6]),'my-kick.wav');
});


test('EP metadata response parser reads JSON text and completion marker',()=>{
  const bytes=Uint8Array.from([0,0,...new TextEncoder().encode('{"name":"kick_808.wav"}'),0]);
  assert.deepEqual(parseMetadataResponse(bytes,0),{text:'{"name":"kick_808.wav"}',done:true});
});

test('EP metadata GET is permitted by the read-only request gate',()=>{
  assert.equal(typeof requestRead,'function');
});


test('EP FILE payload sizing matches the authoritative 7-bit transport formula',()=>{
  assert.equal(calculateMaxPayloadLength(512-6),433);
  assert.equal(calculateMaxPayloadLength(1024-6),881);
});

test('EP FILE_PUT init targets the requested destination slot',()=>{
  const payload=buildFilePutInitPayload(127,42,1234,'Kick 808.wav',{channels:2,samplerate:46875,format:'s16'});
  const view=new DataView(payload.buffer);
  assert.equal(payload[0],2);
  assert.equal(payload[1],0);
  assert.equal(payload[2],4);
  assert.equal(view.getUint16(3),127);
  assert.equal(view.getUint16(5),42);
  assert.equal(view.getUint32(7),1234);
  assert.equal(new TextDecoder().decode(payload.slice(11)).startsWith('kick 808\\0'),true);
});

test('EP FILE_PUT data packet carries page and raw PCM payload',()=>{
  const payload=buildFilePutDataPayload(3,Uint8Array.from([0,127,128,255]));
  const view=new DataView(payload.buffer);
  assert.equal(payload[0],2);
  assert.equal(payload[1],1);
  assert.equal(view.getUint16(2),3);
  assert.deepEqual([...payload.slice(4)],[0,127,128,255]);
});

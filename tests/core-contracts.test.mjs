import test from'node:test';
import assert from'node:assert/strict';
import{
  assertUnsigned,assertBinaryBytes,assertWireFid,assertSampleSlot,assertFileMetadata,
  assertDeviceIdentity,assertProjectTransactionStatus,assertSampleTransactionStatus,
  assertProjectRecoveryStatus
}from'../js/ep133/coreContracts.js';
import{parseIdentityResponse,parseTeSysex,encodeTeSysex}from'../js/ep133/sysex.js';
import{
  buildFileListPayload,buildFileInfoPayload,buildFileMovePayload,
  buildFileGetInitPayload,buildFileDeletePayload,buildFilePutInitPayload,
  buildMetadataSetPayload,parseFileListEntries,parseFileInfoResponse
}from'../js/ep133/fileProtocol.js';
import{decodeFileRights}from'../js/ep133/deviceCapabilities.js';
import{parseFileEvent}from'../js/ep133/device.js';

test('core contracts reject coercion, fractional FILE ids, overflow and non-Uint8Array',()=>{
  assert.equal(assertWireFid(65535),65535);
  assert.equal(assertWireFid(0,{allowRoot:true}),0);
  assert.equal(assertSampleSlot(999),999);
  assert.equal(assertUnsigned(0xffffffff),0xffffffff);
  for(const bad of [null,undefined,'42',-1,0,0.5,65536,Infinity,NaN]){
    assert.throws(()=>assertWireFid(bad),/(FILE id|unsigned integer)/);
  }
  for(const bad of [0,1000,'1',1.5,NaN])assert.throws(()=>assertSampleSlot(bad),/sample slot/);
  assert.throws(()=>assertBinaryBytes([1,2,3]),/Uint8Array/);
  assert.equal(assertBinaryBytes(new Uint8Array(0)).length,0);
});

test('device identity contracts normalize SKU without treating an unknown device as verified',()=>{
  assert.deepEqual(assertDeviceIdentity({sku:'te032as001',metadata:{os_version:'2.5.1'},midiId:0}),
    {sku:'TE032AS001',firmware:'2.5.1',midiId:0});
  assert.equal(assertDeviceIdentity({sku:'TE999AS999'}).sku,'TE999AS999');
  assert.throws(()=>assertDeviceIdentity({sku:'TE-UNKNOWN'}),/SKU/);
  assert.throws(()=>assertDeviceIdentity({sku:'TE032AS001',midiId:300}),/MIDI id/);
  assert.throws(()=>assertDeviceIdentity(null),/identity/);
});

test('metadata contract rejects prototype injection, cycles, arrays and non-JSON values',()=>{
  const safe={name:'kick',pitch:0.5,loop:{start:0,end:10},flags:[true,null,1]};
  assert.equal(assertFileMetadata(safe),safe);
  for(const value of [[],null,1,new Date(),{pitch:NaN},{fn:()=>1},{fn:undefined}]){
    assert.throws(()=>assertFileMetadata(value),/(metadata|plain object)/i);
  }
  const polluted=JSON.parse('{"__proto__":{"unsafe":true}}');
  assert.throws(()=>assertFileMetadata(polluted),/forbidden key/);
  const cyclic={};cyclic.self=cyclic;
  assert.throws(()=>assertFileMetadata(cyclic),/cycle/);
});

test('transaction and recovery contracts have distinct explicit state sets',()=>{
  assert.equal(assertProjectTransactionStatus('rollback-failed'),'rollback-failed');
  assert.equal(assertSampleTransactionStatus('acknowledged'),'acknowledged');
  assert.equal(assertProjectRecoveryStatus('candidate-written'),'candidate-written');
  assert.throws(()=>assertProjectTransactionStatus('candidate-written'),/project transaction status/);
  assert.throws(()=>assertSampleTransactionStatus('rollback-failed'),/sample transaction status/);
  assert.throws(()=>assertProjectRecoveryStatus('random-success'),/project recovery status/);
});

test('SysEx parser rejects high-bit wire corruption and incomplete packed groups',()=>{
  const valid=encodeTeSysex(5,Uint8Array.from([128,1,255]),1,0x101).bytes;
  assert.ok(parseTeSysex(valid));
  for(const index of [1,4,6,7,8]){
    const corrupted=valid.slice();corrupted[index]=0x80;
    assert.equal(parseTeSysex(corrupted),null,'byte '+index);
  }
  const wrongEnd=valid.slice();wrongEnd[wrongEnd.length-1]=0;
  assert.equal(parseTeSysex(wrongEnd),null);
  const orphan=Uint8Array.from([0xf0,0,0x20,0x76,1,0x40,0x60,1,5,0,0xf7]);
  assert.equal(parseTeSysex(orphan),null);
  const missingStatus=Uint8Array.from([0xf0,0,0x20,0x76,1,0x40,0x20,1,5,0xf7]);
  assert.equal(parseTeSysex(missingStatus),null);
});

test('identity responses require the complete signed manufacturer reply',()=>{
  const valid=Uint8Array.from([0xf0,0x7e,0,0x06,0x02,0,0x20,0x76,32,0,1,0,0,0,0,0,0xf7]);
  assert.equal(parseIdentityResponse(valid).sku,'TE032AS001');
  const badCommand=valid.slice();badCommand[4]=1;
  assert.equal(parseIdentityResponse(badCommand),null);
  const badEnd=valid.slice();badEnd[16]=0;
  assert.equal(parseIdentityResponse(badEnd),null);
});

test('FILE builders reject invalid ids and offsets before encoding truncated fields',()=>{
  for(const bad of [-1,65536,0.5,'7',NaN]){
    assert.throws(()=>buildFileListPayload(0,bad),/FILE_LIST parent id/);
    assert.throws(()=>buildFileInfoPayload(bad),/FILE id/);
    assert.throws(()=>buildFileGetInitPayload(bad),/FILE id/);
  }
  assert.deepEqual([...buildFileListPayload(0,0)],[4,0,0,0,0]);
  assert.throws(()=>buildFileDeletePayload(0),/FILE id/);
  assert.throws(()=>buildFileMovePayload(7,1000,65536),/16-bit integer/);
  assert.throws(()=>buildFileGetInitPayload(1,-1),/FILE_GET offset/);
  assert.throws(()=>buildFilePutInitPayload(1,1000,2**32,'file'),/FILE_PUT file size/);
  assert.throws(()=>buildMetadataSetPayload(1,{size:Infinity}),/metadata/);
});

test('FILE_LIST parses UTF-8 byte lengths and refuses unterminated or truncated records',()=>{
  const name=new TextEncoder().encode('удар');
  const bytes=Uint8Array.from([
    0,7,4,0,0,0,12,...name,0,
    0,8,4,0,0,0,10,0x61,0
  ]);
  const records=parseFileListEntries(bytes);
  assert.equal(records.length,2);
  assert.equal(records[0].fileName,'удар');
  assert.equal(records[1].nodeId,8);
  assert.equal(records[1].fileName,'a');
  assert.throws(()=>parseFileListEntries(bytes.slice(0,7)),/Truncated/);
  assert.throws(()=>parseFileListEntries(bytes.slice(0,7+name.length)),/Unterminated/);
  assert.throws(()=>parseFileListEntries([0,1,2]),/Uint8Array/);
});

test('FILE_INFO response requires a null terminated name',()=>{
  const good=Uint8Array.from([0,7,0,1,4,0,0,0,12,0x61,0]);
  assert.equal(parseFileInfoResponse(good).fileName,'a');
  assert.throws(()=>parseFileInfoResponse(good.slice(0,-1)),/FILE_INFO/);
});

test('FILE capability mask rejects corrupt values instead of silently coercing them',()=>{
  assert.equal(decodeFileRights(4).read,true);
  for(const bad of [-1,1.5,256,'255',NaN])assert.throws(()=>decodeFileRights(bad),/FILE capability mask/);
});

test('incoming FILE metadata event validates JSON object shape',()=>{
  const safe=new TextEncoder().encode('{"active":1}');
  assert.deepEqual(parseFileEvent(3,Uint8Array.from([0,7,...safe,0])),
    {nodeId:7,metadata:{active:1}});
  const wrong=new TextEncoder().encode('[]');
  assert.throws(()=>parseFileEvent(3,Uint8Array.from([0,7,...wrong,0])),/metadata/);
});

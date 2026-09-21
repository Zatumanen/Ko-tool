import test from 'node:test';
import assert from 'node:assert/strict';
import{packedLength,packToBuffer,unpackInPlace}from '../js/ep133/packing.js';
import{parseIdentityResponse,buildTeSysex,parseTeSysex}from '../js/ep133/sysex.js';
test('7-bit packing roundtrip',()=>{for(const length of [0,1,7,8,31,433]){const data=Uint8Array.from({length},(_,i)=>(i*37+129)&255);const out=new Uint8Array(packedLength(length));if(length)packToBuffer(data,out);const decoded=unpackInPlace(out);assert.deepEqual([...decoded],[...data]);}});
test('TE SysEx frame roundtrip',()=>{const payload=Uint8Array.from([0,127,128,255,42]);const frame=buildTeSysex(5,payload,123);const parsed=parseTeSysex(frame.bytes);assert.equal(parsed.command,5);assert.deepEqual([...parsed.rawData],[...payload]);});
test('EP-133 identity parser',()=>{const p=32,a=1;const response=Uint8Array.from([0xF0,0x7E,0x00,0x06,0x02,0x00,0x20,0x76,p&127,p>>7,a&127,a>>7,0,0,0,0,0xF7]);assert.equal(parseIdentityResponse(response).sku,'TE032AS001');});

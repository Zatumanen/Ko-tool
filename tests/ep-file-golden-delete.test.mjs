import test from 'node:test';
import assert from 'node:assert/strict';
import{loadGoldenFixture,decodeFixtureFrame}from './helpers/ep-file-golden-fixtures.mjs';
import{parseTeSysex}from '../js/ep133/sysex.js';
import{TE_SYSEX_FILE,TE_SYSEX_FILE_DELETE}from '../js/ep133/constants.js';
import{readU16,buildFileDeletePayload}from '../js/ep133/fileProtocol.js';

const fixtureUrl=new URL('./fixtures/ep-series/file-traces/v1/real/ep133-official-delete-001.json',import.meta.url);

test('real EP-133 DELETE trace preserves node id, event and ACK correlation',async()=>{
  const fixture=await loadGoldenFixture(fixtureUrl,{requireReal:true});
  assert.equal(fixture.provenance.source.path,'captures/sniffer-delete-hi.bin');
  assert.equal(fixture.provenance.source.blobSha,'26742449d7b56b1c027df5c05c79f09a14892765');
  assert.equal(fixture.sanitization.transforms.length,0);
  assert.deepEqual(fixture.frames.map(frame=>frame.direction),['tx','rx','rx']);
  assert.deepEqual(fixture.frames.map(frame=>frame.deltaMs),[0,85,85]);

  const parsed=fixture.frames.map(frame=>parseTeSysex(decodeFixtureFrame(frame)));
  assert.ok(parsed.every(Boolean));
  assert.ok(parsed.every(item=>item.command===TE_SYSEX_FILE));

  const request=parsed[0];
  assert.equal(request.isRequest,true);
  assert.equal(request.rawData[0],TE_SYSEX_FILE_DELETE);
  assert.equal(readU16(request.rawData,1),467);
  assert.deepEqual([...buildFileDeletePayload(467)],[...request.rawData]);

  const event=parsed[1];
  assert.equal(event.isRequest,true);
  assert.equal(event.requestId,0);
  assert.deepEqual([...event.rawData],[0x0a,0x01,0xd3]);

  const ack=parsed[2];
  assert.equal(ack.isRequest,false);
  assert.equal(ack.requestId,request.requestId);
  assert.equal(ack.status,0);
  assert.equal(ack.rawData.length,0);
});

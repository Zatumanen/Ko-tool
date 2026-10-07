import test from 'node:test';
import assert from 'node:assert/strict';
import{loadGoldenFixture,decodeFixtureFrame}from './helpers/ep-file-golden-fixtures.mjs';
import{parseTeSysex}from '../js/ep133/sysex.js';
import{
  TE_SYSEX_FILE,
  TE_SYSEX_FILE_METADATA,
  TE_SYSEX_FILE_METADATA_GET,
  TE_SYSEX_FILE_METADATA_SET
}from '../js/ep133/constants.js';
import{readU16,parseMetadataResponse}from '../js/ep133/fileProtocol.js';

const fixtureUrl=new URL('./fixtures/ep-series/file-traces/v1/real/ep133-official-metadata-001.json',import.meta.url);
const decoder=new TextDecoder();

test('real EP-133 metadata SET/GET trace preserves wire semantics after sanitization',async()=>{
  const fixture=await loadGoldenFixture(fixtureUrl,{requireReal:true});
  assert.equal(fixture.provenance.source.path,'captures/sniffer-rename.jsonl');
  assert.equal(fixture.provenance.source.blobSha,'7cb86f4ce5c6635833b29ab4921b80f30aa486ca');
  assert.equal(fixture.sanitization.transforms.length,2);

  const parsed=fixture.frames.map(frame=>({frame,sysex:parseTeSysex(decodeFixtureFrame(frame))}));
  assert.equal(parsed.every(item=>item.sysex?.command===TE_SYSEX_FILE),true);

  const setRequest=parsed.find(item=>item.sysex.isRequest
    &&item.sysex.rawData[0]===TE_SYSEX_FILE_METADATA
    &&item.sysex.rawData[1]===TE_SYSEX_FILE_METADATA_SET);
  assert.ok(setRequest,'captured metadata SET request');
  assert.equal(readU16(setRequest.sysex.rawData,2),20);
  const setText=decoder.decode(setRequest.sysex.rawData.slice(4));
  assert.equal(setText.includes('low_rename_test'),false);
  assert.equal(setText.includes('sample_name_000'),true);
  const setResponse=parsed.find(item=>!item.sysex.isRequest&&item.sysex.requestId===setRequest.sysex.requestId);
  assert.ok(setResponse,'captured metadata SET response');
  assert.equal(setResponse.sysex.status,0);

  const getRequests=parsed.filter(item=>item.sysex.isRequest
    &&item.sysex.rawData[0]===TE_SYSEX_FILE_METADATA
    &&item.sysex.rawData[1]===TE_SYSEX_FILE_METADATA_GET);
  assert.equal(getRequests.length,2);
  assert.deepEqual(getRequests.map(item=>readU16(item.sysex.rawData,2)),[20,20]);
  assert.deepEqual(getRequests.map(item=>readU16(item.sysex.rawData,4)),[0,1]);

  const responses=getRequests.map(request=>parsed.find(item=>
    !item.sysex.isRequest&&item.sysex.requestId===request.sysex.requestId
  ));
  assert.equal(responses.every(Boolean),true);
  const page0=parseMetadataResponse(responses[0].sysex.rawData,0);
  const page1=parseMetadataResponse(responses[1].sysex.rawData,1);
  assert.ok(page0);
  assert.ok(page1);
  assert.equal(page0.text.includes('low_rename_test'),false);
  assert.equal(page0.text.includes('sample_name_000'),true);
});

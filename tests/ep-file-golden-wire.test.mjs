import test from 'node:test';
import assert from 'node:assert/strict';
import{
  loadGoldenFixture,
  loadGoldenManifest,
  decodeFixtureFrame,
  summarizeRealCoverage
}from './helpers/ep-file-golden-fixtures.mjs';
import{parseTeSysex}from '../js/ep133/sysex.js';
import{
  TE_SYSEX_FILE,
  TE_SYSEX_FILE_INIT,
  TE_SYSEX_FILE_INIT_SUBSCRIBE,
  TE_SYSEX_FILE_LIST
}from '../js/ep133/constants.js';
import{readU16,parseFileListEntries}from '../js/ep133/fileProtocol.js';

const root=new URL('./fixtures/ep-series/file-traces/v1/',import.meta.url);

function parsedFrames(fixture){
  return fixture.frames.map(frame=>({frame,parsed:parseTeSysex(decodeFixtureFrame(frame))}));
}

test('real EP-133 official-app INIT/LIST trace parses through production protocol code',async()=>{
  const fixture=await loadGoldenFixture(new URL('real/ep133-official-init-list-001.json',root),{requireReal:true});
  assert.equal(fixture.id,'ep133-official-init-list-001');
  assert.equal(fixture.provenance.source.repository,'icherniukh/ep133-krate');
  assert.equal(fixture.provenance.source.commit,'6f2a85b844387418a98f948cbd61431365c344ae');
  assert.equal(fixture.provenance.source.path,'captures/sniffer-readmeta.jsonl');
  assert.equal(fixture.provenance.source.blobSha,'13c86e8ead2d88c0e2b468a4d426af8cea31307e');

  const parsed=parsedFrames(fixture);
  assert.equal(parsed.every(item=>item.parsed?.command===TE_SYSEX_FILE),true);

  const init=parsed.find(item=>item.parsed.isRequest&&item.parsed.rawData[0]===TE_SYSEX_FILE_INIT);
  assert.ok(init,'captured INIT request');
  assert.equal(init.parsed.rawData[1],TE_SYSEX_FILE_INIT_SUBSCRIBE);
  const initResponse=parsed.find(item=>!item.parsed.isRequest&&item.parsed.requestId===init.parsed.requestId);
  assert.ok(initResponse,'captured INIT response');
  assert.equal(initResponse.parsed.status,0);
  assert.ok(initResponse.parsed.rawData.length>=5);

  const listRequests=parsed.filter(item=>item.parsed.isRequest&&item.parsed.rawData[0]===TE_SYSEX_FILE_LIST);
  assert.equal(listRequests.length>=2,true);
  assert.deepEqual(listRequests.slice(0,2).map(item=>readU16(item.parsed.rawData,1)),[0,1]);
  assert.deepEqual(listRequests.slice(0,2).map(item=>readU16(item.parsed.rawData,3)),[0,0]);

  const listResponses=listRequests.map(request=>parsed.find(item=>
    !item.parsed.isRequest&&item.parsed.requestId===request.parsed.requestId
  ));
  assert.equal(listResponses.every(Boolean),true);
  assert.equal(listResponses.every(item=>item.parsed.status===0),true);
  assert.deepEqual(listResponses.slice(0,2).map(item=>readU16(item.parsed.rawData,0)),[0,1]);
  const entries=parseFileListEntries(listResponses[0].parsed.rawData.slice(2));
  assert.deepEqual(entries.map(entry=>entry.fileName),['sounds','projects']);
});

test('manifest counts imported INIT/LIST trace as real coverage and leaves unresolved classes missing',async()=>{
  const fixture=await loadGoldenFixture(new URL('real/ep133-official-init-list-001.json',root),{requireReal:true});
  const manifest=await loadGoldenManifest(new URL('manifest.json',root));
  const summary=summarizeRealCoverage(manifest,[fixture]);
  assert.equal(summary.covered.has('init'),true);
  assert.equal(summary.covered.has('list'),true);
  for(const missing of ['get','move','timeout','late-response','firmware-debug','interrupted-session']){
    assert.equal(summary.missing.has(missing),true,missing);
  }
});

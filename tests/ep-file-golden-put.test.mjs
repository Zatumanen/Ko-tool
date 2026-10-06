import test from 'node:test';
import assert from 'node:assert/strict';
import{loadGoldenFixture,decodeFixtureFrame}from './helpers/ep-file-golden-fixtures.mjs';
import{parseTeSysex}from '../js/ep133/sysex.js';
import{
  TE_SYSEX_FILE,
  TE_SYSEX_FILE_PUT,
  TE_SYSEX_FILE_PUT_TYPE_INIT,
  TE_SYSEX_FILE_PUT_TYPE_DATA
}from '../js/ep133/constants.js';
import{readU16,readU32,buildFilePutInitPayload,buildFilePutDataPayload}from '../js/ep133/fileProtocol.js';

const fixtureUrl=new URL('./fixtures/ep-series/file-traces/v1/real/ep133-official-put-001.json',import.meta.url);
const decoder=new TextDecoder();

function bytesEqual(actual,expected,message){
  assert.deepEqual(Array.from(actual),Array.from(expected),message);
}

test('real EP-133 PUT trace preserves init, contiguous data pages, sentinel and ACK correlation',async()=>{
  const fixture=await loadGoldenFixture(fixtureUrl,{requireReal:true});
  assert.equal(fixture.provenance.source.path,'captures/sniffer-slot26.jsonl');
  assert.equal(fixture.provenance.source.blobSha,'090d1b31b30124592f1d60c4e8d9f5cfaeca029f');
  assert.equal(fixture.sanitization.transforms.length,0);

  const parsed=fixture.frames.map(frame=>({frame,sysex:parseTeSysex(decodeFixtureFrame(frame))}));
  const fileFrames=parsed.filter(item=>item.sysex?.command===TE_SYSEX_FILE);
  const putRequests=fileFrames.filter(item=>item.sysex.isRequest&&item.sysex.rawData[0]===TE_SYSEX_FILE_PUT);
  assert.ok(putRequests.length>2,'captured PUT init, data pages, and sentinel');

  const init=putRequests[0].sysex;
  assert.equal(init.rawData[1],TE_SYSEX_FILE_PUT_TYPE_INIT);
  const fileId=readU16(init.rawData,3);
  const parentId=readU16(init.rawData,5);
  const fileSize=readU32(init.rawData,7);
  assert.equal(fileId,26);
  assert.equal(parentId,1000);
  assert.equal(fileSize,19412);

  const filenameEnd=init.rawData.indexOf(0,11);
  assert.ok(filenameEnd>11);
  const filenameBytes=init.rawData.slice(11,filenameEnd);
  bytesEqual(
    filenameBytes,
    Uint8Array.from([0x6b,0x69,0x63,0x6b,0x20,0x64,0x69,0x72,0x74,0x20,0x65,0x70,0x20,0x73,0x61,0x6d]),
    'captured filename bytes stay unchanged'
  );
  const filename=String.fromCharCode(...filenameBytes);
  const metadataText=decoder.decode(init.rawData.slice(filenameEnd+1)).replace(/\0+$/u,'');
  const metadata=metadataText?JSON.parse(metadataText):null;
  bytesEqual(
    buildFilePutInitPayload(fileId,parentId,fileSize,filename,metadata),
    init.rawData,
    'production PUT init builder reproduces captured FILE payload'
  );

  const dataRequests=putRequests.slice(1).map(item=>item.sysex);
  assert.ok(dataRequests.every(request=>request.rawData[1]===TE_SYSEX_FILE_PUT_TYPE_DATA));
  const pages=dataRequests.map(request=>readU16(request.rawData,2));
  assert.deepEqual(pages,Array.from({length:pages.length},(_,index)=>index));

  const sentinel=dataRequests.at(-1);
  assert.equal(sentinel.rawData.length,4,'terminal PUT_DATA page is an empty sentinel');
  for(const request of dataRequests){
    const page=readU16(request.rawData,2);
    bytesEqual(
      buildFilePutDataPayload(page,request.rawData.slice(4)),
      request.rawData,
      `production PUT data builder reproduces captured page ${page}`
    );
  }

  for(const request of putRequests){
    const response=fileFrames.find(item=>!item.sysex.isRequest&&item.sysex.requestId===request.sysex.requestId);
    assert.ok(response,`captured response for request ${request.sysex.requestId}`);
    assert.equal(response.sysex.status,0);
  }
});

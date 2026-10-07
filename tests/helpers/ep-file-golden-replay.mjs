import assert from 'node:assert/strict';
import{TE_SYSEX_FILE}from '../../js/ep133/constants.js';
import{parseTeSysex}from '../../js/ep133/sysex.js';
import{decodeFixtureFrame,validateGoldenFixture}from './ep-file-golden-fixtures.mjs';

const bytes=value=>value instanceof Uint8Array?value:new Uint8Array(value||[]);
const printable=value=>[...bytes(value)].map(byte=>byte.toString(16).padStart(2,'0')).join(' ');

function selectFrames(fixture,range){
  const frames=fixture.frames;
  if(range==null)return frames;
  if(Array.isArray(range)){
    return range.map(index=>{
      if(!Number.isInteger(index)||index<0||index>=frames.length)throw new Error('Golden replay range index is out of bounds.');
      return frames[index];
    });
  }
  if(typeof range==='object'){
    const start=range.start??0,end=range.end??frames.length;
    if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||end>frames.length)throw new Error('Golden replay range is invalid.');
    return frames.slice(start,end);
  }
  throw new Error('Golden replay range must be null, an index array, or {start,end}.');
}

function buildPairs(fixture,range){
  const selected=selectFrames(fixture,range);
  const pending=new Map();
  const pairs=[];
  for(const frame of selected){
    const parsed=parseTeSysex(decodeFixtureFrame(frame));
    if(!parsed||parsed.command!==TE_SYSEX_FILE)continue;
    if(frame.direction==='tx'&&parsed.isRequest){
      if(!parsed.hasRequestId)throw new Error('Captured FILE request is missing request correlation.');
      if(pending.has(parsed.requestId))throw new Error('Captured FILE request id is reused before its response.');
      pending.set(parsed.requestId,{frame,parsed});
      continue;
    }
    if(frame.direction==='rx'&&!parsed.isRequest){
      if(!parsed.hasRequestId)throw new Error('Captured FILE response is missing request correlation.');
      const request=pending.get(parsed.requestId);
      if(!request)throw new Error('Captured FILE response has no matching request correlation.');
      pending.delete(parsed.requestId);
      pairs.push(Object.freeze({
        capturedRequestId:parsed.requestId,
        request:request.parsed.rawData.slice(),
        response:parsed.rawData.slice(),
        status:parsed.status,
        delay:Math.max(0,frame.deltaMs-request.frame.deltaMs),
        requestFrameIndex:request.frame.index,
        responseFrameIndex:frame.index
      }));
    }
  }
  return pairs;
}

export function createGoldenFileReplay(value,{range=null}={}){
  const fixture=validateGoldenFixture(value);
  const script=buildPairs(fixture,range);
  if(!script.length)throw new Error('Golden replay contains no correlated FILE request/response pairs.');
  const seen=[];
  let cursor=0;

  const onRequest=request=>{
    if(request?.command!==TE_SYSEX_FILE)return{};
    const raw=bytes(request.rawData).slice();
    seen.push(raw);
    const step=script[cursor++];
    if(!step){
      return{
        status:3,
        payload:new TextEncoder().encode('unexpected golden replay request: '+printable(raw)+'\0')
      };
    }
    return{
      status:step.status,
      payload:step.response.slice(),
      delay:step.delay
    };
  };

  const assertComplete=()=>{
    assert.equal(
      seen.length,
      script.length,
      'Golden FILE replay request count mismatch: saw '+seen.length+', expected '+script.length
    );
    for(let index=0;index<script.length;index++){
      assert.deepEqual(
        [...seen[index]],
        [...script[index].request],
        'Golden FILE request mismatch at pair '+index+
          '\nactual:   '+printable(seen[index])+
          '\nexpected: '+printable(script[index].request)
      );
    }
  };

  return{
    onRequest,
    assertComplete,
    seen,
    remaining:()=>Math.max(0,script.length-seen.length)
  };
}

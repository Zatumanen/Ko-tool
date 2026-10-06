import{createHash}from 'node:crypto';
import{parseTeSysex}from '../../js/ep133/sysex.js';
import{packedLength,packToBuffer}from '../../js/ep133/packing.js';
import{validateGoldenFixture}from './ep-file-golden-fixtures.mjs';

const HEX=/^[0-9a-f]+$/i;
const encoder=new TextEncoder();

const bytes=value=>{
  if(value instanceof Uint8Array)return value.slice();
  if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer,value.byteOffset,value.byteLength).slice();
  if(value instanceof ArrayBuffer)return new Uint8Array(value).slice();
  if(typeof value==='string')return encoder.encode(value);
  throw new Error('EP capture sourceBytes must be bytes or a string.');
};
const toHex=value=>Buffer.from(value).toString('hex').toUpperCase();
const digest=value=>`sha256:${createHash('sha256').update(bytes(value)).digest('hex')}`;

function timestampToMs(value,lineNumber){
  if(value==null||value==='')return null;
  if(typeof value==='number'&&Number.isFinite(value))return value;
  const text=String(value).trim();
  const match=text.match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if(match){
    const hour=Number(match[1]),minute=Number(match[2]),second=Number(match[3]);
    if(hour>23||minute>59||second>59)throw new Error(`Invalid capture timestamp on line ${lineNumber}.`);
    const millis=Number((match[4]||'').padEnd(3,'0')||0);
    return ((hour*60+minute)*60+second)*1000+millis;
  }
  const parsed=Date.parse(text);
  if(Number.isFinite(parsed))return parsed;
  throw new Error(`Invalid capture timestamp on line ${lineNumber}.`);
}

export function parseCaptureJsonl(text,{start=0,end=null}={}){
  const source=String(text??'');
  const sourceRecords=source.split(/\r?\n/)
    .map((rawLine,index)=>({rawLine,lineNumber:index+1}))
    .filter(({rawLine})=>rawLine.trim());
  const resolvedEnd=end==null?sourceRecords.length:end;
  if(!Number.isInteger(start)||!Number.isInteger(resolvedEnd)||start<0||resolvedEnd<start||resolvedEnd>sourceRecords.length)throw new Error('Invalid capture source-record window.');
  const records=[];
  for(const{rawLine,lineNumber}of sourceRecords.slice(start,resolvedEnd)){
    let value;
    try{value=JSON.parse(rawLine);}catch(error){throw new Error(`Invalid capture JSON on line ${lineNumber}: ${error.message}`);}
    const direction=String(value?.dir||'').toLowerCase();
    if(direction!=='tx'&&direction!=='rx')throw new Error(`Invalid capture direction on line ${lineNumber}.`);
    const hex=String(value?.hex||'');
    if(!hex.length||hex.length%2!==0||!HEX.test(hex))throw new Error(`Invalid capture hex on line ${lineNumber}.`);
    const frame=Uint8Array.from(Buffer.from(hex,'hex'));
    if(value.len!=null&&(!Number.isInteger(value.len)||value.len!==frame.length))throw new Error(`Capture length mismatch on line ${lineNumber}.`);
    records.push({
      direction,
      timestampMs:timestampToMs(value.ts,lineNumber),
      bytes:frame
    });
  }
  return records;
}

export function normalizeCaptureWindow(records,{start=0,end=records?.length??0}={}){
  if(!Array.isArray(records))throw new Error('Capture records must be an array.');
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||end>records.length)throw new Error('Invalid capture window.');
  const selected=records.slice(start,end);
  if(!selected.length)return[];
  const numericTimes=selected.map(item=>item?.timestampMs).filter(Number.isFinite);
  const base=numericTimes.length?numericTimes[0]:0;
  let previous=0;
  return selected.map((record,index)=>{
    if(record?.direction!=='tx'&&record?.direction!=='rx')throw new Error(`Invalid capture direction at selected frame ${index}.`);
    const frameBytes=bytes(record.bytes);
    let delta=Number.isFinite(record.timestampMs)?record.timestampMs-base:previous;
    if(!Number.isFinite(delta)||delta<0||delta<previous)throw new Error(`Capture timing is non-monotonic at selected frame ${index}.`);
    previous=delta;
    return{index,direction:record.direction,deltaMs:delta,hex:toHex(frameBytes)};
  });
}

function findMatches(haystack,needle){
  const positions=[];
  outer:for(let i=0;i<=haystack.length-needle.length;i++){
    for(let j=0;j<needle.length;j++)if(haystack[i+j]!==needle[j])continue outer;
    positions.push(i);
  }
  return positions;
}

function rebuildTeFrame(original,parsed,rawData){
  const payloadStart=parsed.isRequest?9:10;
  const packedSize=packedLength(rawData.length);
  if(original.length!==payloadStart+packedSize+1)throw new Error('Captured TE frame packed length does not match parsed payload.');
  const rebuilt=original.slice();
  if(packedSize)packToBuffer(rawData,rebuilt.subarray(payloadStart,payloadStart+packedSize));
  return rebuilt;
}

function assertProtectedTeFields(before,after,beforeBytes,afterBytes){
  for(const key of ['identityCode','isRequest','hasRequestId','requestId','command','status']){
    if(after?.[key]!==before?.[key])throw new Error(`Sanitization changed protected TE field ${key}.`);
  }
  if(after.rawData.length!==before.rawData.length)throw new Error('Sanitization changed decoded payload length.');
  if(afterBytes.length!==beforeBytes.length)throw new Error('Sanitization changed wire frame length.');
}

export function sanitizeCaptureFrames(frames,{rules=[]}={}){
  if(!Array.isArray(frames))throw new Error('Capture frames must be an array.');
  if(!Array.isArray(rules))throw new Error('Sanitizer rules must be an array.');
  const output=frames.map(frame=>({...frame}));
  const transforms=[];
  for(const rule of rules){
    if(rule?.kind!=='decoded-ascii')throw new Error(`Unsupported sanitizer rule kind ${String(rule?.kind)}.`);
    if(!Number.isInteger(rule.frameIndex)||rule.frameIndex<0||rule.frameIndex>=output.length)throw new Error('Sanitizer frameIndex is out of range.');
    const match=encoder.encode(String(rule.match??''));
    const replacement=encoder.encode(String(rule.replacement??''));
    if(!match.length)throw new Error('Sanitizer match must not be empty.');
    if(match.length!==replacement.length)throw new Error('Sanitizer replacement length must match the source length.');
    const frame=output[rule.frameIndex];
    const original=Uint8Array.from(Buffer.from(String(frame.hex||''),'hex'));
    const parsed=parseTeSysex(original);
    if(!parsed)throw new Error(`Sanitizer frame ${rule.frameIndex} is not a TE SysEx frame with decoded payload.`);
    const positions=findMatches(parsed.rawData,match);
    if(positions.length!==1)throw new Error(`Sanitizer rule must match exactly once; found ${positions.length}.`);
    const rawData=parsed.rawData.slice();
    rawData.set(replacement,positions[0]);
    const rebuilt=rebuildTeFrame(original,parsed,rawData);
    const reparsed=parseTeSysex(rebuilt);
    if(!reparsed)throw new Error('Sanitized TE frame no longer parses.');
    assertProtectedTeFields(parsed,reparsed,original,rebuilt);
    frame.hex=toHex(rebuilt);
    transforms.push(Object.freeze({
      kind:'decoded-ascii',
      frameIndex:rule.frameIndex,
      label:String(rule.label||''),
      offset:positions[0],
      byteLength:match.length
    }));
  }
  return{
    frames:output.map((frame,index)=>({...frame,index})),
    transforms
  };
}

function canonicalize(value){
  if(Array.isArray(value))return value.map(canonicalize);
  if(value&&typeof value==='object'){
    const out={};
    for(const key of Object.keys(value).sort())out[key]=canonicalize(value[key]);
    return out;
  }
  return value;
}

function canonicalBytes(value){return encoder.encode(JSON.stringify(canonicalize(value)));}

export function buildGoldenFixture({
  id,
  provenance,
  scenario,
  frames,
  expectations,
  sourceBytes,
  transforms=[],
  sanitizerVersion=1
}){
  if(sourceBytes==null)throw new Error('Golden fixture generation requires exact sourceBytes.');
  const fixtureWithoutDigest={
    schemaVersion:1,
    id,
    provenance,
    sanitization:{
      version:sanitizerVersion,
      sourceDigest:digest(sourceBytes),
      transforms
    },
    scenario,
    frames,
    expectations
  };
  const fixtureDigest=digest(canonicalBytes(fixtureWithoutDigest));
  const fixture=canonicalize({
    ...fixtureWithoutDigest,
    sanitization:{...fixtureWithoutDigest.sanitization,fixtureDigest}
  });
  return validateGoldenFixture(fixture);
}

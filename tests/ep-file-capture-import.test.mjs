import test from 'node:test';
import assert from 'node:assert/strict';
import{createHash}from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import{importEpFileCapture}from '../scripts/import-ep-file-capture.mjs';
import{
  parseCaptureJsonl,
  parseCaptureRaw,
  normalizeCaptureWindow,
  sanitizeCaptureFrames,
  buildGoldenFixture
}from './helpers/ep-file-capture-import.mjs';
import{encodeTeSysex,parseTeSysex}from '../js/ep133/sysex.js';
import{packedLength,packToBuffer}from '../js/ep133/packing.js';
import{TE_SYSEX_FILE}from '../js/ep133/constants.js';

const hex=bytes=>Buffer.from(bytes).toString('hex').toUpperCase();

function responseFrame({identityCode=0x33,requestId=0x123,command=TE_SYSEX_FILE,status=5,payload=new Uint8Array()}={}){
  const raw=payload instanceof Uint8Array?payload:new Uint8Array(payload);
  const packedSize=packedLength(raw.length);
  const frame=new Uint8Array(11+packedSize);
  frame.set([0xf0,0x00,0x20,0x76,identityCode,0x40,0x20|((requestId>>7)&0x1f),requestId&0x7f,command,status],0);
  if(packedSize)packToBuffer(raw,frame.subarray(10,10+packedSize));
  frame[frame.length-1]=0xf7;
  return frame;
}

const sourceLine=(ts,dir,bytes)=>JSON.stringify({ts,dir,len:bytes.length,hex:hex(bytes)});

const provenance={
  kind:'real-device',
  source:{
    repository:'icherniukh/ep133-krate',
    commit:'6f2a85b844387418a98f948cbd61431365c344ae',
    path:'captures/example.jsonl',
    blobSha:'13c86e8ead2d88c0e2b468a4d426af8cea31307e',
    license:'MIT'
  },
  captureMethod:'official-app-proxy',
  device:{family:'EP-series',model:'EP-133',firmware:'2.0.5'}
};

test('capture JSONL parser validates direction hex and declared length',()=>{
  const request=encodeTeSysex(TE_SYSEX_FILE,Uint8Array.from([0x04,0,0,0,1]),0x33,0x121).bytes;
  const response=responseFrame({requestId:0x121,status:0,payload:Uint8Array.from([0,1])});
  const text=[
    sourceLine('18:17:21.444','TX',request),
    sourceLine('18:17:21.459','RX',response)
  ].join('\n');
  const parsed=parseCaptureJsonl(text);
  assert.equal(parsed.length,2);
  assert.equal(parsed[0].direction,'tx');
  assert.equal(parsed[1].direction,'rx');
  assert.equal(parsed[1].timestampMs-parsed[0].timestampMs,15);
  assert.deepEqual([...parsed[0].bytes],[...request]);

  assert.throws(()=>parseCaptureJsonl('{bad json'),/line 1|JSON/i);
  assert.throws(()=>parseCaptureJsonl(JSON.stringify({ts:'18:17:21.444',dir:'SIDE',len:2,hex:'F0F7'})),/direction/i);
  assert.throws(()=>parseCaptureJsonl(JSON.stringify({ts:'18:17:21.444',dir:'TX',len:3,hex:'F0F7'})),/length/i);
  assert.throws(()=>parseCaptureJsonl(JSON.stringify({ts:'18:17:21.444',dir:'TX',len:2,hex:'F0XZ'})),/hex/i);
});

function rawRecord(direction,timestampMs,frame){
  const bytes=frame instanceof Uint8Array?frame:new Uint8Array(frame);
  const out=Buffer.alloc(13+bytes.length);
  out[0]=direction==='tx'?0x54:direction==='rx'?0x52:0x58;
  out.writeBigUInt64LE(BigInt(timestampMs),1);
  out.writeUInt32LE(bytes.length,9);
  Buffer.from(bytes).copy(out,13);
  return out;
}

test('raw capture parser validates direction timestamp length and complete records',()=>{
  const request=encodeTeSysex(TE_SYSEX_FILE,Uint8Array.from([0x06,0x01,0xd3]),0x33,0x211).bytes;
  const response=responseFrame({requestId:0x211,status:0,payload:new Uint8Array()});
  const source=Buffer.concat([
    rawRecord('tx',1_760_000_000_100,request),
    rawRecord('rx',1_760_000_000_109,response)
  ]);
  const parsed=parseCaptureRaw(source);
  assert.equal(parsed.length,2);
  assert.equal(parsed[0].direction,'tx');
  assert.equal(parsed[1].direction,'rx');
  assert.equal(parsed[1].timestampMs-parsed[0].timestampMs,9);
  assert.deepEqual([...parsed[0].bytes],[...request]);
  assert.deepEqual([...parsed[1].bytes],[...response]);

  const badDirection=Buffer.from(source);
  badDirection[0]=0x58;
  assert.throws(()=>parseCaptureRaw(badDirection),/direction|record 1/i);
  assert.throws(()=>parseCaptureRaw(source.subarray(0,source.length-1)),/truncated|length|record 2/i);
});

test('capture importer accepts documented raw binary source format',async()=>{
  const request=encodeTeSysex(TE_SYSEX_FILE,Uint8Array.from([0x06,0x01,0xd3]),0x33,0x211).bytes;
  const response=responseFrame({requestId:0x211,status:0,payload:new Uint8Array()});
  const source=Buffer.concat([
    rawRecord('tx',1_760_000_000_100,request),
    rawRecord('rx',1_760_000_000_109,response)
  ]);
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ep-raw-capture-'));
  const sourcePath=path.join(dir,'capture.bin');
  const descriptorPath=path.join(dir,'descriptor.json');
  const outPath=path.join(dir,'fixture.json');
  await fs.writeFile(sourcePath,source);
  await fs.writeFile(descriptorPath,JSON.stringify({
    id:'ep133-delete-raw-test',
    provenance:{...provenance,source:{...provenance.source,path:'captures/sniffer-delete-hi.bin',blobSha:'26742449d7b56b1c027df5c05c79f09a14892765'}},
    scenario:{operation:'delete',outcome:'success',description:'raw DELETE capture'},
    expectations:{wire:{coverage:['delete']},runtime:[]},
    rules:[]
  }));
  try{
    const fixture=await importEpFileCapture({source:sourcePath,descriptor:descriptorPath,out:outPath,format:'raw'});
    assert.equal(fixture.frames.length,2);
    assert.deepEqual(fixture.frames.map(frame=>frame.direction),['tx','rx']);
    assert.deepEqual(fixture.frames.map(frame=>frame.deltaMs),[0,9]);
    const parsed=parseTeSysex(Uint8Array.from(Buffer.from(fixture.frames[0].hex,'hex')));
    assert.deepEqual([...parsed.rawData],[0x06,0x01,0xd3]);
    assert.equal((await fs.readFile(outPath,'utf8')).endsWith('\n'),true);
  }finally{
    await fs.rm(dir,{recursive:true,force:true});
  }
});

test('capture window normalization rebases time without changing frame order or bytes',()=>{
  const frames=[0x121,0x122,0x123].map((id,index)=>encodeTeSysex(
    TE_SYSEX_FILE,Uint8Array.from([0x04,0,index,0,1]),0x33,id
  ).bytes);
  const text=frames.map((bytes,index)=>sourceLine(`18:17:21.${String(444+index*15).padStart(3,'0')}`,'TX',bytes)).join('\n');
  const records=parseCaptureJsonl(text);
  const normalized=normalizeCaptureWindow(records,{start:1,end:3});
  assert.deepEqual(normalized.map(frame=>frame.index),[0,1]);
  assert.deepEqual(normalized.map(frame=>frame.deltaMs),[0,15]);
  assert.deepEqual(normalized.map(frame=>frame.hex),[hex(frames[1]),hex(frames[2])]);
  assert.deepEqual(normalized.map(frame=>frame.direction),['tx','tx']);
});

test('decoded ASCII sanitizer is deterministic and preserves protected TE FILE semantics',()=>{
  const encoder=new TextEncoder();
  const requestPayload=Uint8Array.from([0x07,0x02,0x00,0x35,...encoder.encode('{"serial":"SERIAL01"}'),0]);
  const responsePayload=Uint8Array.from([0x07,0x00,...encoder.encode('SERIAL01'),0]);
  const request=encodeTeSysex(TE_SYSEX_FILE,requestPayload,0x33,0x345).bytes;
  const response=responseFrame({requestId:0x345,status:5,payload:responsePayload});
  const frames=[
    {index:0,direction:'tx',deltaMs:0,hex:hex(request)},
    {index:1,direction:'rx',deltaMs:7,hex:hex(response)}
  ];
  const rules=[
    {kind:'decoded-ascii',frameIndex:0,match:'SERIAL01',replacement:'DEVICE01',label:'request serial'},
    {kind:'decoded-ascii',frameIndex:1,match:'SERIAL01',replacement:'DEVICE01',label:'response serial'}
  ];

  const first=sanitizeCaptureFrames(frames,{rules});
  const second=sanitizeCaptureFrames(frames,{rules});
  assert.deepEqual(first,second);
  assert.equal(first.frames.length,frames.length);
  assert.equal(first.transforms.length,2);

  for(let i=0;i<frames.length;i++){
    const before=parseTeSysex(Uint8Array.from(Buffer.from(frames[i].hex,'hex')));
    const afterBytes=Uint8Array.from(Buffer.from(first.frames[i].hex,'hex'));
    const after=parseTeSysex(afterBytes);
    assert.equal(afterBytes.length,Buffer.from(frames[i].hex,'hex').length);
    assert.equal(after.command,before.command);
    assert.equal(after.requestId,before.requestId);
    assert.equal(after.status,before.status);
    assert.equal(after.rawData.length,before.rawData.length);
    assert.deepEqual([...after.rawData.slice(0,2)],[...before.rawData.slice(0,2)]);
    assert.equal(new TextDecoder().decode(after.rawData).includes('SERIAL01'),false);
    assert.equal(new TextDecoder().decode(after.rawData).includes('DEVICE01'),true);
  }

  assert.throws(()=>sanitizeCaptureFrames(frames,{rules:[
    {kind:'decoded-ascii',frameIndex:0,match:'SERIAL01',replacement:'SHORT',label:'bad replacement'}
  ]}),/length/i);
});

test('golden fixture generation hashes exact source bytes and is byte-deterministic',()=>{
  const sourceBytes=new TextEncoder().encode('exact source bytes\n');
  const request=encodeTeSysex(TE_SYSEX_FILE,Uint8Array.from([0x01,0x01,0,0x40,0,0]),0x33,0x111).bytes;
  const frames=[{index:0,direction:'tx',deltaMs:0,hex:hex(request)}];
  const options={
    id:'ep133-official-init-001',
    provenance,
    scenario:{operation:'init',outcome:'success',description:'official app FILE init'},
    frames,
    expectations:{wire:{command:TE_SYSEX_FILE},runtime:[]},
    sourceBytes,
    sanitizerVersion:1
  };
  const first=buildGoldenFixture(options);
  const second=buildGoldenFixture(options);
  assert.deepEqual(first,second);
  const expectedSource=`sha256:${createHash('sha256').update(sourceBytes).digest('hex')}`;
  assert.equal(first.sanitization.sourceDigest,expectedSource);
  assert.match(first.sanitization.fixtureDigest,/^sha256:[0-9a-f]{64}$/);
  assert.equal(first.sanitization.fixtureDigest,second.sanitization.fixtureDigest);

  const changed=buildGoldenFixture({...options,sourceBytes:new TextEncoder().encode('changed source bytes\n')});
  assert.notEqual(changed.sanitization.sourceDigest,first.sanitization.sourceDigest);
  assert.notEqual(changed.sanitization.fixtureDigest,first.sanitization.fixtureDigest);
});

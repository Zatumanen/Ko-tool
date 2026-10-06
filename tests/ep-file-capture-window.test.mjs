import test from 'node:test';
import assert from 'node:assert/strict';
import{parseCaptureJsonl}from './helpers/ep-file-capture-import.mjs';

const frameLine=JSON.stringify({
  ts:'18:17:21.444',
  dir:'TX',
  len:10,
  hex:'F000207633406B1201F7'
});
const summaryLine=JSON.stringify({
  _stripped:429,
  _reason:'bulk audio data chunks (len>300) — 3 examples retained above'
});

test('capture parser validates only the selected source-record window',()=>{
  const source=[frameLine,summaryLine].join('\n');
  const selected=parseCaptureJsonl(source,{start:0,end:1});
  assert.equal(selected.length,1);
  assert.equal(selected[0].direction,'tx');
  assert.deepEqual([...selected[0].bytes],[0xf0,0x00,0x20,0x76,0x33,0x40,0x6b,0x12,0x01,0xf7]);
});

test('capture parser still fails closed when a non-frame record is inside the selected window',()=>{
  const source=[frameLine,summaryLine].join('\n');
  assert.throws(()=>parseCaptureJsonl(source,{start:1,end:2}),/direction|frame/i);
});

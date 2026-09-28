import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {createZip} from '../js/zip.js';

test('resampler main WASM is pinned to the current TE production binary',async()=>{
  const bytes=await fs.readFile(new URL('../js/ep133/wasm/resample.wasm',import.meta.url));
  assert.equal(bytes.byteLength,214055);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'013809682a99d529ac363d0d186a709f31dceb762cffb9c1e270fc7b04e2f32e');
});

test('resampler uses the reference dynamic WASM runtime',async()=>{
  const source=await fs.readFile(new URL('../js/ep133/resampler.js',import.meta.url),'utf8');
  const runtime=await fs.readFile(new URL('../js/ep133/resampleModule.js',import.meta.url),'utf8');
  assert.match(source,/DYNAMIC_LIBRARIES=\['libsndfile\.wasm','libsamplerate\.wasm','libtag\.wasm','libtag_c\.wasm'\]/);
  assert.match(source,/createResampleModule\(\{dynamicLibraries:DYNAMIC_LIBRARIES,locateFile:file=>new URL\(`\.\/wasm\/\$\{file\}`,import\.meta\.url\)\.href\}\)/);
  assert.match(runtime,/resample\.wasm/);
  assert.match(runtime,/Module\.resampleAudioData/);
});

test('resample wasm is pinned to the current TE production binary and ABI surface',async()=>{
  const bytes=await fs.readFile(new URL('../js/ep133/wasm/resample.wasm',import.meta.url));
  assert.equal(bytes.byteLength,214055);
  assert.equal(
    crypto.createHash('sha256').update(bytes).digest('hex'),
    '013809682a99d529ac363d0d186a709f31dceb762cffb9c1e270fc7b04e2f32e'
  );
  const module=new WebAssembly.Module(bytes);
  assert.equal(WebAssembly.Module.customSections(module,'dylink.0').length,1);
  assert.equal(WebAssembly.Module.imports(module).length,71);
  assert.equal(WebAssembly.Module.exports(module).length,158);
});


test('EP audio pipeline imports the libsamplerate module and validates channel count',async()=>{
  const source=await fs.readFile(new URL('../js/ep133/audio.js',import.meta.url),'utf8');
  assert.match(source,/import\{getLibSampleRateModule\}from '\.\/resampler\.js\?v=/);
  assert.match(source,/getLibSampleRateModule\(\)/);
  assert.match(source,/audioMeta\.channels<1\|\|audioMeta\.channels>2/);
});

test('ZIP local and central headers use the same UTF-8 flag',async()=>{
  const blob=await createZip([{path:'тест.wav',blob:new Blob([new Uint8Array([1,2,3])])}]);
  const bytes=new Uint8Array(await blob.arrayBuffer());
  const view=new DataView(bytes.buffer);
  assert.equal(view.getUint16(6,true),0x800);
  const central=bytes.findIndex((_,i)=>bytes[i]===0x50&&bytes[i+1]===0x4b&&bytes[i+2]===0x01&&bytes[i+3]===0x02);
  assert.ok(central>0);
  assert.equal(view.getUint16(central+8,true),0x800);
});

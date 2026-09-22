import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createZip} from '../js/zip.js';

test('resampler keeps its WASM source pinned and integrity-checked',async()=>{
  const source=await fs.readFile(new URL('../js/ep133/resampler.js',import.meta.url),'utf8');
  assert.match(source,/DEFAULT_WASM_URL='\.\/wasm\/libsamplerate\.wasm'/);
  assert.match(source,/resampleModule\.js/);
  assert.match(source,/WebAssembly\.instantiate\(module,\{env:runtime\.env\}\)/);
  assert.match(source,/EP-133 resampler integrity check failed/);
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

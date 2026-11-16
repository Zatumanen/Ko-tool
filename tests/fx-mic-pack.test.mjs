import test from 'node:test';
import assert from 'node:assert/strict';
import{inspectWav,encodePcmWav}from '../js/fxMic/wav.js';
import{readPack,writePack,validatePack,createPackStore}from '../js/fxMic/pack.js';
import{defaultConfig}from '../js/fxMic/config.js';
import{createZip}from '../js/zip.js';

const wav=()=>encodePcmWav(new Float32Array([0,.5,-.5,1]),{sampleRate:22050,channels:1});
const pack=()=>({config:{...defaultConfig(),samples:[{file:'1.wav',playmode:'oneshot'}]},files:new Map([['1.wav',wav()]])});
test('WAV records exact PCM format, frames and file size without repitch metadata',()=>{
 const bytes=wav(),info=inspectWav(bytes);assert.equal(info.frames,4);assert.equal(info.sampleRate,22050);assert.equal(info.channels,1);assert.equal(info.bits,16);assert.equal(bytes.length,52);assert.equal(info.duration,4/22050);
 const view=new DataView(bytes.buffer);assert.equal(view.getInt16(46,true),16384);assert.equal(view.getInt16(48,true),-16384);
});
for(const [name,mutate]of [
 ['truncated',b=>b.subarray(0,b.length-1)],['bad RIFF size',b=>{new DataView(b.buffer).setUint32(4,200,true);return b;}],
 ['bad data bounds',b=>{new DataView(b.buffer).setUint32(40,200,true);return b;}],
 ['integer32',b=>{new DataView(b.buffer).setUint16(34,32,true);return b;}],
 ['over rate',b=>{new DataView(b.buffer).setUint32(24,96001,true);return b;}],
 ['bad align',b=>{new DataView(b.buffer).setUint16(32,4,true);return b;}]
])test('WAV rejects '+name,()=>assert.throws(()=>inspectWav(mutate(wav()))));
test('ZIP roundtrip preserves audio bytes and config semantics; counts actual files',async()=>{
 const p=pack(),bytes=await writePack(p),back=await readPack(new Uint8Array(await bytes.arrayBuffer()));
 assert.deepEqual(back.config,p.config);assert.deepEqual(back.files,p.files);
 assert.equal(validatePack(p).bytes,wav().length+new TextEncoder().encode(JSON.stringify(p.config,null,2)+'\n').length);
});
test('stored and deflated ZIP import enforce CRC and reject traversal/duplicates',async()=>{
 const p=pack();
 for(const compression of ['store','deflate']){
  const zip=await createZip([{path:'config.json',blob:new Blob([JSON.stringify(p.config)])},{path:'1.wav',blob:new Blob([wav()])}],{compression});
  assert.deepEqual((await readPack(new Uint8Array(await zip.arrayBuffer()))).files,p.files);
 }
 for(const paths of [['../config.json'],['config.json','config.json']]){
  const zip=await createZip(paths.map(path=>({path,blob:new Blob(['{}'])})));
  await assert.rejects(async()=>readPack(new Uint8Array(await zip.arrayBuffer())));
 }
 const bad=new Uint8Array(await(await writePack(p)).arrayBuffer());bad[41]^=1;await assert.rejects(()=>readPack(bad));
});
test('missing WAV, oversized pack and incompatible import preserve working state',async()=>{
 const store=createPackStore(pack()),before=store.snapshot();
 const invalid={...defaultConfig(),sample_fx:'preset'};
 await assert.rejects(()=>store.importConfig(JSON.stringify(invalid)));assert.deepEqual(store.snapshot(),before);
 await assert.rejects(()=>store.importConfig(JSON.stringify({...defaultConfig(),samples:[{file:'missing.wav'}]})));assert.deepEqual(store.snapshot(),before);
 const large=pack();large.files.set('1.wav',encodePcmWav(new Float32Array(500000),{sampleRate:22050,channels:1}));assert.throws(()=>validatePack(large),/budget/);
});
test('late import cannot replace intervening edits and snapshot mutation cannot change store',async()=>{
 let finish;const pending=new Promise(r=>finish=r);const store=createPackStore(pack());
 const importing=store.importZip(pending);store.editConfig(c=>{c.name='New work';});finish(new Uint8Array(await(await writePack(pack())).arrayBuffer()));
 await assert.rejects(()=>importing,/changed/);assert.equal(store.snapshot().config.name,'New work');
 const detached=store.snapshot();detached.files.get('1.wav')[0]=0;detached.config.name='bad';assert.equal(store.snapshot().config.name,'New work');assert.equal(store.snapshot().files.get('1.wav')[0],82);
});
test('closing the editor while ZIP decoding is pending cancels its commit',async()=>{
 let finish,active=true;const store=createPackStore(pack()),before=store.snapshot();
 const pending=store.importZip(new Promise(r=>finish=r),()=>active);
 active=false;finish(new Uint8Array(await(await writePack(pack())).arrayBuffer()));
 await assert.rejects(()=>pending,/cancelled/);assert.deepEqual(store.snapshot(),before);assert.equal(store.revision,0);
});

import test from 'node:test';import assert from 'node:assert/strict';
import {createLoudnessMeter,kWeightingCoefficients} from '../js/visuals/loudness.js';
function tone(rate,seconds,amplitude=1,hz=997){return Float32Array.from({length:rate*seconds},(_,i)=>amplitude*Math.sin(2*Math.PI*hz*i/rate));}
function run(rate,channels,seconds=4,amplitude=.1){const meter=createLoudnessMeter(rate,channels),pcm=tone(rate,seconds,amplitude);for(let i=0;i<pcm.length;i+=128)meter.push(Array.from({length:channels},()=>pcm.subarray(i,i+128)));return meter;}
test('48k K coefficients reproduce normative BS1770 tables',()=>{
 const [s,h]=kWeightingCoefficients(48000);assert.ok(Math.abs(s.b[0]-1.53512485958697)<1e-12);assert.ok(Math.abs(s.a[1]+1.69065929318241)<1e-12);assert.ok(Math.abs(h.a[1]+1.99004745483398)<1e-12);
});
test('997Hz reference mono/stereo LUFS are calibrated independently of RMS',()=>{
 for(const rate of [44100,48000,96000])for(const channels of [1,2]){
  const s=run(rate,channels).snapshot(),expected=-23.01+(channels===2?10*Math.log10(2):0);
  for(const k of ['momentary','shortTerm','integrated'])assert.ok(Math.abs(s[k]-expected)<.12,`${rate}/${channels}/${k}: ${s[k]}`);
 }
});
test('warmup, silence, absolute gate and reset never invent a finite measurement',()=>{
 const m=createLoudnessMeter(48000,1);assert.equal(m.snapshot().momentary,null);m.push([new Float32Array(19200)]);assert.equal(m.snapshot().momentary,-Infinity);assert.equal(m.snapshot().integrated,-Infinity);assert.equal(m.snapshot().shortTerm,null);
 const quiet=run(48000,1,4,1e-5).snapshot();assert.equal(quiet.integrated,-Infinity);
 m.reset();assert.equal(m.snapshot().seconds,0);assert.equal(m.snapshot().integrated,null);
});
test('partitioning and display polling cannot change measurement; input is unchanged',()=>{
 const data=tone(48000,4,.1),copy=data.slice(),a=createLoudnessMeter(48000,1),b=createLoudnessMeter(48000,1);a.push([data]);
 for(let i=0;i<data.length;i+=137){b.push([data.subarray(i,i+137)]);b.snapshot();}
 assert.deepEqual(a.snapshot(),b.snapshot());assert.deepEqual(data,copy);
});
test('independent FFmpeg ebur128 goldens cover rates, polarity, gates, noise and frequency weighting',async()=>{
 const {readFile}=await import('node:fs/promises'),{createHash}=await import('node:crypto');
 const {loudnessVector,interleave}=await import('./helpers/loudness-vectors.mjs');
 const fixture=JSON.parse(await readFile(new URL('./fixtures/visuals-loudness-golden.json',import.meta.url)));
 for(const spec of fixture.vectors){
  const planes=loudnessVector(spec);assert.equal(createHash('sha256').update(new Uint8Array(interleave(planes).buffer)).digest('hex'),spec.pcmSha256);
  const m=createLoudnessMeter(spec.rate,spec.channels);for(let i=0;i<planes[0].length;i+=128)m.push(planes.map(p=>p.subarray(i,i+128)));
  const result=m.snapshot();for(const key of ['momentary','shortTerm','integrated'])assert.ok(Math.abs(result[key]-spec.expected[key])<=fixture.toleranceLU,`${spec.name}/${key}: ${result[key]} vs ${spec.expected[key]}`);
 }
});
test('worklet keeps measuring behind bounded UI delivery and fences reset epochs',async()=>{
 const sent=[];let Processor;
 globalThis.AudioWorkletProcessor=class{constructor(){this.port={postMessage:value=>sent.push(value)}}};globalThis.sampleRate=48000;
 globalThis.registerProcessor=(_name,Type)=>{Processor=Type};
 try{
  await import('../js/visuals/loudnessWorklet.js');const node=new Processor({processorOptions:{channels:1}}),pcm=tone(48000,4,.1);
  for(let i=0;i<pcm.length;i+=128)node.process([[pcm.subarray(i,i+128)]]);
  assert.equal(sent.length,1);node.port.onmessage({data:{ack:true}});node.process([[new Float32Array(128)]]);
  assert.equal(sent.length,2);assert.ok(sent[1].seconds>=4);assert.ok(Math.abs(sent[1].integrated+23.01)<.1);
  node.port.onmessage({data:{reset:7}});node.process([[new Float32Array(128)]]);assert.equal(sent.length,2);
  node.port.onmessage({data:{ack:true}});node.process([[new Float32Array(128)]]);assert.equal(sent.at(-1).epoch,7);assert.equal(sent.at(-1).integrated,null);
 }finally{delete globalThis.AudioWorkletProcessor;delete globalThis.sampleRate;delete globalThis.registerProcessor;}
});
test('invalid channels/PCM require reset and cannot retain a successful value',()=>{
 const m=run(48000,1);assert.ok(Number.isFinite(m.snapshot().integrated));m.push([new Float32Array([NaN])]);assert.equal(m.snapshot().integrated,null);assert.match(m.snapshot().error,/Invalid/);
 m.reset();m.push([new Float32Array(10),new Float32Array(10)]);assert.match(m.snapshot().error,/channel/);
 assert.throws(()=>createLoudnessMeter(12345,2));assert.throws(()=>createLoudnessMeter(48000,6));
});
test('four hours are measurable; exceeding the bounded session requires reset', {timeout:120000},()=>{
 const m=createLoudnessMeter(16000,1),silence=new Float32Array(16000);
 for(let i=0;i<14400;i++)m.push([silence]);
 assert.equal(m.snapshot().seconds,14400);assert.equal(m.snapshot().error,null);
 m.push([new Float32Array(1)]);assert.match(m.snapshot().error,/session limit/);assert.equal(m.snapshot().integrated,null);
 m.reset();assert.equal(m.snapshot().error,null);assert.equal(m.snapshot().seconds,0);
});

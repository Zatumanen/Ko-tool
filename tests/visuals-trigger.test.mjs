import test from 'node:test';
import assert from 'node:assert/strict';
import {createTransientTrigger} from '../js/visuals/transientTrigger.js';
test('silence is flat; short negative attack is centered with its actual decay and held',()=>{
 const t=createTransientTrigger(1000,{threshold:.2,timeMs:100,holdMs:100});
 assert.ok(t.snapshot().samples.every(x=>x===0));
 t.push(Float32Array.from([0,0,-.8,-.5,-.25,...Array(47).fill(0)]));
 const first=t.snapshot();assert.equal(first.count,1);assert.equal(first.samples.length,100);
 assert.ok(first.samples.slice(0,50).every(x=>x===0));assert.ok(Math.abs(first.samples[50]+.8)<1e-6);
 t.push(new Float32Array(1000));assert.deepEqual(t.snapshot().samples,first.samples);
});
test('block boundaries do not lose attacks; hold suppresses retrigger and silence rearms',()=>{
 const t=createTransientTrigger(1000,{threshold:.2,timeMs:20,holdMs:50});
 t.push(new Float32Array([0,.8]));t.push(new Float32Array(10));assert.equal(t.snapshot().count,1);
 t.push(new Float32Array([.8,0,.8,0]));assert.equal(t.snapshot().count,1);
 t.push(new Float32Array(60));t.push(new Float32Array([-.9,...Array(10).fill(0)]));assert.equal(t.snapshot().count,2);
});
test('threshold filters small attacks and settings reset capture without changing PCM',()=>{
 const t=createTransientTrigger(1000,{threshold:.5,timeMs:20,holdMs:0});
 const block=new Float32Array([.2,...Array(20).fill(0)]),before=block.slice();t.push(block);assert.equal(t.snapshot().count,0);assert.deepEqual(block,before);
 t.configure({threshold:.1});t.push(block);assert.equal(t.snapshot().count,1);
 t.configure({timeMs:100});assert.equal(t.snapshot().samples.length,100);assert.equal(t.snapshot().count,0);
 for(const v of [NaN,0,-1,Infinity])assert.throws(()=>t.configure({timeMs:v}));
});

test('display envelope preserves a single-sample attack when reducing to narrow Canvas',async()=>{
 const {waveformEnvelope}=await import('../js/visuals/transientTrigger.js');
 const pcm=new Float32Array(9600);pcm[4800]=-.9;
 const columns=waveformEnvelope(pcm,200);
 assert.equal(columns.length,200);assert.ok(columns[100][0]<-.89);assert.equal(columns[0][1],0);
});

test('worklet bounds in-flight frames while Canvas thread is stalled and publishes latest after ACK',async()=>{
 const sent=[];let Processor;
 globalThis.AudioWorkletProcessor=class{constructor(){this.port={postMessage:message=>sent.push(message)}}};
 globalThis.sampleRate=48000;globalThis.registerProcessor=(_name,Type)=>{Processor=Type};
 try{
  await import('../js/visuals/triggerWorklet.js');const node=new Processor();
  node.port.onmessage({data:{threshold:.1,timeMs:1000,holdMs:0}});
  const block=Float32Array.from({length:128},(_,i)=>i%50===0?.8:0);
  for(let i=0;i<2000;i++)node.process([[block]]);
  assert.equal(sent.length,1,'only one unacknowledged frame may leave the worklet');
  node.port.onmessage({data:{ack:true}});
  for(let i=0;i<20;i++)node.process([[block]]);
  assert.equal(sent.length,2);assert.ok(sent[1].count>0);
 }finally{delete globalThis.AudioWorkletProcessor;delete globalThis.sampleRate;delete globalThis.registerProcessor;}
});

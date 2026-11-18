import test from 'node:test';
import assert from 'node:assert/strict';
import{audioBufferToS16}from '../js/audio/audioEngine.js';
const load=()=>import('../js/visuals/recorderPcm.js');
const setup=async(options={})=>{const {createPcmRecorder}=await load(),events=[];const core=createPcmRecorder({sampleRate:48000,channels:2,bits:16,maxBytes:65536,...options},e=>events.push(e));core.command('start',1);return{core,events}};
const data=events=>events.filter(e=>e.type==='data').map(e=>new Uint8Array(e.bytes));
const joined=events=>Buffer.concat(data(events));
test('16/24-bit PCM uses signed extrema, independent interleave, actual rate and RIFF padding',async()=>{
 const {wavHeader}=await load();
 for(const bits of [16,24]){
  const {core,events}=await setup({bits});const l=Float32Array.of(-1,0,.5,2),r=Float32Array.of(1,-.5,0,-2);core.push([l,r]);core.command('stop',2);assert.deepEqual(core.levels().clip,[true,true]);
  const bytes=joined(events),h=wavHeader({sampleRate:48000,channels:2,bits,frames:4}),v=new DataView(h.buffer);
  assert.equal(v.getUint16(20,true),1);assert.equal(v.getUint16(22,true),2);assert.equal(v.getUint32(24,true),48000);assert.equal(v.getUint16(34,true),bits);assert.equal(v.getUint32(40,true),4*2*bits/8);assert.equal(v.getUint32(4,true),36+bytes.length);
  if(bits===16){const canonical=audioBufferToS16({numberOfChannels:2,length:4,getChannelData:c=>c?r:l});assert.deepEqual([...bytes],[...canonical]);}
  else{const int=i=>{const n=bytes[i]|bytes[i+1]<<8|bytes[i+2]<<16;return n&0x800000?n-0x1000000:n};assert.equal(int(0),-8388608);assert.equal(int(3),8388607);assert.equal(int(9),-4194304);}
 }
 const h=wavHeader({sampleRate:44100,channels:1,bits:24,frames:1});assert.equal(new DataView(h.buffer).getUint32(4,true),40);assert.equal(new DataView(h.buffer).getUint32(40,true),3);
});
test('pause excludes precisely the paused frames and resume appends with no duplicate boundary',async()=>{
 const {core,events}=await setup({channels:1});core.push([Float32Array.of(.25,.5)]);core.command('pause',2);core.push([Float32Array.of(-1,-1,-1)]);core.command('resume',3);core.push([Float32Array.of(.75)]);core.command('stop',4);
 const b=joined(events),v=new DataView(b.buffer,b.byteOffset,b.byteLength);assert.deepEqual([0,2,4].map(i=>v.getInt16(i,true)),[8192,16384,24575]);assert.equal(events.at(-1).frames,3);assert.equal(events.at(-1).state,'done');assert.deepEqual(data(events).map(x=>x.length),[4,2]);
});
test('arbitrary block partitions produce identical audio and contiguous packet sequences',async()=>{
 const signal=Float32Array.from({length:10000},(_,i)=>(i%50)/50-.5);
 const run=async sizes=>{const {core,events}=await setup({channels:1});let at=0;for(const n of sizes){core.push([signal.subarray(at,at+n)]);at+=n;}core.command('stop',2);return events;};
 const a=await run([10000]),b=await run([1,127,4096,5000,776]);assert.deepEqual(joined(a),joined(b));assert.deepEqual(a.filter(e=>e.type==='data').map(e=>e.sequence),[0,1,2]);
});
test('payload limit stops exactly at complete frames and explicitly labels limited result',async()=>{
 const {core,events}=await setup({bits:24,maxBytes:19});core.push([new Float32Array(10),new Float32Array(10)]);assert.equal(events.at(-1).state,'limited');assert.equal(events.at(-1).frames,3);assert.equal(joined(events).length,18);core.push([Float32Array.of(1),Float32Array.of(1)]);assert.equal(joined(events).length,18);
});
test('invalid PCM/channel changes stop with an explicitly interrupted contiguous prefix',async()=>{
 for(const bad of [[Float32Array.of(NaN),Float32Array.of(0)],[Float32Array.of(0)]]){
  const {core,events}=await setup();core.push([Float32Array.of(.5),Float32Array.of(-.5)]);core.command('pause',2);core.command('resume',3);core.push(bad);assert.equal(events.at(-1).state,'interrupted');assert.equal(joined(events).length,4);assert.equal(events.at(-1).frames,1);
 }
});
test('a stalled receiver cannot build an unbounded queue or silently drop recording audio',async()=>{
 const {core,events}=await setup({maxBytes:1e7,maxPendingBytes:16384});for(let i=0;i<20;i++)core.push([new Float32Array(4096),new Float32Array(4096)]);
 assert.equal(events.at(-1).state,'interrupted');assert.equal(events.at(-1).reason,'backpressure');assert.ok(joined(events).length<=16384);
 const s=await setup({maxBytes:1e7,maxPendingBytes:16384});for(let i=0;i<20;i++){s.core.push([new Float32Array(4096),new Float32Array(4096)]);for(const e of s.events)if(e.type==='data')s.core.ack(e.sequence);}s.core.command('stop',2);assert.equal(s.events.at(-1).state,'done');assert.equal(s.events.at(-1).frames,81920);
});
test('real worklet transport transfers PCM buffers but never numeric state byte counters',async()=>{
 let Processor;const messages=[];globalThis.sampleRate=48000;
 globalThis.AudioWorkletProcessor=class{constructor(){this.port={onmessage:null,postMessage(packet,transfer){messages.push(structuredClone(packet,{transfer}));},close(){}}}};
 globalThis.registerProcessor=(name,cls)=>{assert.equal(name,'visuals-recorder');Processor=cls};
 try{
  await import('../js/visuals/recorderWorklet.js');const p=new Processor({processorOptions:{channels:2,bits:24,maxBytes:65536}});
  p.port.onmessage({data:{command:'start',commandId:1}});p.process([[new Float32Array(128),new Float32Array(128)]]);
  p.port.onmessage({data:{command:'pause',commandId:2}});assert.equal(messages.at(-1).state,'paused');assert.equal(messages.at(-1).bytes,768);assert.equal(messages.find(m=>m.type==='data').bytes.byteLength,768);
  p.port.onmessage({data:{command:'stop',commandId:3}});assert.equal(p.process([[new Float32Array(128),new Float32Array(128)]]),false,'terminal processors must release their audio-thread lifetime');
  const discarded=new Processor({processorOptions:{channels:1,bits:16,maxBytes:65536}});discarded.port.onmessage({data:{command:'start',commandId:1}});discarded.port.onmessage({data:{dispose:true}});assert.equal(discarded.process([[new Float32Array(128)]]),false,'active discard must terminate too');
 }finally{delete globalThis.AudioWorkletProcessor;delete globalThis.registerProcessor;delete globalThis.sampleRate;}
});

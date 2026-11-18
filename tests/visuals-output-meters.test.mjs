import test from 'node:test';
import assert from 'node:assert/strict';
const load=()=>import('../js/visuals/outputMeters.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('single sample impulse between paints is retained independently without modifying PCM',async()=>{
 const {createOutputMeters}=await load(),m=createOutputMeters(1000),l=Float32Array.from([0,-.75,0]),r=Float32Array.from([.25,0,0]);
 m.push([l,r]);m.push([new Float32Array(200),new Float32Array(200)]);
 const s=m.take();assert.equal(s.status,'ready');assert.deepEqual(s.peak,[.75,.25]);assert.deepEqual(s.hold,[.75,.25]);assert.deepEqual(s.clip,[false,false]);
 assert.deepEqual([...l],[0,-.75,0]);assert.deepEqual(m.take().peak,[0,0]);
});
test('hold uses the sample clock: 1s hold then 20dB per second independent of block partition',async()=>{
 const {createOutputMeters}=await load();
 const run=chunks=>{const m=createOutputMeters(1000);m.push([Float32Array.of(1),Float32Array.of(.5)]);m.take();for(const n of chunks)m.push([new Float32Array(n),new Float32Array(n)]);return m.take()};
 const one=run([1500]),many=run(Array(15).fill(100));near(one.hold[0],Math.pow(10,-10/20));near(one.hold[1],.5*Math.pow(10,-10/20));assert.deepEqual(one,many);
 near(run([1000]).hold[0],1);
});
test('CLIP uses exact sample full scale on either polarity and latches until reset',async()=>{
 const {createOutputMeters,peakDb}=await load(),m=createOutputMeters(1000);
 m.push([Float32Array.of(.999),Float32Array.of(-1)]);assert.deepEqual(m.take().clip,[false,true]);
 m.push([Float32Array.of(1.25),Float32Array.of(0)]);assert.deepEqual(m.take().clip,[true,true]);
 m.push([new Float32Array(5000),new Float32Array(5000)]);assert.deepEqual(m.take().clip,[true,true]);
 m.reset();m.push([Float32Array.of(0),Float32Array.of(0)]);assert.deepEqual(m.take().clip,[false,false]);assert.deepEqual(m.take().hold,[0,0]);
 near(peakDb(.5),-6.020599913);assert.equal(peakDb(0),-Infinity);near(peakDb(2),6.020599913);
});
test('mono reports only its actual channel; silence is minus infinity; invalid samples fail closed',async()=>{
 const {createOutputMeters}=await load(),m=createOutputMeters(1000);
 assert.equal(m.take().status,'pending');m.push([Float32Array.of(.5)]);const mono=m.take();assert.equal(mono.channelCount,1);assert.deepEqual(mono.peak,[.5,null]);assert.deepEqual(mono.clip,[false,null]);
 m.push([Float32Array.of(.5),Float32Array.of(.2)]);assert.equal(m.take().status,'invalid');
 m.reset();m.push([Float32Array.of(NaN)]);assert.equal(m.take().status,'invalid');m.push([Float32Array.of(0)]);assert.equal(m.take().status,'invalid');
 m.reset();m.push([Float32Array.of(0),Float32Array.of(0)]);assert.deepEqual(m.take().peak,[0,0]);
 for(const channels of [[Float32Array.of(0),new Float32Array(0)],Array(3).fill(Float32Array.of(0))]){m.reset();m.push(channels);assert.equal(m.take().status,'invalid');}
});
test('worklet backpressure bounds messages while retaining a later impulse and CLIP',async()=>{
 await load();let Processor;
 globalThis.sampleRate=1000;
 globalThis.AudioWorkletProcessor=class{constructor(){this.port={onmessage:null,messages:[],postMessage(s){this.messages.push(structuredClone(s))}}}};
 globalThis.registerProcessor=(name,cls)=>{assert.equal(name,'visuals-output-meters');Processor=cls};
 try{
  await import('../js/visuals/outputMetersWorklet.js');const p=new Processor();
  const silence=()=>[[new Float32Array(40),new Float32Array(40)]];
  p.process(silence());assert.equal(p.port.messages.length,1);
  p.process([[Float32Array.of(0),Float32Array.of(-1.1)]]);
  for(let i=0;i<100;i++)p.process(silence());assert.equal(p.port.messages.length,1);
  p.port.onmessage({data:{ack:true}});p.process(silence());assert.equal(p.port.messages.length,2);
  const packet=p.port.messages[1];assert.ok(packet.peak[1]>1);assert.equal(packet.clip[1],true);
  p.port.onmessage({data:{reset:true}});p.process(silence());const reset=p.port.messages.at(-1);assert.deepEqual(reset.clip,[false,false]);
 }finally{delete globalThis.sampleRate;delete globalThis.AudioWorkletProcessor;delete globalThis.registerProcessor;}
});

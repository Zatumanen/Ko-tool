import test from 'node:test';
import assert from 'node:assert/strict';
import{createPcmRecorder}from '../js/visuals/recorderPcm.js';
const load=()=>import('../js/visuals/recorder.js');
async function setup(t,{channels=2,maxBytes=65536,loader=async()=>{}}={}){
 const {createWavRecorder}=await load(),old=globalThis.AudioWorkletNode,nodes=[];
 globalThis.AudioWorkletNode=class{constructor(context,name,options){assert.equal(name,'visuals-recorder');this.messages=[];this.port={onmessage:null,postMessage:m=>{this.messages.push(m);if(m.ack!==undefined)this.core.ack(m.ack);else this.core.command(m.command,m.commandId)},close(){}};this.core=createPcmRecorder({...options.processorOptions,sampleRate:context.sampleRate},m=>this.port.onmessage?.({data:m}));nodes.push(this)}connect(){}disconnect(){this.disconnected=true}};
 const context={sampleRate:48000,audioWorklet:{addModule:loader}},source={connect(){},disconnect(){}},rec=createWavRecorder({maxBytes});
 rec.attach({context,source,sink:{},channelCount:channels,getChannelCount:()=>channels});
 t.after(()=>{rec.discard();if(old===undefined)delete globalThis.AudioWorkletNode;else globalThis.AudioWorkletNode=old});return{rec,nodes,context,source};
}
test('controller uses one supplied source; pause/resume and final WAV match confirmed chunks',async t=>{
 const {rec,nodes}=await setup(t);assert.equal(await rec.start(24),true);nodes[0].core.push([Float32Array.of(.5),Float32Array.of(-.5)]);
 await rec.pause();nodes[0].core.push([Float32Array.of(1),Float32Array.of(1)]);await rec.resume();nodes[0].core.push([Float32Array.of(0),Float32Array.of(.25)]);await rec.stop();
 const s=rec.snapshot();assert.equal(s.state,'done');assert.equal(s.frames,2);assert.equal(s.sampleRate,48000);assert.equal(s.channels,2);assert.equal(s.bits,24);assert.equal(nodes[0].disconnected,true);
 const b=new Uint8Array(await rec.result().arrayBuffer());assert.equal(b.length,56);assert.equal(new DataView(b.buffer).getUint32(40,true),12);
 rec.discard();assert.equal(rec.snapshot().state,'idle');assert.throws(()=>rec.result());
});
test('detaching during asynchronous START never connects a stale recorder',async t=>{
 let finish,entered;const waiting=new Promise(r=>entered=r),pending=new Promise(r=>finish=r);
 const {rec,nodes}=await setup(t,{loader:async()=>{entered();await pending}});const starting=rec.start(16);await waiting;rec.detach();finish();assert.equal(await starting,false);assert.equal(nodes.length,0);assert.equal(rec.snapshot().state,'interrupted');
});
test('a sequence gap cannot become a successful recording and preserves only the verified prefix',async t=>{
 const {rec,nodes}=await setup(t);await rec.start(16);nodes[0].core.push([Float32Array.of(.5),Float32Array.of(-.5)]);await rec.pause();const handler=nodes[0].port.onmessage;
 handler({data:{type:'data',sequence:5,frames:1,bytes:new ArrayBuffer(4)}});assert.equal(rec.snapshot().state,'interrupted');assert.equal(rec.snapshot().frames,1);assert.equal((await rec.result().arrayBuffer()).byteLength,48);
});
test('capture loss preserves an explicitly interrupted prefix and does not erase it on reattach',async t=>{
 const {rec,nodes,context,source}=await setup(t);await rec.start(16);nodes[0].core.push([Float32Array.of(.1),Float32Array.of(.2)]);await rec.pause();rec.detach();assert.equal(rec.snapshot().state,'interrupted');assert.equal(rec.snapshot().frames,1);
 rec.attach({context,source,sink:{},channelCount:2,getChannelCount:()=>2});assert.equal(await rec.start(16),false);assert.equal(rec.snapshot().frames,1);
});
test('memory limit produces a labelled limited WAV, including odd mono24 padding',async t=>{
 const {rec,nodes}=await setup(t,{channels:1,maxBytes:9});await rec.start(24);nodes[0].core.push([Float32Array.of(.1,.2,.3,.4)]);assert.equal(rec.snapshot().state,'limited');assert.equal(rec.snapshot().frames,3);assert.equal((await rec.result().arrayBuffer()).byteLength,54);
});
test('unknown recording format is unavailable instead of guessed/downmixed',async t=>{
 const {rec,nodes}=await setup(t,{channels:0});assert.equal(await rec.start(16),false);assert.equal(nodes.length,0);assert.equal(rec.snapshot().state,'interrupted');
});
test('bad final counters cannot promote a verified prefix to normal success',async t=>{
 const {rec,nodes}=await setup(t);await rec.start(16);nodes[0].core.push([Float32Array.of(.1),Float32Array.of(.2)]);await rec.pause();
 nodes[0].port.onmessage({data:{type:'state',state:'done',frames:2,bytes:8,sequence:1}});assert.equal(rec.snapshot().state,'interrupted');assert.equal(rec.snapshot().frames,1);
});
test('a missing STOP acknowledgement times out as interrupted, never done',async t=>{
 const {rec,nodes}=await setup(t);await rec.start(16);nodes[0].core.push([Float32Array.of(.1),Float32Array.of(.2)]);await rec.pause();
 t.mock.timers.enable({apis:['setTimeout']});nodes[0].port.postMessage=()=>{};const stopping=rec.stop();t.mock.timers.tick(2000);assert.equal(await stopping,false);assert.equal(rec.snapshot().state,'interrupted');assert.equal(rec.snapshot().reason,'command-timeout');
});
test('changed channel metadata interrupts before accepting remixed recording chunks',async t=>{
 const {rec,nodes,context,source}=await setup(t);await rec.start(16);nodes[0].core.push([Float32Array.of(.1),Float32Array.of(.2)]);await rec.pause();
 // The existing capture graph may change while the worklet itself remains clamped.
 // Supply the live metadata provider before starting a fresh capture.
 rec.discard();let count=2;rec.attach({context,source,sink:{},channelCount:2,getChannelCount:()=>count});await rec.start(16);const n=nodes.at(-1);n.core.push([Float32Array.of(.1),Float32Array.of(.2)]);await rec.pause();await rec.resume();count=3;n.core.push([new Float32Array(4096),new Float32Array(4096)]);
 assert.equal(rec.snapshot().state,'interrupted');assert.equal(rec.snapshot().reason,'channel-format');assert.equal(rec.snapshot().frames,1);
});

test('discard explicitly disposes an active processor before closing its port',async t=>{
 const {rec,nodes}=await setup(t);await rec.start(16);rec.discard();assert.equal(nodes[0].messages.some(m=>m.dispose===true),true);assert.equal(nodes[0].port.onmessage,null);assert.equal(rec.snapshot().state,'idle');
});

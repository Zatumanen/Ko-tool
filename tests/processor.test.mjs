import test from 'node:test';
import assert from 'node:assert/strict';

class TestAudioBuffer{
  constructor({length,sampleRate,numberOfChannels}){
    this.length=length;
    this.sampleRate=sampleRate;
    this.numberOfChannels=numberOfChannels;
    this._channels=Array.from({length:numberOfChannels},()=>new Float32Array(length));
  }
  getChannelData(index){return this._channels[index];}
}
globalThis.AudioBuffer=TestAudioBuffer;

const {PRESETS,getPreset,convertChannels,speedAndResample,quantizeBuffer,encodeWav}=await import('../js/audio/processor.js');

function buffer(length=8,channels=1,sampleRate=44100){
  const b=new TestAudioBuffer({length,sampleRate,numberOfChannels:channels});
  return b;
}

test('presets keep the supported hardware targets',()=>{
  assert.deepEqual(getPreset('cd'),PRESETS.cd);
  assert.equal(PRESETS.sp8.sampleRate,26040);
  assert.equal(PRESETS.sp8.bitDepth,12);
  assert.equal(PRESETS.sp8.wavBitDepth,16);
  assert.equal(PRESETS.sk.sampleRate,9387);
});

test('mono conversion averages source channels',async()=>{
  const b=buffer(2,2);
  b.getChannelData(0).set([1,0]);
  b.getChannelData(1).set([0,1]);
  const out=await convertChannels(b,1);
  assert.equal(out.numberOfChannels,1);
  assert.ok(Math.abs(out.getChannelData(0)[0]-.5)<1e-6);
  assert.ok(Math.abs(out.getChannelData(0)[1]-.5)<1e-6);
});

test('stereo conversion duplicates mono',async()=>{
  const b=buffer(2,1);
  b.getChannelData(0).set([-.25,.75]);
  const out=await convertChannels(b,2);
  assert.deepEqual([...out.getChannelData(0)],[...out.getChannelData(1)]);
});

test('2x resampling produces half the duration',async()=>{
  const b=buffer(100,1,1000);
  const out=await speedAndResample(b,2,1000);
  assert.equal(out.length,50);
  assert.equal(out.sampleRate,1000);
});

test('12-bit quantization remains available for SP-1200 processing',async()=>{
  const b=buffer(3,1,26040);
  b.getChannelData(0).set([-1,-0.123456,1]);
  const out=await quantizeBuffer(b,12);
  assert.ok(out.getChannelData(0)[1]!==b.getChannelData(0)[1]);
  assert.ok(out.getChannelData(0)[0]>=-1&&out.getChannelData(0)[2]<=1);
});

test('WAV encoder writes valid PCM headers for 16-bit container output',async()=>{
  const b=buffer(4,1,26040);
  b.getChannelData(0).set([0,-1,1,.5]);
  const blob=await encodeWav(b,16,{},'loop');
  const bytes=new Uint8Array(await blob.arrayBuffer());
  const view=new DataView(bytes.buffer);
  const ascii=(o,n)=>String.fromCharCode(...bytes.slice(o,o+n));
  assert.equal(ascii(0,4),'RIFF');
  assert.equal(ascii(8,4),'WAVE');
  assert.equal(view.getUint16(22,true),16);
  assert.equal(view.getUint32(24,true),26040);
  assert.ok(bytes.includes(108));
});

test('WAV encoder supports 8-bit output',async()=>{
  const b=buffer(2,1,9387);
  b.getChannelData(0).set([-1,1]);
  const blob=await encodeWav(b,8);
  const bytes=new Uint8Array(await blob.arrayBuffer());
  const view=new DataView(bytes.buffer);
  assert.equal(view.getUint16(22,true),8);
  assert.equal(bytes[44],0);
  assert.equal(bytes[45],255);
});

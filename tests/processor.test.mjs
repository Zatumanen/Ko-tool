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

const {PRESETS,getPreset,EP_REPITCH_FACTOR,EP_REPITCH_COMPENSATION,EP_OUTPUT_BIT_DEPTH,convertChannels,speedAndResample,quantizeBuffer,normalizeBuffer,encodeWav,processAudio}=await import('../js/audio/processor.js');

function buffer(length=8,channels=1,sampleRate=44100){
  const b=new TestAudioBuffer({length,sampleRate,numberOfChannels:channels});
  return b;
}

test('SpeedUpperCut quality presets are EP-oriented and always s16',()=>{
  assert.deepEqual(Object.keys(PRESETS),['hi','mid','lo']);
  assert.equal(PRESETS.hi.sampleRate,46875);
  assert.equal(PRESETS.mid.sampleRate,32000);
  assert.equal(PRESETS.lo.sampleRate,26250);
  for(const preset of Object.values(PRESETS)){
    assert.equal(preset.bitDepth,16);
    assert.equal(preset.wavBitDepth,16);
  }
  assert.deepEqual(getPreset('hi'),PRESETS.hi);
  assert.deepEqual(getPreset('cd'),PRESETS.hi);
  assert.equal(PRESETS.sp8,undefined);
  assert.equal(PRESETS.sk,undefined);
});

test('fixed x2 repitch contract stays paired with minus 12 semitone metadata compensation',()=>{
  assert.equal(EP_REPITCH_FACTOR,2);
  assert.equal(EP_REPITCH_COMPENSATION,-12);
  assert.equal(EP_OUTPUT_BIT_DEPTH,16);
  assert.equal(12*Math.log2(EP_REPITCH_FACTOR),-EP_REPITCH_COMPENSATION);
});

test('processAudio ignores legacy speed overrides and emits MID as 32 kHz 16-bit EP-ready WAV',async()=>{
  const src=buffer(120,1,48000);
  for(let i=0;i<src.length;i++)src.getChannelData(0)[i]=Math.sin(i*.17)*.5;
  const input=await (await encodeWav(src,16,{},'oneshot')).arrayBuffer();
  const result=await processAudio(input,{
    fidelity:'mid',
    channels:'mono',
    playmode:'loop',
    autoTrim:false,
    speed:4
  });
  assert.equal(result.sampleRate,32000);
  assert.equal(result.bitDepth,16);
  assert.equal(result.repitchFactor,2);
  assert.equal(result.pitchCompensation,-12);
  assert.equal(result.buffer.length,40);

  const bytes=new Uint8Array(await result.blob.arrayBuffer());
  const view=new DataView(bytes.buffer);
  assert.equal(view.getUint32(24,true),32000);
  assert.equal(view.getUint16(34,true),16);

  const ascii=(offset,length)=>String.fromCharCode(...bytes.slice(offset,offset+length));
  const tnge=bytes.findIndex((_,index)=>ascii(index,4)==='TNGE');
  assert.ok(tnge>0);
  const jsonLength=view.getUint32(tnge+4,true);
  const metadata=JSON.parse(new TextDecoder().decode(bytes.slice(tnge+8,tnge+8+jsonLength)));
  assert.equal(metadata['sound.pitch'],-12);
  assert.equal(metadata['sound.playmode'],'loop');
  assert.equal(metadata['time.mode'],'off');
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
  assert.equal(view.getUint16(34,true),16);
  assert.equal(view.getUint32(24,true),26040);
  const dataOffset=bytes.findIndex((_,i)=>ascii(i,4)==='data');
  assert.ok(dataOffset>0);
});

test('WAV encoder supports 8-bit output',async()=>{
  const b=buffer(2,1,9387);
  b.getChannelData(0).set([-1,1]);
  const blob=await encodeWav(b,8);
  const bytes=new Uint8Array(await blob.arrayBuffer());
  const view=new DataView(bytes.buffer);
  assert.equal(view.getUint16(34,true),8);
  const dataOffset=bytes.findIndex((_,i)=>String.fromCharCode(...bytes.slice(i,i+4))==='data')+8;
  assert.equal(bytes[dataOffset],0);
  assert.equal(bytes[dataOffset+1],255);
});


test('16-bit quantization is actually applied',async()=>{
  const b=buffer(2,1,44100);
  b.getChannelData(0).set([0.1234567,-0.654321]);
  const out=await quantizeBuffer(b,16);
  assert.notEqual(out.getChannelData(0)[0],b.getChannelData(0)[0]);
});

test('normalize reaches digital full scale without changing silence',async()=>{
  const b=buffer(3,1,44100);
  b.getChannelData(0).set([-.25,.5,.125]);
  const out=await normalizeBuffer(b);
  assert.ok(Math.abs(out.getChannelData(0)[1]-1)<1e-6);
  const z=buffer(2,1,44100);
  const silent=await normalizeBuffer(z);
  assert.deepEqual([...silent.getChannelData(0)],[0,0]);
});

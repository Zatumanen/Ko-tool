import test from 'node:test';
import assert from 'node:assert/strict';

class TestAudioBuffer{
  constructor({length,sampleRate,numberOfChannels}){
    this.length=length;
    this.sampleRate=sampleRate;
    this.numberOfChannels=numberOfChannels;
    this.duration=length/sampleRate;
    this._channels=Array.from({length:numberOfChannels},()=>new Float32Array(length));
  }
  getChannelData(index){return this._channels[index];}
}
globalThis.AudioBuffer=TestAudioBuffer;

const{
  clampWaveformSelection,cropAudioBuffer,audioBufferPeak,gainDbToLinear,
  applyGainToAudioBuffer,normalizeAudioBufferPeak,buildWaveformPeaks,renderWaveformEdit
}=await import('../js/audio/waveform-editor.js');

const make=(length=100,channels=1,sampleRate=100)=>{
  const buffer=new TestAudioBuffer({length,sampleRate,numberOfChannels:channels});
  for(let channel=0;channel<channels;channel++){
    const data=buffer.getChannelData(channel);
    for(let index=0;index<length;index++)data[index]=Math.sin(index*.2)*(channel?0.25:0.5);
  }
  return buffer;
};

test('waveform selection clamps, swaps and keeps at least one sample',()=>{
  const buffer=make(100,1,100);
  assert.deepEqual(clampWaveformSelection(buffer,.2,.8),{start:.2,end:.8,duration:.6000000000000001,totalDuration:1});
  assert.deepEqual(clampWaveformSelection(buffer,.8,.2),{start:.2,end:.8,duration:.6000000000000001,totalDuration:1});
  const collapsed=clampWaveformSelection(buffer,.5,.5);
  assert.equal(collapsed.start,.5);
  assert.ok(collapsed.end>collapsed.start);
  assert.equal(clampWaveformSelection(buffer,-1,99).end,1);
});

test('waveform crop preserves sample rate/channels and copies the selected frame range',()=>{
  const buffer=make(100,2,100);
  const out=cropAudioBuffer(buffer,.2,.6);
  assert.equal(out.length,40);
  assert.equal(out.sampleRate,100);
  assert.equal(out.numberOfChannels,2);
  assert.equal(out.getChannelData(0)[0],buffer.getChannelData(0)[20]);
  assert.equal(out.getChannelData(1)[39],buffer.getChannelData(1)[59]);
});

test('waveform gain and normalize are non-destructive and normalize both quiet and hot buffers',()=>{
  const buffer=new TestAudioBuffer({length:3,sampleRate:100,numberOfChannels:1});
  buffer.getChannelData(0).set([-.25,.5,.125]);
  const louder=applyGainToAudioBuffer(buffer,6.020599913279624);
  assert.ok(Math.abs(louder.getChannelData(0)[1]-1)<1e-5);
  assert.equal(buffer.getChannelData(0)[1],.5);
  assert.ok(Math.abs(gainDbToLinear(-6)-.501187)<1e-5);

  const hot=new TestAudioBuffer({length:2,sampleRate:100,numberOfChannels:1});
  hot.getChannelData(0).set([2,-.5]);
  const normalized=normalizeAudioBufferPeak(hot);
  assert.ok(Math.abs(audioBufferPeak(normalized)-1)<1e-6);
  assert.ok(Math.abs(normalized.getChannelData(0)[1]+.25)<1e-6);
});

test('waveform peak builder returns bounded bins for the requested viewport',()=>{
  const buffer=make(1000,1,1000);
  const peaks=buildWaveformPeaks(buffer,{start:.2,end:.4,bins:25});
  assert.equal(peaks.length,25);
  for(const peak of peaks){
    assert.ok(peak.min<=0);
    assert.ok(peak.max>=0);
    assert.ok(peak.min>=-1&&peak.max<=1);
  }
});

test('waveform edit renders cropped 16-bit EP-ready WAV with gain/normalize metadata',async()=>{
  const buffer=new TestAudioBuffer({length:100,sampleRate:100,numberOfChannels:1});
  for(let index=0;index<100;index++)buffer.getChannelData(0)[index]=Math.sin(index*.1)*.25;
  const edited=await renderWaveformEdit(buffer,{
    start:.25,end:.75,gainDb:6,normalize:true,playmode:'loop'
  });
  assert.equal(edited.buffer.length,50);
  assert.equal(edited.epStorage.frames,50);
  assert.equal(edited.epStorage.bytes,100);
  assert.equal(edited.edit.start,.25);
  assert.equal(edited.edit.end,.75);
  assert.equal(edited.edit.gainDb,6);
  assert.equal(edited.edit.normalize,true);
  assert.ok(audioBufferPeak(edited.buffer)<=1);

  const bytes=new Uint8Array(await edited.blob.arrayBuffer());
  const view=new DataView(bytes.buffer);
  assert.equal(String.fromCharCode(...bytes.slice(0,4)),'RIFF');
  assert.equal(view.getUint16(34,true),16);
  assert.equal(view.getUint32(24,true),100);
  assert.equal(view.getUint32(bytes.findIndex((_,i)=>String.fromCharCode(...bytes.slice(i,i+4))==='data')+4,true),100);
});


test('waveform editor browser modules pass Node syntax checks',async()=>{
  const{execFileSync}=await import('node:child_process');
  const{fileURLToPath}=await import('node:url');
  for(const relative of ['../js/waveform-editor.js','../js/audio/waveform-editor.js','../js/app.js']){
    execFileSync(process.execPath,['--check',fileURLToPath(new URL(relative,import.meta.url))],{stdio:'pipe'});
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import{referenceModuleProvider}from './helpers/reference-audio-module.mjs';

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
  CHOP_TRANSIENT_DEFAULTS,normalizeChopCuts,buildEvenChopCuts,detectTransientChopCuts,
  addChopCut,moveChopCut,removeChopCut,getChopRanges,nearestChopCutIndex,renderChopWavs
}=await import('../js/audio/chop.js');

const makeBuffer=(length=2000,sampleRate=1000,channels=1)=>
  new TestAudioBuffer({length,sampleRate,numberOfChannels:channels});

test('transient detector follows the CHOPCHOP-inspired 500 Hz/RMS/prominence defaults',()=>{
  assert.deepEqual(CHOP_TRANSIENT_DEFAULTS,{
    analysisHz:500,
    rmsWindowMs:20,
    hopMs:5,
    neighborhoodMs:80,
    baselineMs:400,
    attackBacktrackRatio:.3,
    minSpacingMs:50,
    manualMinSpacingMs:5
  });

  const buffer=makeBuffer();
  const data=buffer.getChannelData(0);
  for(let index=0;index<data.length;index++)data[index]=Math.sin(index*.017)*.003;
  for(const attack of [300,800,1300]){
    for(let offset=0;offset<100;offset++){
      const envelope=Math.exp(-offset/25);
      data[attack+offset]+=Math.sin(offset*.9)*envelope;
    }
  }

  const cuts=detectTransientChopCuts(buffer,{slices:4});
  assert.equal(cuts[0],0);
  assert.ok(cuts.length>=3);
  const nonzero=cuts.slice(1);
  for(const expected of [300,800,1300]){
    assert.ok(nonzero.some(frame=>Math.abs(frame-expected)<=100),`missing transient near ${expected}: ${cuts}`);
  }
  for(let index=1;index<cuts.length;index++)assert.ok(cuts[index]-cuts[index-1]>=50);
});

test('equal chop mode creates the requested number of contiguous slices',()=>{
  const buffer=makeBuffer(1000,1000);
  assert.deepEqual(buildEvenChopCuts(buffer,4),[0,250,500,750]);
  const ranges=getChopRanges(buffer,buildEvenChopCuts(buffer,4));
  assert.deepEqual(ranges.map(range=>range.frames),[250,250,250,250]);
  assert.equal(ranges.at(-1).endFrame,1000);
});

test('manual chop markers sort, dedupe, move and never remove the zero anchor',()=>{
  const buffer=makeBuffer(1000,1000);
  assert.deepEqual(normalizeChopCuts(buffer,[500,0,250,251,999]),[0,250,500,999]);
  let cuts=addChopCut(buffer,[0,500],250);
  assert.deepEqual(cuts,[0,250,500]);
  cuts=moveChopCut(buffer,cuts,1,300);
  assert.deepEqual(cuts,[0,300,500]);
  assert.equal(nearestChopCutIndex(buffer,cuts,305),1);
  cuts=removeChopCut(buffer,cuts,1);
  assert.deepEqual(cuts,[0,500]);
  assert.deepEqual(removeChopCut(buffer,cuts,0),[0,500]);
});

test('manual markers enforce a 5 ms minimum spacing without affecting transient 50 ms policy',()=>{
  const buffer=makeBuffer(1000,1000);
  assert.deepEqual(addChopCut(buffer,[0,100],103),[0,100]);
  assert.deepEqual(addChopCut(buffer,[0,100],106),[0,100,106]);
});

test('renderChopWavs emits one independent 16-bit WAV per chop range',async()=>{
  const buffer=makeBuffer(1000,1000,2);
  for(let channel=0;channel<2;channel++){
    const data=buffer.getChannelData(channel);
    for(let index=0;index<data.length;index++)data[index]=Math.sin(index*.05)*(channel?0.2:0.4);
  }
  const outputs=await renderChopWavs(buffer,[0,250,700],{
    gainDb:-3,
    normalize:true,
    playmode:'loop',
    referenceModuleProvider
  });
  assert.equal(outputs.length,3);
  assert.deepEqual(outputs.map(output=>output.frames),[250,450,300]);
  assert.deepEqual(outputs.map(output=>output.buffer.length),[250,450,300]);
  for(const output of outputs){
    assert.equal(output.blob.type,'audio/wav');
    const bytes=new Uint8Array(await output.blob.arrayBuffer());
    const view=new DataView(bytes.buffer);
    assert.equal(String.fromCharCode(...bytes.slice(0,4)),'RIFF');
    assert.equal(view.getUint16(34,true),16);
    assert.equal(view.getUint32(24,true),1000);
  }
});

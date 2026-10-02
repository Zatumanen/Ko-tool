import test from 'node:test';
import assert from 'node:assert/strict';

class TestAudioBuffer{
  constructor({length,sampleRate,numberOfChannels}){
    this.length=length;this.sampleRate=sampleRate;this.numberOfChannels=numberOfChannels;this.duration=length/sampleRate;
    this._channels=Array.from({length:numberOfChannels},()=>new Float32Array(length));
  }
  getChannelData(index){return this._channels[index];}
}
globalThis.AudioBuffer=TestAudioBuffer;

const{createWaveformModel}=await import('../js/audio/waveformModel.js');
const make=()=>new TestAudioBuffer({length:1000,sampleRate:1000,numberOfChannels:1});

test('shared waveform model owns selection, zoom, gain and playhead state without DOM',()=>{
  const model=createWaveformModel(make());
  model.setSelection(.2,.8);
  model.setPlayhead(.5);
  model.setZoom(4);
  model.setGainDb(6);
  model.setNormalize(true);
  const state=model.getState();
  assert.equal(state.selection.start,.2);
  assert.equal(state.selection.end,.8);
  assert.equal(state.playhead,.5);
  assert.equal(state.zoom,4);
  assert.equal(state.gainDb,6);
  assert.equal(state.normalize,true);
  assert.deepEqual(model.viewRange(),{start:.375,end:.625});
});

test('shared waveform model drives even and manual chop state through the pure chop engine',()=>{
  const model=createWaveformModel(make());
  model.setChopTarget(4);
  model.setChopMode('even');
  assert.deepEqual(model.getState().chop.cuts,[0,250,500,750]);
  assert.deepEqual(model.getChopRanges().map(range=>range.frames),[250,250,250,250]);
  model.addCut(125);
  assert.equal(model.getState().chop.mode,'manual');
  assert.deepEqual(model.getState().chop.cuts,[0,125,250,500,750]);
  model.moveCut(1,150);
  assert.deepEqual(model.getState().chop.cuts,[0,150,250,500,750]);
  model.removeCut(1);
  assert.deepEqual(model.getState().chop.cuts,[0,250,500,750]);
});

test('shared waveform model reset returns to a full non-destructive recipe',()=>{
  const model=createWaveformModel(make(),{selection:{start:.1,end:.4},zoom:8,gainDb:-6,normalize:true,chopMode:'even',chopTarget:3});
  model.reset();
  const state=model.getState();
  assert.deepEqual(state.selection,{start:0,end:1,duration:1,totalDuration:1});
  assert.equal(state.playhead,0);
  assert.equal(state.zoom,1);
  assert.equal(state.gainDb,0);
  assert.equal(state.normalize,false);
  assert.deepEqual(state.chop.cuts,[0]);
  assert.equal(state.chop.mode,'manual');
});

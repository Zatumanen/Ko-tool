import test from 'node:test';
import assert from 'node:assert/strict';
import{createVisualsAudio}from '../js/visuals/audio.js';

function makeTrack(){
  return{label:'EP USB AUDIO',readyState:'live',onended:null,
    getSettings:()=>({channelCount:2}),
    stop(){this.readyState='ended'}};
}
function makeStream(){
  const track=makeTrack();
  return{track,getTracks:()=>[track],getAudioTracks:()=>[track]};
}
class FakeAudioContext{
  constructor(){this.sampleRate=48000;this.destination={};this.closed=false}
  createMediaStreamSource(){return{connect(){},disconnect(){}}}
  createChannelSplitter(){return{connect(){},disconnect(){}}}
  createAnalyser(){
    return{fftSize:2048,smoothingTimeConstant:0,
      connect(){},disconnect(){},
      getFloatTimeDomainData(array){array.fill(.2)},
      getByteFrequencyData(array){array.fill(64)}};
  }
  createGain(){return{gain:{value:1},connect(){},disconnect(){}}}
  async resume(){}
  async close(){this.closed=true}
}
test('capture requests exact selected source, measures genuine graph data and stops all tracks',async()=>{
  let constraints;
  const stream=makeStream(),states=[];
  const nav={mediaDevices:{
    async enumerateDevices(){return[{kind:'audioinput',deviceId:'ep-usb',label:'EP USB AUDIO'},{kind:'videoinput',deviceId:'cam'}]},
    async getUserMedia(c){constraints=c;return stream}
  }};
  const a=createVisualsAudio({navigatorRef:nav,AudioContextClass:FakeAudioContext,onState:s=>states.push(s)});
  assert.deepEqual(await a.inputs(),[{id:'ep-usb',label:'EP USB AUDIO'}]);
  a.select('ep-usb');assert.equal(await a.start(),true);
  assert.equal(constraints.audio.deviceId.exact,'ep-usb');
  assert.equal(constraints.video,false);
  assert.equal(constraints.audio.echoCancellation,false);
  assert.equal(a.active,true);
  const data=a.sample();
  assert.equal(data.channelCount,2);
  assert.ok(data.rms>.15&&data.rms<.25);
  assert.ok(data.frequency[20]===64);
  assert.ok(data.correlation>.99);
  a.stop();
  assert.equal(a.active,false);
  assert.equal(stream.track.readyState,'ended');
  assert.equal(a.sample(),null);
  assert.ok(states.some(s=>s.active));
});
test('permission denial and absent selection never claim live',async()=>{
  let called=false;
  const nav={mediaDevices:{async getUserMedia(){called=true;throw Object.assign(Error('Denied'),{name:'NotAllowedError'})}}};
  const a=createVisualsAudio({navigatorRef:nav,AudioContextClass:FakeAudioContext});
  await assert.rejects(()=>a.start(),/Сначала выберите/);
  assert.equal(called,false);
  a.select('id');
  assert.equal(await a.start(),false);
  assert.equal(a.active,false);
});
test('stop during pending permission immediately releases a late stream',async()=>{
  let resolve;
  const pending=new Promise(r=>resolve=r),stream=makeStream();
  const nav={mediaDevices:{getUserMedia:()=>pending}};
  const a=createVisualsAudio({navigatorRef:nav,AudioContextClass:FakeAudioContext});
  a.select('ep-usb');const start=a.start();
  a.stop('Closed Visuals');
  resolve(stream);
  assert.equal(await start,false);
  assert.equal(stream.track.readyState,'ended');
  assert.equal(a.active,false);
});
test('source change stops an existing capture without silently starting a replacement',async()=>{
  const first=makeStream(),nav={mediaDevices:{getUserMedia:async()=>first}};
  const a=createVisualsAudio({navigatorRef:nav,AudioContextClass:FakeAudioContext});
  a.select('ep-usb');assert.equal(await a.start(),true);
  a.select('mic-other');
  assert.equal(first.track.readyState,'ended');
  assert.equal(a.active,false);
  assert.equal(a.selectedId,'mic-other');
});

test('explicit input discovery releases temporary default device before selecting EP',async()=>{
  const temporary=makeStream();
  let askedForDefault=false;
  const nav={mediaDevices:{
    async getUserMedia(constraints){askedForDefault=constraints.audio===true;return temporary},
    async enumerateDevices(){return[{kind:'audioinput',deviceId:'ep-usb',label:'EP USB AUDIO'}]}
  }};
  const a=createVisualsAudio({navigatorRef:nav,AudioContextClass:FakeAudioContext});
  const found=await a.unlockInputs();
  assert.equal(askedForDefault,true);
  assert.equal(temporary.track.readyState,'ended');
  assert.deepEqual(found,[{id:'ep-usb',label:'EP USB AUDIO'}]);
  assert.equal(a.active,false);
  assert.equal(a.selectedId,'');
});

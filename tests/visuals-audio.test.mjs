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
      getFloatFrequencyData(array){array.fill(-60)},
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
  assert.equal(data.output.status,'unsupported','never substitute render-time peaks without AudioWorklet');
  assert.ok(data.rms>.15&&data.rms<.25);
  assert.ok(data.frequency[20]===64);
  assert.equal(data.spectrumDb.length,4096);assert.equal(data.spectrumDb[20],-60);
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
test('a superseded START finishing resume cannot stop the newly selected live input',async t=>{
  let finishOldResume,enteredOldResume;
  const oldResume=new Promise(resolve=>{finishOldResume=resolve});
  const oldResuming=new Promise(resolve=>{enteredOldResume=resolve});
  const contexts=[];
  class DelayedAudioContext extends FakeAudioContext{
    constructor(){super();contexts.push(this)}
    resume(){
      if(contexts.indexOf(this)===0){enteredOldResume();return oldResume}
      return Promise.resolve();
    }
  }
  const streams=[makeStream(),makeStream()],requests=[];
  const a=createVisualsAudio({
    navigatorRef:{mediaDevices:{async getUserMedia(constraints){
      requests.push(constraints.audio.deviceId.exact);
      return streams[requests.length-1];
    }}},
    AudioContextClass:DelayedAudioContext
  });
  t.after(()=>a.stop());
  a.select('old-input');
  const firstStart=a.start();
  await oldResuming;
  a.select('new-input');
  assert.equal(await a.start(),true);
  assert.equal(a.active,true);

  finishOldResume();
  assert.equal(await firstStart,false);
  assert.deepEqual(requests,['old-input','new-input']);
  assert.equal(a.selectedId,'new-input');
  assert.equal(a.active,true,'the stale START must leave the new capture live');
  assert.notEqual(a.sample(),null);
  assert.equal(streams[0].track.readyState,'ended');
  assert.equal(streams[1].track.readyState,'live');
  assert.equal(contexts[0].closed,true);
  assert.equal(contexts[1].closed,false);
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

test('permission discovery stops temporary capture before a pending enumeration completes',async()=>{
  const temporary=makeStream();let finish,entered;
  const enumerating=new Promise(r=>entered=r);
  const pending=new Promise(r=>finish=r);
  const a=createVisualsAudio({navigatorRef:{mediaDevices:{
    getUserMedia:async()=>temporary,
    enumerateDevices:()=>{entered();return pending}
  }},AudioContextClass:FakeAudioContext});
  const discovery=a.unlockInputs();await enumerating;
  const during=temporary.track.readyState;
  finish([]);await discovery;
  assert.equal(during,'ended','permission-only capture must not wait for device enumeration');
  assert.equal(a.active,false);
});

test('enumeration failure leaves permission-only tracks stopped',async()=>{
  const temporary=makeStream();
  const a=createVisualsAudio({navigatorRef:{mediaDevices:{getUserMedia:async()=>temporary,
    enumerateDevices:async()=>{throw Error('enumeration unavailable')}
  }},AudioContextClass:FakeAudioContext});
  await assert.rejects(()=>a.unlockInputs(),/enumeration unavailable/);
  assert.equal(temporary.track.readyState,'ended');assert.equal(a.active,false);
});

test('output packets honor reset epochs, capture ownership and cleanup',async t=>{
 let clock=0;t.mock.method(performance,'now',()=>clock);
 const previous=globalThis.AudioWorkletNode,nodes=[];
 globalThis.AudioWorkletNode=class{
  constructor(context,name,options){this.name=name;this.options=options;this.port={onmessage:null,sent:[],postMessage:x=>this.port.sent.push(x),close:()=>{this.closed=true}};nodes.push(this);}
  connect(){}disconnect(){}
 };
 t.after(()=>{if(previous===undefined)delete globalThis.AudioWorkletNode;else globalThis.AudioWorkletNode=previous;});
 class WorkletContext extends FakeAudioContext{constructor(){super();this.audioWorklet={addModule:async()=>{}}}}
 const stream=makeStream(),a=createVisualsAudio({navigatorRef:{mediaDevices:{getUserMedia:async()=>stream}},AudioContextClass:WorkletContext});
 a.select('selected');assert.equal(await a.start(),true);const node=nodes.find(n=>n.name==='visuals-output-meters'),deliver=node.port.onmessage;
 assert.equal(node.options.channelCountMode,'clamped-max');assert.equal(node.options.channelCount,2);
 deliver({data:{epoch:0,status:'ready',channelCount:2,peak:[1,0],hold:[1,0],clip:[true,false]}});
 assert.equal(a.sample().output.clip[0],true);clock=501;assert.equal(a.sample().output.status,'stale');a.resetOutputMeters();assert.equal(a.sample().output.status,'pending');
 deliver({data:{epoch:0,status:'ready',clip:[true,true]}});assert.equal(a.sample().output.status,'pending');
 deliver({data:{epoch:1,status:'ready',clip:[false,false]}});assert.equal(a.sample().output.clip[0],false);
 a.stop();assert.equal(node.closed,true);assert.equal(node.port.onmessage,null);deliver({data:{epoch:1,status:'ready'}});assert.equal(a.sample(),null);
});
test('changed channel format stops capture instead of displaying fabricated output channels',async()=>{
 const stream=makeStream();let channels=2;stream.track.getSettings=()=>({channelCount:channels});const states=[];
 const a=createVisualsAudio({navigatorRef:{mediaDevices:{getUserMedia:async()=>stream}},AudioContextClass:FakeAudioContext,onState:s=>states.push(s)});
 a.select('input');await a.start();channels=1;assert.equal(a.sample(),null);assert.equal(a.active,false);assert.equal(stream.track.readyState,'ended');assert.equal(states.at(-1).reason,'channel-format');
});
test('RESET during worklet loading cannot strand the first measurement behind a stale epoch',async t=>{
 const previous=globalThis.AudioWorkletNode,nodes=[];let finish,entered;
 const waiting=new Promise(r=>entered=r),loading=new Promise(r=>finish=r);
 globalThis.AudioWorkletNode=class{constructor(context,name){this.name=name;this.port={onmessage:null,postMessage(){},close(){}};nodes.push(this)}connect(){}disconnect(){}};
 t.after(()=>{if(previous===undefined)delete globalThis.AudioWorkletNode;else globalThis.AudioWorkletNode=previous});
 class LoadingContext extends FakeAudioContext{constructor(){super();this.audioWorklet={addModule:async url=>{if(url.includes('outputMetersWorklet')){entered();await loading}}}}}
 const a=createVisualsAudio({navigatorRef:{mediaDevices:{getUserMedia:async()=>makeStream()}},AudioContextClass:LoadingContext});t.after(()=>a.stop());a.select('input');
 const starting=a.start();await waiting;a.resetOutputMeters();finish();assert.equal(await starting,true);
 nodes.find(n=>n.name==='visuals-output-meters').port.onmessage({data:{epoch:0,status:'ready',channelCount:2,peak:[.5,0],hold:[.5,0],clip:[false,false]}});
 assert.equal(a.sample().output.status,'ready');
});
test('a known multichannel change invalidates the two-channel meter instead of downmixing silently',async()=>{
 const stream=makeStream();let channels=2;stream.track.getSettings=()=>({channelCount:channels});
 const a=createVisualsAudio({navigatorRef:{mediaDevices:{getUserMedia:async()=>stream}},AudioContextClass:FakeAudioContext});a.select('input');await a.start();
 channels=3;assert.equal(a.sample(),null);assert.equal(a.active,false);assert.equal(stream.track.readyState,'ended');
});
test('missing channel metadata never forces or labels the selected stream as measured mono',async t=>{
 const previous=globalThis.AudioWorkletNode,nodes=[];
 globalThis.AudioWorkletNode=class{constructor(context,name){nodes.push(name);this.port={onmessage:null,postMessage(){},close(){}}}connect(){}disconnect(){}};
 t.after(()=>{if(previous===undefined)delete globalThis.AudioWorkletNode;else globalThis.AudioWorkletNode=previous});
 class WorkletContext extends FakeAudioContext{constructor(){super();this.audioWorklet={addModule:async()=>{}}}}
 const stream=makeStream();stream.track.getSettings=()=>({});
 const a=createVisualsAudio({navigatorRef:{mediaDevices:{getUserMedia:async()=>stream}},AudioContextClass:WorkletContext});t.after(()=>a.stop());a.select('input');assert.equal(await a.start(),true);
 assert.equal(a.sample().output.status,'unknown-format');assert.equal(nodes.includes('visuals-output-meters'),false);
});
test('an initially unsupported multichannel input is rejected and fully released',async()=>{
 const stream=makeStream();stream.track.getSettings=()=>({channelCount:6});
 const a=createVisualsAudio({navigatorRef:{mediaDevices:{getUserMedia:async()=>stream}},AudioContextClass:FakeAudioContext});a.select('input');assert.equal(await a.start(),false);assert.equal(a.active,false);assert.equal(stream.track.readyState,'ended');
});

test('LUFS reset epoch and capture generation reject stale worklet results without reopening input',async()=>{
 const nodes=[];let requested=0;
 class WorkletNode{
  constructor(_ctx,name){this.name=name;this.messages=[];this.port={onmessage:null,postMessage:m=>this.messages.push(m),close:()=>{this.closed=true}};nodes.push(this)}
  connect(){}disconnect(){}
 }
 class WorkletContext extends FakeAudioContext{constructor(){super();this.audioWorklet={addModule:async()=>{}}}}
 globalThis.AudioWorkletNode=WorkletNode;
 const a=createVisualsAudio({navigatorRef:{mediaDevices:{getUserMedia:async()=>{requested++;return makeStream()}}},AudioContextClass:WorkletContext});
 try{
  a.select('input');assert.equal(await a.start(),true);const node=nodes.find(n=>n.name==='visuals-loudness'),epoch=node.messages[0].reset;
  node.port.onmessage({data:{epoch,integrated:-20}});assert.equal(a.sample().loudness.integrated,-20);
  a.resetLoudness();assert.equal(requested,1);assert.equal(a.sample().loudness,null);
  node.port.onmessage({data:{epoch,integrated:-10}});assert.equal(a.sample().loudness,null);
  const next=node.messages.findLast(m=>m.reset!==undefined).reset;node.port.onmessage({data:{epoch:next,integrated:-30}});assert.equal(a.sample().loudness.integrated,-30);
  node.onprocessorerror();node.port.onmessage({data:{epoch:next,integrated:0}});a.resetLoudness();assert.match(a.sample().loudness.error,/failed/);
  const late=node.port.onmessage;a.stop();late({data:{epoch:next,integrated:0}});assert.equal(a.sample(),null);assert.equal(node.closed,true);
 }finally{a.stop();delete globalThis.AudioWorkletNode;}
});

test('a changed channel format invalidates capture instead of retaining stale stereo metrics',async()=>{
 let channels=2;const stream=makeStream();stream.track.getSettings=()=>({channelCount:channels});
 const a=createVisualsAudio({navigatorRef:{mediaDevices:{getUserMedia:async()=>stream}},AudioContextClass:FakeAudioContext});
 a.select('input');assert.equal(await a.start(),true);assert.notEqual(a.sample(),null);
 channels=1;assert.equal(a.sample(),null);assert.equal(a.active,false);assert.equal(stream.track.readyState,'ended');
});

test('recorder receives the exact existing capture graph and is detached on release',async()=>{
 let opened=0,attached=null,detached=0;const stream=makeStream();
 const recorder={attach:g=>{attached=g},detach:()=>{detached++}};
 const audio=createVisualsAudio({navigatorRef:{mediaDevices:{getUserMedia:async()=>{opened++;return stream}}},AudioContextClass:FakeAudioContext,recorder});
 audio.select('chosen');await audio.start();assert.equal(opened,1);assert.equal(attached.channelCount,2);assert.equal(attached.context.sampleRate,48000);assert.equal(attached.getChannelCount(),2);const before=detached;audio.stop();assert.equal(detached,before+1);assert.equal(stream.track.readyState,'ended');
});
test('a pending recorder STOP cannot tear down a superseding audio capture',async()=>{
 let finish;const pending=new Promise(r=>finish=r),streams=[makeStream(),makeStream()];let requests=0;
 const recorder={attach(){},detach(){},snapshot:()=>({state:'recording'}),stop:()=>pending};
 const audio=createVisualsAudio({navigatorRef:{mediaDevices:{getUserMedia:async()=>streams[requests++]}},AudioContextClass:FakeAudioContext,recorder});
 audio.select('old');await audio.start();assert.equal(typeof audio.finishAndStop,'function');const stopping=audio.finishAndStop();
 audio.select('new');await audio.start();finish(true);assert.equal(await stopping,false);assert.equal(audio.active,true);assert.equal(audio.selectedId,'new');assert.equal(streams[1].track.readyState,'live');audio.stop();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import{createFakeReferenceAudioModule}from './helpers/reference-audio-module.mjs';
import{processAudio,processAudioInputs,EP_AUDIO_PIPELINE_STAGES}from '../js/audio/processor.js';
import{inspectEpReadyWav,parseWavAudioMeta}from '../js/ep133/audio.js';

class TestAudioBuffer{
  constructor({length,sampleRate,numberOfChannels}){
    this.length=length;this.sampleRate=sampleRate;this.numberOfChannels=numberOfChannels;
    this.channels=Array.from({length:numberOfChannels},()=>new Float32Array(length));
  }
  getChannelData(channel){return this.channels[channel];}
}
globalThis.AudioBuffer=TestAudioBuffer;
const suite=JSON.parse(await fs.readFile(new URL('./fixtures/audio/x2-pipeline-v1.json',import.meta.url),'utf8'));
const ascii=(view,offset,text)=>{
  for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));
};
const clamp=value=>Math.max(-1,Math.min(1,value));
function makeSourceWav(source){
  const{frames,channels,sampleRate,encoding,channelValues=[],channelDefaults=[]}=source;
  const formats={pcm8:{format:1,bits:8,bytes:1},pcm16:{format:1,bits:16,bytes:2},
    pcm24:{format:1,bits:24,bytes:3},pcm32:{format:1,bits:32,bytes:4},
    float32:{format:3,bits:32,bytes:4}};
  const type=formats[encoding];
  if(!type)throw new Error('Invalid golden source encoding: '+encoding);
  const dataSize=frames*channels*type.bytes,bytes=new Uint8Array(44+dataSize),view=new DataView(bytes.buffer);
  ascii(view,0,'RIFF');view.setUint32(4,36+dataSize,true);ascii(view,8,'WAVE');
  ascii(view,12,'fmt ');view.setUint32(16,16,true);
  view.setUint16(20,type.format,true);view.setUint16(22,channels,true);
  view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*channels*type.bytes,true);
  view.setUint16(32,channels*type.bytes,true);view.setUint16(34,type.bits,true);
  ascii(view,36,'data');view.setUint32(40,dataSize,true);
  for(let frame=0;frame<frames;frame++)for(let channel=0;channel<channels;channel++){
    const x=clamp(Number(channelValues[channel]?.[frame]??channelDefaults[channel]??0));
    const offset=44+(frame*channels+channel)*type.bytes;
    if(encoding==='pcm8')view.setUint8(offset,Math.round((x+1)*127.5));
    else if(encoding==='pcm16')view.setInt16(offset,Math.round(x*(x<0?32768:32767)),true);
    else if(encoding==='pcm24'){
      const value=Math.round(x*(x<0?8388608:8388607));
      for(let i=0;i<3;i++)view.setUint8(offset+i,(value>>(8*i))&0xff);
    }else if(encoding==='pcm32')view.setInt32(offset,Math.round(x*(x<0?2147483648:2147483647)),true);
    else view.setFloat32(offset,x,true);
  }
  return bytes.buffer;
}
const hex=bytes=>Buffer.from(bytes).toString('hex');
const fakeModule=createFakeReferenceAudioModule();
const formats=[{type:'pcm',formats:[{
  format:'s16',channels:[1,2],'samplerate.range':[3000,46875]
}]}];

test('golden suite is pinned with representative source formats and x2 targets',()=>{
  assert.equal(suite.schemaVersion,1);
  assert.equal(suite.pipeline,'speeduppercut-x2-reference-v1');
  assert.equal(new Set(suite.cases.map(entry=>entry.id)).size,suite.cases.length);
  assert.deepEqual(new Set(suite.cases.map(entry=>entry.source.encoding)),
    new Set(['pcm8','pcm16','pcm24','pcm32','float32']));
  assert.deepEqual(new Set(suite.cases.map(entry=>entry.options.fidelity)),
    new Set(['hi','mid','lo']));
  assert.ok(suite.cases.some(entry=>entry.source.channels===1));
  assert.ok(suite.cases.some(entry=>entry.source.channels===2));
  assert.deepEqual(EP_AUDIO_PIPELINE_STAGES,[
    'decode','trim','channels','x2-reference-resample',
    'peak-normalize','s16-quantize','reference-wav'
  ]);
});

for(const golden of suite.cases){
  test('golden PCM/WAV: '+golden.id,async()=>{
    const input=makeSourceWav(golden.source),stages=[];
    const result=await processAudio(input,golden.options,{
      referenceModule:fakeModule,stage:value=>stages.push(value)
    });
    const bytes=new Uint8Array(await result.blob.arrayBuffer());
    const inspected=inspectEpReadyWav(bytes,{formats,targetSampleRate:golden.expected.sampleRate});
    const wav=parseWavAudioMeta(bytes);
    assert.ok(inspected,'Must be a valid EP-compatible WAV');
    assert.equal(wav.format,1);
    assert.equal(wav.bits,16);
    assert.equal(wav.rate,golden.expected.sampleRate);
    assert.equal(wav.channels,golden.expected.channels);
    assert.equal(inspected.data.length,golden.expected.frames*golden.expected.channels*2);
    assert.equal(hex(inspected.data),golden.expected.pcmHex);
    assert.equal(result.epStorage.frames,golden.expected.frames);
    assert.equal(result.sampleRate,golden.expected.sampleRate);
    assert.equal(result.repitchFactor,2);
    assert.equal(result.metadata['sound.pitch'],-12);
    assert.equal(inspected.metadata['sound.pitch'],-12);
    assert.equal(inspected.metadata['sound.playmode'],golden.expected.playmode);
    assert.equal(inspected.metadata['time.mode'],'off');
    assert.deepEqual(stages,EP_AUDIO_PIPELINE_STAGES.filter(stage=>stage!=='trim'));
  });
}

test('one-file and folder/batch entry points are byte-exact for every golden input',async()=>{
  const files=suite.cases.map(golden=>({
    name:golden.id+'.wav',
    arrayBuffer:async()=>makeSourceWav(golden.source)
  }));
  const singles=[];
  for(let i=0;i<files.length;i++){
    const r=await processAudio(await files[i].arrayBuffer(),suite.cases[i].options,{
      referenceModule:fakeModule
    });
    singles.push(new Uint8Array(await r.blob.arrayBuffer()));
  }
  const observedStages=[],batches=[],progress=[];
  // This intentionally tests a multi-file batch. The options match the single
  // processing path and every result is compared to a separately run single.
  for(let i=0;i<files.length;i++){
    for await (const entry of processAudioInputs([files[i]],suite.cases[i].options,{
      referenceModule:fakeModule,stage:value=>observedStages.push(value),
      progress:(value,phase,index,total,file)=>progress.push({value,phase,index,total,name:file.name})
    })){
      batches.push(new Uint8Array(await entry.result.blob.arrayBuffer()));
    }
  }
  assert.equal(batches.length,singles.length);
  for(let i=0;i<singles.length;i++)
    assert.deepEqual(batches[i],singles[i],'Single/batch WAV drift for '+suite.cases[i].id);
  assert.equal(progress.filter(item=>item.value===1).length,files.length);
  assert.equal(observedStages.length,files.length*6);
});

test('multi-file input iterator preserves file order and identical per-file options',async()=>{
  const golden=suite.cases[0],input=makeSourceWav(golden.source);
  const files=['a.wav','b.wav','c.wav'].map(name=>({name,arrayBuffer:async()=>input.slice(0)}));
  const results=[],starts=[];
  for await(const item of processAudioInputs(files,golden.options,{
    referenceModule:fakeModule,onStart:(file,index,total)=>starts.push([file.name,index,total])
  })){
    results.push({name:item.file.name,index:item.index,blob:new Uint8Array(await item.result.blob.arrayBuffer())});
  }
  assert.deepEqual(starts,[['a.wav',0,3],['b.wav',1,3],['c.wav',2,3]]);
  assert.deepEqual(results.map(item=>item.name),['a.wav','b.wav','c.wav']);
  assert.deepEqual(results[0].blob,results[1].blob);
  assert.deepEqual(results[1].blob,results[2].blob);
});

test('non-WAV browser decode route matches canonical output when decoded PCM is identical',async()=>{
  const golden=suite.cases[0],input=makeSourceWav(golden.source);
  const reference=await processAudio(input,golden.options,{referenceModule:fakeModule});
  const targetPcm=new Uint8Array(await reference.blob.arrayBuffer());
  const fakeBuffer=new TestAudioBuffer({
    length:golden.source.frames,
    sampleRate:golden.source.sampleRate,
    numberOfChannels:golden.source.channels
  });
  // The artificial AudioContext output is equivalent to 16-bit WAV decode.
  const wave=new DataView(input);
  for(let i=0;i<golden.source.frames;i++){
    const sample=wave.getInt16(44+2*i,true);
    fakeBuffer.getChannelData(0)[i]=sample<0?sample/32768:sample/32767;
  }
  const context={decodeAudioData:async()=>fakeBuffer};
  const browser=await processAudio(Uint8Array.from([0x49,0x44,0x33,0]).buffer,{
    ...golden.options,context
  },{referenceModule:fakeModule});
  assert.deepEqual(new Uint8Array(await browser.blob.arrayBuffer()),targetPcm);
});

test('reference WASM failures never silently downgrade to a different DSP engine',async()=>{
  const golden=suite.cases[0];
  await assert.rejects(()=>processAudio(makeSourceWav(golden.source),golden.options,{
    referenceModuleProvider:async()=>({resampleAudioData:undefined,createWav:()=>new Uint8Array()})
  }),/reference audio module is unavailable/);
});

test('UI single-file and folder flows delegate to the same streaming batch adapter',async()=>{
  const source=await fs.readFile(new URL('../js/app.js',import.meta.url),'utf8');
  assert.match(source,/for await\(const \{file:f,result:r,index:i\} of processAudioInputs\(files,/);
  assert.doesNotMatch(source,/processAudio\(await f\.arrayBuffer\(/);
});

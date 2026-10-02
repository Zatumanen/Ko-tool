import test from 'node:test';
import assert from 'node:assert/strict';
import{
  createSampleWaveformController,validateEditableEpSample
}from '../js/ep133/ui/sampleWaveformController.js';

const bytes=new Uint8Array([0,0,1,0,2,0,3,0]);

test('My EP waveform validation accepts EP s16 PCM and rejects unsupported metadata',()=>{
  assert.deepEqual(validateEditableEpSample({channels:1,samplerate:46875,format:'s16'},bytes),{
    channels:1,sampleRate:46875,data:bytes
  });
  assert.throws(()=>validateEditableEpSample({channels:3,samplerate:46875,format:'s16'},bytes),/mono or stereo/);
  assert.throws(()=>validateEditableEpSample({channels:1,samplerate:0,format:'s16'},bytes),/sample rate/);
  assert.throws(()=>validateEditableEpSample({channels:1,samplerate:46875,format:'float'},bytes),/s16 PCM/);
});

test('My EP waveform controller reads with FILE GET/METADATA only and opens the shared editor',async()=>{
  const calls=[];
  let opened=null;
  const controller=createSampleWaveformController({
    withFileTransaction:async(label,operation)=>{
      calls.push(label);
      return operation({
        getFile:async id=>{calls.push(['getFile',id]);return{name:'kick',data:bytes};},
        getFileMetadata:async id=>{calls.push(['getFileMetadata',id]);return{name:'kick',channels:1,samplerate:46875,format:'s16','sound.playmode':'loop','sound.pitch':3};},
        putFile:()=>{throw new Error('mutation must not be reachable');},
        deleteFile:()=>{throw new Error('mutation must not be reachable');}
      });
    },
    pcmToBuffer:(data,meta)=>({data,meta,getChannelData(){return new Float32Array(4);},length:4,sampleRate:meta.sampleRate,numberOfChannels:meta.channels,duration:4/meta.sampleRate}),
    openEditor:(source,options)=>{opened={source,options};return{close(){}};},
    createZipFn:async()=>new Blob(),
    saveBlob:()=>{},
    reportError:()=>{}
  });
  await controller.open({id:7,nodeId:7,file:{name:'kick'}});
  assert.equal(calls[0],'sample waveform read');
  assert.deepEqual(calls.slice(1),[['getFile',7],['getFileMetadata',7]]);
  assert.equal(opened.source.playmode,'loop');
  assert.equal(opened.source.metadata['sound.pitch'],3);
  assert.equal(opened.options.title,'MY EP · WAVEFORM / CHOP');
  assert.equal(opened.options.applyLabel,'DOWNLOAD EDIT');
  assert.equal(opened.options.exportLabel,'DOWNLOAD CHOPS');
});

test('My EP waveform candidate callbacks save WAV and ZIP locally without device writes',async()=>{
  const saved=[];
  let callbacks=null;
  const controller=createSampleWaveformController({
    withFileTransaction:async(label,operation)=>operation({
      getFile:async()=>({name:'snare',data:bytes}),
      getFileMetadata:async()=>({name:'snare',channels:1,samplerate:46875,format:'s16','sound.playmode':'oneshot'})
    }),
    pcmToBuffer:(data,meta)=>({data,meta,getChannelData(){return new Float32Array(4);},length:4,sampleRate:meta.sampleRate,numberOfChannels:meta.channels,duration:4/meta.sampleRate}),
    openEditor:(source,options)=>{callbacks=options;return{close(){}};},
    createZipFn:async files=>{assert.equal(files.length,2);return new Blob(['zip']);},
    saveBlob:(blob,name)=>saved.push(name),
    reportError:()=>{}
  });
  await controller.open({id:8,nodeId:8,file:{name:'snare'}});
  await callbacks.onApply({blob:new Blob(['wav'])});
  await callbacks.onExportChops([{blob:new Blob(['one'])},{blob:new Blob(['two'])}]);
  assert.deepEqual(saved,['snare-edited.wav','snare-chops.zip']);
});

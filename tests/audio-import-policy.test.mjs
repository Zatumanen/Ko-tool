import test from 'node:test';
import assert from 'node:assert/strict';
import{selectAudioImportFiles,isAudioImportCandidate,describeAudioImportFailure}from '../js/audio/importPolicy.js';
import{processAudioInputs}from '../js/audio/processor.js';

const f=(name,bytes=44,path='')=>({name,size:bytes,webkitRelativePath:path,arrayBuffer:async()=>new ArrayBuffer(bytes)});

test('folder candidate selection skips AppleDouble, __MACOSX, empty, and unrelated files',()=>{
 const inputs=[
  f('kick.wav',64,'Drums/kick.wav'),f('._kick.wav',300,'Drums/._kick.wav'),
  f('snare.wav',64,'__MACOSX/Drums/snare.wav'),f('.DS_Store',100),
  f('empty.wav',0),f('notes.txt',123),f('sample.aiff',54,'Drums/sample.aiff')
 ];
 const result=selectAudioImportFiles(inputs);
 assert.deepEqual(result.accepted.map(x=>x.name),['kick.wav','sample.aiff']);
 assert.equal(result.ignored,5);
 assert.equal(result.total,7);
 assert.equal(isAudioImportCandidate(f('._music.mp3',125)),false);
 assert.equal(isAudioImportCandidate(f('song.M4A',125)),true);
});

test('import decoding error retains individual source path and suggests browser-compatible audio',()=>{
 const msg=describeAudioImportFailure(new Error('Audio decoding failed: Unable to decode data'),f('snare.wav',88,'DRUMS/snare.wav'));
 assert.match(msg,/DRUMS\/snare.wav/);
 assert.match(msg,/PCM WAV/);
 assert.match(msg,/Unable to decode data/);
 assert.match(describeAudioImportFailure(new Error('Something else'),f('bass.ogg',22)),/bass.ogg.*Something else/);
});

test('shared batch generator skips failed inputs ONLY with explicit per-file handler',async()=>{
 const invalid=f('broken.wav',12),other=f('second.wav',12);
 const errors=[];
 const options={};
 const results=[];
 for await(const entry of processAudioInputs([invalid,other],options,{
  onFileError:(error,file,index,total)=>errors.push({name:file.name,index,total})
 }))results.push(entry);
 assert.deepEqual(results,[]);
 assert.deepEqual(errors,[{name:'broken.wav',index:0,total:2},{name:'second.wav',index:1,total:2}]);
 await assert.rejects(async()=>{for await(const item of processAudioInputs([invalid]))void item;});
});

test('batch cancellation never silently skips a file through error-isolation hook',async()=>{
 let attempts=0;
 const file={name:'read.wav',arrayBuffer:async()=>{throw Object.assign(new Error('Cancel'),{name:'AbortError'});}};
 await assert.rejects(async()=>{
  for await(const entry of processAudioInputs([file],{},{
   onFileError:()=>{attempts++;}
  }))void entry;
 },{name:'AbortError'});
 assert.equal(attempts,0);
});

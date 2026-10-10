import test from 'node:test';
import assert from 'node:assert/strict';
import {
 isSupportedShelfFile,shelfRelativePath,filterShelfEntries,
 SHELF_MAX_FILE_BYTES,SHELF_DB_NAME
} from '../os/sampleShelf.js';

test('offline shelf accepts supported real nonempty audio and rejects bad extensions/sizes',()=>{
 const file=(name,size)=>({name,size});
 for(const type of ['wav','mp3','flac','aiff','ogg','m4a','aac']){
  assert.equal(isSupportedShelfFile(file('kick.'+type,100)),true);
 }
 for(const type of ['exe','txt','json','mid']){
  assert.equal(isSupportedShelfFile(file('kick.'+type,100)),false);
 }
 assert.equal(isSupportedShelfFile(file('empty.wav',0)),false);
 assert.equal(isSupportedShelfFile(file('huge.wav',SHELF_MAX_FILE_BYTES+1)),false);
 assert.equal(isSupportedShelfFile(null),false);
 assert.match(SHELF_DB_NAME,/sample-shelf/);
});

test('offline shelf retains folder context but never traverses parent segments',()=>{
 assert.equal(shelfRelativePath({webkitRelativePath:'Drums/Kicks/kick.wav',name:'kick.wav'}),'Drums/Kicks/kick.wav');
 assert.equal(shelfRelativePath({relativePath:'../Drums/./snare.wav',name:'snare.wav'}),'Drums/snare.wav');
 assert.equal(shelfRelativePath({relativePath:'Drums\\Hats\\hat.wav',name:'hat.wav'}),'Drums/Hats/hat.wav');
 assert.equal(shelfRelativePath({name:'dry.wav'}),'dry.wav');
});

test('offline shelf searches both filename and nested folders without mutating entries',()=>{
 const entries=[{name:'Kick A.wav',relativePath:'Drums/Kicks/Kick A.wav'},{name:'SYNTH.flac',relativePath:'Instruments/Synths/SYNTH.flac'}];
 assert.deepEqual(filterShelfEntries(entries,'kick'),[entries[0]]);
 assert.deepEqual(filterShelfEntries(entries,'INSTRUMENTS'),[entries[1]]);
 assert.deepEqual(filterShelfEntries(entries,'  '),entries);
 assert.deepEqual(entries.map(x=>x.name),['Kick A.wav','SYNTH.flac']);
});

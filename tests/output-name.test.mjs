import test from 'node:test';
import assert from 'node:assert/strict';
import {outputFileName,uniqueOutputPath} from '../js/output-name.js';

test('converter retains numbered prefixes 001–999 in filenames',()=>{
 for(const [source,expected] of [
  ['001 Kick.wav','001 Kick_x2.wav'],['002 Snare.mp3','002 Snare_x2.wav'],
  ['056 Deep House Loop.wav','056 Deep House Loop_x2.wav'],
  ['099 Hat.flac','099 Hat_x2.wav'],
  ['100 Bass.m4a','100 Bass_x2.wav'],['999 Final.aiff','999 Final_x2.wav'],
  ['056  Multi Space.wav','056  Multi Space_x2.wav'],
  ['078 Clap & Rim.wav','078 Clap & Rim_x2.wav']
 ])assert.equal(outputFileName(source),expected,source);
});

test('converter also preserves all other basenames and original _x2 naming',()=>{
 for(const [source,expected] of [
  ['000 Kick.wav','000 Kick_x2.wav'],['1000 Kick.wav','1000 Kick_x2.wav'],
  ['056Kick.wav','056Kick_x2.wav'],['01 Kick.wav','01 Kick_x2.wav'],
  ['Kick.wav','Kick_x2.wav'],['Kit 056 Kick.wav','Kit 056 Kick_x2.wav'],
  ['056.wav','056_x2.wav'],['056 .wav','056 _x2.wav'],
  ['abc.wav','abc_x2.wav'],['005_808.wav','005_808_x2.wav']
 ])assert.equal(outputFileName(source),expected,source);
});

test('ZIP paths reserve case-insensitive duplicates instead of silently overwriting',()=>{
 const used=new Set();
 assert.equal(uniqueOutputPath('KIT/Kick.wav',used),'KIT/Kick.wav');
 assert.equal(uniqueOutputPath('KIT/Kick.wav',used),'KIT/Kick (2).wav');
 assert.equal(uniqueOutputPath('KIT/kick.WAV',used),'KIT/kick (3).WAV');
 assert.equal(uniqueOutputPath('B/Kick.wav',used),'B/Kick.wav');
 assert.equal(used.size,4);
});

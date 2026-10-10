import test from 'node:test';
import assert from 'node:assert/strict';
import {outputFileName,uniqueOutputPath} from '../js/output-name.js';

test('three-digit index 001 through 999 plus a space is removed before exporting',()=>{
 for(const [source,expected] of [
  ['001 Kick.wav','Kick.wav'],['002 Snare.mp3','Snare.wav'],
  ['056 Deep House Loop.wav','Deep House Loop.wav'],['099 Hat.flac','Hat.wav'],
  ['100 Bass.m4a','Bass.wav'],['999 Final.aiff','Final.wav'],
  ['056  Multi Space.wav','Multi Space.wav'],
  ['078 Clap & Rim.wav','Clap & Rim.wav']
 ])assert.equal(outputFileName(source),expected,source);
});

test('prefixes outside 001–999 or without a separating space remain unchanged',()=>{
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

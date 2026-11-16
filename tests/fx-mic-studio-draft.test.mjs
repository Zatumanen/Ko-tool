import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeDeviceConfig } from '../js/fxMic/deviceConfig.js';
import { createOfflineDraftFromSavedConfig } from '../js/fxMic/studioDraft.js';
import { validatePack } from '../js/fxMic/pack.js';

const stored = {
 name:'BROKEN RADIO PACK',
 presets:[
  {pos:0,name:'WALKIE TALKIE',comment:'bandpass filter',list:[
    {effect:'HIGHPASS',cutoff:.1},{effect:'LOWPASS',cutoff:.4},
    {effect:'DIST',amount:15,mix:.5},{effect:'SAMPLE'}],
   handle:{row:1,param:'cutoff',depth:.5},shake:{row:2,param:'mix',depth:.5},trigger:{row:3}},
  {pos:1,name:'AM TUNER',list:[{effect:'SSB',frequency:-500},{effect:'DIST',amount:5,mix:.2},{effect:'SAMPLE'}],
   handle:{row:0,param:'frequency',depth:1000},shake:{row:0,param:'frequency',depth:200},trigger:{row:2}},
  {pos:2,name:'CRYPTIC',list:[{effect:'RING',frequency:100,mix:.8},{effect:'REVERB',time:.5,'wet-level':.4},{effect:'SAMPLE'}],
   lfo:{row:0,param:'frequency',depth:50,shape:'random',speed:8},trigger:{row:2}},
  {pos:3,name:'LOSING SIGNAL',list:[{effect:'BALANCE',balance:.5},{effect:'REVERB',time:1,'wet-level':0,'dry-level':1},{effect:'SAMPLE'}],
   handle:{row:1,param:'wet-level',depth:1},lfo:{row:0,param:'balance',depth:1,shape:'square',speed:10},
   shake:{row:1,param:'dry-level',depth:-1},trigger:{row:2}}
 ]
};

const fromConfig=config=>{const rawConfigText=JSON.stringify(config);return {...summarizeDeviceConfig(rawConfigText,0),rawConfigText};};

test('reference-shaped saved config produces four locally editable, valid presets',()=>{
 const state=fromConfig(stored);
 const pack=createOfflineDraftFromSavedConfig(state);
 assert.deepEqual(validatePack(pack).samples,[]);
 assert.equal(pack.files.size,0);
 assert.equal(pack.config.name,'BROKEN RADIO PACK');
 assert.equal(pack.config.presets.length,4);
 assert.equal(pack.config.presets[0].comment,'bandpass filter');
 assert.equal(pack.config.presets[0].list[0].cutoff,.1);
 assert.equal(pack.config.presets[1].list[0].frequency,-500);
 assert.equal(pack.config.presets[2].lfo.speed,8);
 assert.equal(pack.config.presets[3].shake.depth,-1);
 assert.notEqual(pack.config.presets[0].list,state.presets[0].rows);
});

test('read-only device summaries never bypass authoring validation or silently drop WAVs',()=>{
 const withUnknown=structuredClone(stored);
 withUnknown.presets[0].list[0].futureField=2;
 assert.throws(()=>createOfflineDraftFromSavedConfig(fromConfig(withUnknown)),/unknown parameter/);
 const withWav=structuredClone(stored);
 withWav.samples=[{pos:0,file:'voice.wav'}];
 assert.throws(()=>createOfflineDraftFromSavedConfig(fromConfig(withWav)),/Custom device WAVs/);
 const withMissing=structuredClone(stored);
 withMissing.presets[1].list=[];
 assert.throws(()=>createOfflineDraftFromSavedConfig(fromConfig(withMissing)),/Empty saved FX rows/);
 const withUnsupported=structuredClone(stored);
 withUnsupported.presets[0].list[0].label='device only';
 assert.throws(()=>createOfflineDraftFromSavedConfig(fromConfig(withUnsupported)),/not supported/);
});

test('local draft requires a complete raw JSON snapshot and rejects extra root fields',()=>{
 const state=summarizeDeviceConfig(JSON.stringify(stored),0);
 assert.throws(()=>createOfflineDraftFromSavedConfig(state),/Complete read-only device JSON/);
 const withRoot=structuredClone(stored);
 withRoot.deviceOnly={private:1};
 assert.throws(()=>createOfflineDraftFromSavedConfig(fromConfig(withRoot)),/unsupported field/);
});

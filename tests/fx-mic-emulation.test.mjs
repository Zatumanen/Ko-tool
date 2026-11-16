import test from 'node:test';
import assert from 'node:assert/strict';
import{modulatedPreset,previewCoverage}from '../js/fxMic/emulation.js';
test('handle/shake/LFO affect only assigned rows and clamp preview ranges',()=>{
 const p={list:[{effect:'LOWPASS',cutoff:.2},{effect:'SAMPLE',speed:1}],handle:{row:0,param:'cutoff',depth:.5},shake:{row:1,param:'speed',depth:2},lfo:{row:0,param:'cutoff',depth:.1,shape:'sine',speed:1}};
 const result=modulatedPreset(p,{handle:1,shake:.5,time:.25});assert.ok(Math.abs(result.list[0].cutoff-.8)<1e-9);assert.equal(result.list[1].speed,2);assert.equal(p.list[0].cutoff,.2);
 assert.equal(modulatedPreset(p,{handle:20}).list[0].cutoff,1);
});
test('handle can modulate LFO speed; coverage declares missing simulation explicitly',()=>{
 const p={list:[{effect:'LOWPASS',cutoff:.5}],handle:{target:'lfo',param:'speed',depth:1},lfo:{row:0,param:'cutoff',depth:.1,speed:1,shape:'sine'}};
 assert.ok(Math.abs(modulatedPreset(p,{handle:1,time:.125}).list[0].cutoff-.6)<1e-9);
 assert.equal(previewCoverage({list:[{effect:'DIST',BUS:1}]}).playable,false);
 assert.ok(previewCoverage({list:[{effect:'SSB'}]}).notes.some(s=>s.includes('not simulated')));
});

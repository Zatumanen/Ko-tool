import{test}from 'node:test';
import assert from 'node:assert/strict';
import{buildPianoPage}from '../js/sequencer/pianoRoll.js';
import{buildStepPage}from '../js/sequencer/saved.js';
const model={patterns:[{group:'a',id:'A01',bars:1,records:[
 {kind:'note',index:0,pad:1,tick:25,note:60,velocity:103,duration:391},
 {kind:'note',index:1,pad:2,tick:390,note:67,velocity:80,duration:0},
 {kind:'unknown',index:2,tick:400,recordType:7},
 {kind:'note',index:3,pad:1,tick:0,note:255,velocity:1,duration:2}
]}]};
test('Piano shares exact native events, clips sustained notes at page boundaries and filters pads without mutation',()=>{
 const before=structuredClone(model),page=buildStepPage(model,'a','A01',1);
 const piano=buildPianoPage(page,{pad:'1',zoom:2});
 assert.equal(piano.notes.length,1);assert.equal(piano.notes[0].index,0);
 assert.equal(piano.notes[0].left,0);assert.equal(piano.notes[0].width,128);
 assert.equal(piano.notes[0].tick,25);assert.equal(piano.notes[0].duration,391);
 const first=buildPianoPage(buildStepPage(model,'a','A01',0));
 assert.equal(first.notes[0].left,50);assert.equal(first.invalidPitch,1);
 assert.deepEqual(model,before);
});
test('Piano zero-duration events remain point markers, missing patterns are safe, and tail pages remain reachable',()=>{
 const p=buildPianoPage(buildStepPage(model,'a','A01',1));
 assert.equal(p.notes.find(n=>n.index===1).duration,0);
 assert.equal(p.notes.find(n=>n.index===1).width,2);
 assert.equal(buildPianoPage(buildStepPage(model,'b','B01',0)).notes.length,0);
 const long={patterns:[{group:'a',id:'A01',bars:1,records:[{kind:'note',index:0,pad:1,tick:380,note:60,duration:400}]}]};
 assert.equal(buildStepPage(long,'a','A01').pages,3);
});

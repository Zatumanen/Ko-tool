import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_TRACKS,createDemoPattern,createSequencerSketch} from '../os/sequencerSketch.js';
import fs from 'node:fs/promises';

test('Local sequencer defaults are distinct track patterns and do not expose device writes',async()=>{
 const matrix=createDemoPattern();
 assert.equal(matrix.length,DEMO_TRACKS.length);
 assert.ok(matrix.every(row=>row.length===16&&row.every(x=>typeof x==='boolean')));
 matrix[0][0]=false;
 assert.equal(createDemoPattern()[0][0],true);
 const sketch=createSequencerSketch();
 assert.equal(typeof sketch.mount,'function');
 assert.equal(typeof sketch.dispose,'function');
 const src=await fs.readFile(new URL('../os/sequencerSketch.js',import.meta.url),'utf8');
 assert.match(src,/NO MIDI/i);
 assert.doesNotMatch(src,/requestMIDIAccess|sendSysex|navigator\.midi|writeProject/);
});

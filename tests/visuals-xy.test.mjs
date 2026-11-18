import test from 'node:test';import assert from 'node:assert/strict';
import {xyPoints,createPhosphorHistory} from '../js/visuals/xy.js';
const wave=Float32Array.from({length:2048},(_,i)=>Math.sin(i*.1));
const frame={leftTime:wave,rightTime:wave,time:wave,sampleRate:48000,channelCount:2};
test('Stereo XY maps L to X and R to Y exactly for phase and antiphase',()=>{
 const phase=xyPoints(frame,'stereo');assert.equal(phase.length,2048);assert.ok(phase.every(([x,y])=>x===y));
 const right=Float32Array.from(wave,x=>-x),anti=xyPoints({...frame,rightTime:right},'stereo');assert.ok(anti.every(([x,y])=>x===-y));
 const independent=xyPoints({...frame,rightTime:new Float32Array(2048)},'stereo');assert.ok(independent.every(p=>p[1]===0));
});
test('mono never fabricates technical stereo; artistic mode is explicitly derived',()=>{
 const before=wave.slice();
 assert.equal(xyPoints({...frame,channelCount:1},'stereo'),null);
 const derived=xyPoints({...frame,channelCount:1},'artistic');assert.ok(derived.length>1900);assert.ok(derived.some(([x,y])=>Math.abs(x-y)>.1));
 assert.deepEqual(frame.leftTime,before);
});
test('phosphor ages in milliseconds, bounds memory and resets between input/mode changes',()=>{
 const h=createPhosphorHistory();h.add([[1,1]],1000);const first=h.frames(1100);assert.ok(first[0].alpha>0&&first[0].alpha<1);
 assert.deepEqual(h.frames(1100),first);assert.equal(h.frames(1500).length,0);
 for(let i=0;i<1000;i++)h.add([[0,0]],2000+i);assert.ok(h.frames(2999).length<=16);
 h.reset();assert.equal(h.frames(2999).length,0);
});
test('invalid samples break the trace, overrange display clips and repaints coalesce',()=>{
 const points=xyPoints({...frame,leftTime:new Float32Array([2,NaN,-2]),rightTime:new Float32Array([.5,1,-.5])},'stereo');
 assert.deepEqual(points,[[1,.5],null,[-1,-.5]]);
 const h=createPhosphorHistory();for(let i=0;i<20;i++)h.add([[.5,.5]],1000+i*.1);assert.equal(h.frames(1002).length,1);
});

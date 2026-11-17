import test from 'node:test';import assert from 'node:assert/strict';
import {createSpectrogramHistory} from '../js/visuals/spectrogram.js';
const bins=value=>new Uint8Array(1024).fill(value);
test('new columns enter at right and move left according to time, not paint count',()=>{
 const h=createSpectrogramHistory();h.push(bins(200),48000,1000);
 const a=h.raster(160,8,1000);assert.equal(a.values.at(-1),200);
 const b=h.raster(160,8,1100);assert.equal(b.values.at(-1),0);assert.ok(b.values.some(x=>x===200));
 for(let i=0;i<10;i++)assert.deepEqual(h.raster(160,8,1100),b);
});
test('resize recomputes history without deleting measurements and silence stays blank',()=>{
 const h=createSpectrogramHistory();h.push(bins(200),48000,1000);h.push(bins(0),48000,1100);
 const narrow=h.raster(160,16,1100),wide=h.raster(320,32,1100);
 assert.ok(narrow.values.some(x=>x===200));assert.ok(wide.values.some(x=>x===200));assert.equal(h.size,2);
 assert.equal(narrow.seconds,4);assert.equal(wide.seconds,8);assert.equal(wide.values.at(-1),0);
});
test('sample rate changes and reset invalidate old frequency history; gaps are blank',()=>{
 const h=createSpectrogramHistory();h.push(bins(255),48000,0);h.push(bins(10),44100,200);
 assert.equal(h.size,1);const frame=h.raster(160,8,1000);
 assert.ok(frame.values.every(v=>v!==255));for(let y=0;y<8;y++)assert.equal(frame.values[y*160+159],0);
 h.reset();assert.equal(h.size,0);
});
test('history is bounded, copies input and rejects stale or invalid timestamps',()=>{
 const h=createSpectrogramHistory(),input=bins(30);h.push(input,48000,0);input.fill(0);assert.equal(h.raster(160,8,0).values.at(-1),30);
 for(let i=1;i<=2000;i++)h.push(bins(1),48000,i*34);
 assert.ok(h.size<=512);assert.throws(()=>h.push(input,48000,0));assert.throws(()=>h.push(input,0,70000));
});
test('extra paints at60FPS cannot alter the time position observed at15FPS',()=>{
 const h=createSpectrogramHistory();h.push(bins(200),48000,1000);
 const expected=h.raster(160,8,1100);
 for(let i=0;i<6;i++)h.raster(160,8,1000+i*1000/60);
 assert.deepEqual(h.raster(160,8,1100),expected);
});
test('a rising tone moves upward on logarithmic rows and data stays unchanged',()=>{
 const h=createSpectrogramHistory();const low=bins(0),high=bins(0);low[4]=255;high[400]=255;
 h.push(low,48000,1000);const first=h.raster(160,128,1000);
 h.push(high,48000,1200);const next=h.raster(160,128,1200);
 const rows=r=>Array.from({length:128},(_,y)=>r.values[y*160+159]).map((v,y)=>({v,y})).filter(x=>x.v===255).map(x=>x.y);
 assert.ok(Math.max(...rows(next))<Math.min(...rows(first)));assert.equal(high[400],255);
});

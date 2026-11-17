import test from 'node:test';
import assert from 'node:assert/strict';
import {spectrumCurve,createSpectrumSmoother} from '../js/visuals/spectrum.js';
const bins=()=>new Float32Array(4096).fill(-100);
test('frequency axis is logarithmic, bounded by Nyquist and retains isolated tones',()=>{
 const data=bins();data[Math.round(1000*8192/48000)]=-6;
 const p=spectrumCurve(data,48000);assert.equal(p[0].hz,20);assert.ok(Math.abs(p.at(-1).hz-20000)<1e-6);
 const peak=p.reduce((a,b)=>a.db>b.db?a:b);assert.ok(Math.abs(peak.hz-1000)<40);assert.equal(peak.db,-6);
 const low=spectrumCurve(data,16000);assert.ok(low.at(-1).hz<8000);
 const ratios=p.slice(1).map((v,i)=>v.hz/p[i].hz);assert.ok(ratios.every(x=>Math.abs(x-ratios[0])<1e-10));
});
test('silence, infinity and overrange bins produce finite bounded dB without modifying input',()=>{
 const data=bins();data[10]=-Infinity;data[11]=NaN;data[12]=20;const copy=data.slice();
 const p=spectrumCurve(data,44100);assert.ok(p.every(v=>Number.isFinite(v.db)&&v.db>=-100&&v.db<=0));assert.deepEqual(data,copy);
 for(const rate of [0,NaN,Infinity])assert.throws(()=>spectrumCurve(data,rate));
});
test('time-based release agrees at15/30/60FPS and resets between capture sessions',()=>{
 const levels=[];
 for(const fps of [15,30,60]){
  const s=createSpectrumSmoother();s.update([{hz:1000,db:0}],0);
  for(let i=1;i<=fps;i++)s.update([{hz:1000,db:-100}],i*1000/fps);
  levels.push(s.update([{hz:1000,db:-100}],1000)[0].db);s.reset();assert.equal(s.update([{hz:1000,db:-100}],2000)[0].db,-100);
 }
 assert.ok(Math.max(...levels)-Math.min(...levels)<1e-8);assert.ok(levels[0]<-90);
});

test('flat noise-bin floor stays flat and two separated tones both survive logarithmic reduction',()=>{
 const data=new Float32Array(4096).fill(-60);
 assert.ok(spectrumCurve(data,48000).every(p=>Math.abs(p.db+60)<1e-10));
 for(const hz of [100,10000])data[Math.round(hz*8192/48000)]=-10;
 const curve=spectrumCurve(data,48000);
 assert.ok(curve.some(p=>Math.abs(p.hz-100)<10&&p.db===-10));
 assert.ok(curve.some(p=>Math.abs(p.hz-10000)<200&&p.db===-10));
});
test('attack rises faster than release and sample-rate changes discard the old frequency grid',()=>{
 const s=createSpectrumSmoother();s.update([{hz:1000,db:-100}],0);
 const attack=s.update([{hz:1000,db:0}],40)[0].db;assert.ok(attack>-40&&attack<-30);
 const changed=s.update([{hz:500,db:-80}],50);assert.deepEqual(changed,[{hz:500,db:-80}]);
});

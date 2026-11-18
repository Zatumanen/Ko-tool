import test from 'node:test';import assert from 'node:assert/strict';
import{stereoAnalysis,createPlasmaDensity}from'../js/visuals/stereo.js';
const wave=Float32Array.from({length:2048},(_,i)=>.8*Math.sin(i*.1));
test('phase/antiphase correlation is exact and balance remains centered',()=>{
 const a=stereoAnalysis(wave,wave,2);assert.equal(a.status,'stereo');assert.equal(a.correlation,1);assert.equal(a.balance,0);
 const b=stereoAnalysis(wave,Float32Array.from(wave,x=>-x),2);assert.equal(b.correlation,-1);assert.equal(b.balance,0);
});
test('one-sided signals have exact balance and undefined correlation; silence/mono are explicit',()=>{
 const zero=new Float32Array(wave.length),left=stereoAnalysis(wave,zero,2),right=stereoAnalysis(zero,wave,2);
 assert.equal(left.balance,-1);assert.equal(right.balance,1);assert.equal(left.correlation,null);assert.equal(right.correlation,null);
 assert.equal(stereoAnalysis(zero,zero,2).status,'silence');assert.equal(stereoAnalysis(wave,wave,1).status,'mono');
 assert.equal(stereoAnalysis(new Float32Array([NaN]),new Float32Array([0]),2).status,'invalid');
});
test('independent quadrature signal correlation is near zero; input is never processed',()=>{
 const l=Float32Array.from({length:2048},(_,i)=>Math.sin(2*Math.PI*i/128)),r=Float32Array.from({length:2048},(_,i)=>Math.cos(2*Math.PI*i/128));
 const before=l.slice(),a=stereoAnalysis(l,r,2);assert.ok(Math.abs(a.correlation)<1e-6);assert.ok(Math.abs(a.balance)<1e-6);assert.deepEqual(l,before);
});
test('plasma is bounded, ages with elapsed time, resets and does not depend on extra paints',()=>{
 const d=createPlasmaDensity(),first=d.update([[0,.8]],1000);assert.equal(first.length,4096);assert.ok(first.some(x=>x>0));
 const faded=d.update([],1180);assert.ok(Math.max(...faded)<Math.max(...first));assert.deepEqual(d.update([],1180),faded);
 d.reset();assert.ok(d.update([],2000).every(x=>x===0));
});
test('spectral plasma places low frequencies outside high frequencies and retains phase axes',async()=>{
 const {createSpectralPlasma}=await import('../js/visuals/stereo.js'),p=createSpectralPlasma();
 const tone=k=>Float32Array.from({length:2048},(_,i)=>.8*Math.sin(2*Math.PI*k*i/2048));
 const low=tone(16),a=p.project(low,low,48000).slice(),high=tone(256),b=p.project(high,high,48000).slice();
 const radius=values=>{let sum=0,weight=0;for(let i=0;i<values.length;i+=3){assert.ok(Math.abs(values[i])<1e-7);sum+=values[i+1]**2*values[i+2];weight+=values[i+2];}return Math.sqrt(sum/weight*2);};
 assert.ok(radius(a)>radius(b)*2);
 const anti=p.project(low,Float32Array.from(low,x=>-x),48000);for(let i=1;i<anti.length;i+=3)assert.ok(Math.abs(anti[i])<1e-7);
 assert.equal(p.project(new Float32Array(2048),new Float32Array(2048),48000).length,0);
});
test('compact max raster preserves thin plasma traces',async()=>{
 const {plasmaRaster}=await import('../js/visuals/stereo.js');const d=new Float32Array(4096);d[32*64+32]=1;
 const small=plasmaRaster(d,32);assert.equal(small[16*32+16],1);assert.equal(small.length,1024);
});

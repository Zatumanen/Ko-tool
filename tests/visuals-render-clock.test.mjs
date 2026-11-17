import test from 'node:test';
import assert from 'node:assert/strict';
const load=()=>import('../js/visuals/renderClock.js');
test('60/30/15 paints share an independent30Hz snapshot cadence',async()=>{
 const {createRenderClock}=await load(),samples=[],paints=[];
 for(const initialFps of [60,30,15]){const c=createRenderClock({initialFps});let s=0,p=0;for(let i=0;i<=60;i++){const due=c.step(i*1000/60);s+=due.sample;p+=due.paint;if(due.paint)c.recordPaint(0);}samples.push(s);paints.push(p);}
 assert.deepEqual(samples,[31,31,31]);assert.deepEqual(paints,[61,31,16]);
});
test('sustained overload downshifts in steps; recovery needs multiple stable windows',async()=>{
 const {createRenderClock}=await load(),c=createRenderClock();let now=0;
 const run=(ms,cost)=>{const end=now+ms;for(;now<=end;now+=1000/60){const due=c.step(now);if(due.paint)c.recordPaint(cost);}};
 run(2100,25);assert.equal(c.fps,30);run(2100,25);assert.equal(c.fps,15);
 run(2100,0);assert.equal(c.fps,15);run(14000,0);assert.equal(c.fps,60);
});
test('suspension/gaps never fabricate analyser frames or cause a catch-up burst',async()=>{
 const {createRenderClock}=await load(),c=createRenderClock();c.step(0);const gap=c.step(1000);assert.equal(gap.sample,true);assert.equal(c.step(1000).sample,false);assert.equal(c.step(1000).paint,false);
 c.suspend();const resumed=c.step(100000);assert.equal(resumed.fps,60);assert.equal(resumed.sample,true);assert.equal(resumed.paint,true);assert.equal(c.step(99999).sample,true);
 assert.throws(()=>c.step(NaN));assert.throws(()=>createRenderClock({initialFps:45}));
});
test('clipping excludes offscreen/zero-area panels without hiding partially visible modules',async()=>{
 const {rectVisible}=await load(),clip={left:0,top:500,right:900,bottom:700};
 assert.equal(rectVisible({left:899,top:501,right:1000,bottom:600},clip,900,700),true);
 for(const rect of [{left:900,top:501,right:1000,bottom:600},{left:10,top:701,right:20,bottom:800},{left:0,top:500,right:0,bottom:600}])assert.equal(rectVisible(rect,clip,900,700),false);
 assert.equal(rectVisible({left:0,top:501,right:20,bottom:600},clip,900,400),false);
});

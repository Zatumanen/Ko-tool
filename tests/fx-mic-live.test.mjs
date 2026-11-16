import test from 'node:test';
import assert from 'node:assert/strict';
import{createLiveSession}from '../js/fxMic/liveSession.js';
import{createSerialTransport,parseLoadedPreset}from '../js/fxMic/serialTransport.js';
import{resolveLiveProfile}from '../js/fxMic/profile.js';

const identity={model:'EP-2350',firmware:'1.0.8'};
const profile={...identity,evidenceId:'synthetic-only',parameters:{LOWPASS:{cutoff:{min:0,max:1,step:.01}}}};
function fake({mismatch=false,failRead=false,holdWrite=null,denied=false,firmware='1.0.8'}={}){
 let value=.4,disconnected=null;const calls=[];
 const transport={
  connect:async()=>{calls.push('connect');if(denied)throw Error('Permission denied');return{model:'EP-2350',firmware};},
  readState:async()=>{calls.push('read');if(failRead)throw Error('read failed');return{slot:0,list:[{effect:'LOWPASS',cutoff:value}]};},
  writeParameter:async({value:v})=>{calls.push(['write',v]);if(holdWrite)await holdWrite;value=mismatch?.1:v;return true;},
  disconnect:async()=>{calls.push('close');},onDisconnect:fn=>{disconnected=fn;}
 };
 const session=createLiveSession({transport,resolveProfile:id=>id.model===profile.model&&id.firmware===profile.firmware?profile:null,timeoutMs:30});
 return{session,calls,transport,lose:()=>disconnected()};
}
test('production profile never grants writes from recognition alone',()=>{for(const v of ['1.0.8','1.1.2','unknown'])assert.equal(resolveLiveProfile({model:'EP-2350',firmware:v}),null);});
test('Live records success only after matched authoritative readback',async()=>{
 const h=fake();await h.session.connect();assert.equal(h.session.snapshot().state,'ready');
 const result=await h.session.setParameter({row:0,param:'cutoff',value:.6});assert.equal(result.list[0].cutoff,.6);assert.deepEqual(h.calls,['connect','read',['write',.6],'read']);assert.equal(h.session.snapshot().state,'verified');await h.session.disconnect();
});
for(const [name,options]of [['mismatch',{mismatch:true}],['read failure',{failRead:true}],['permission denied',{denied:true}],['incompatible firmware',{firmware:'1.1.2'}]])test('Live fails closed on '+name,async()=>{
 const h=fake(options);if(name==='mismatch'){await h.session.connect();await assert.rejects(()=>h.session.setParameter({row:0,param:'cutoff',value:.6}),/readback/i);}else await assert.rejects(()=>h.session.connect());
 assert.equal(h.session.snapshot().state,'unsafe');await assert.rejects(()=>h.session.setParameter({row:0,param:'cutoff',value:.7}));assert.equal(h.calls.filter(x=>Array.isArray(x)).length,name==='mismatch'?1:0);
});
test('timeout fences late writes and queued updates without retry or false success',async()=>{
 let finish;const h=fake({holdWrite:new Promise(r=>finish=r)});await h.session.connect();
 const first=h.session.setParameter({row:0,param:'cutoff',value:.6}),second=h.session.setParameter({row:0,param:'cutoff',value:.7});
 const results=await Promise.allSettled([first,second]);assert.ok(results.every(x=>x.status==='rejected'));finish();await new Promise(r=>setImmediate(r));
 assert.equal(h.session.snapshot().state,'unsafe');assert.equal(h.calls.filter(x=>Array.isArray(x)).length,1);assert.equal(h.calls.filter(x=>x==='read').length,1);
});
test('disconnect invalidates readback and never reopens old work',async()=>{
 let finish;const h=fake({holdWrite:new Promise(r=>finish=r)});await h.session.connect();const pending=h.session.setParameter({row:0,param:'cutoff',value:.6});
 await new Promise(r=>setImmediate(r));h.lose();finish();await assert.rejects(()=>pending);assert.equal(h.session.snapshot().state,'disconnected');assert.equal(h.calls.filter(x=>x==='read').length,1);
});
test('rejects BUS, structural/unknown parameters and off-grid values before traffic',async()=>{
 const h=fake();await h.session.connect();
 for(const update of [{row:0,param:'BUS',value:1},{row:0,param:'cutoff',value:.655},{row:0,param:'cutoff',value:2},{row:1,param:'cutoff',value:.5}])await assert.rejects(()=>h.session.setParameter(update));
 assert.equal(h.calls.filter(x=>Array.isArray(x)).length,0);
});
test('loaded preset parser rejects partial/unrecognized output instead of inventing values',()=>{
 assert.deepEqual(parseLoadedPreset('0 [ 1 LOWPASS ]\n cutoff 0.40\n1 [ 9 SAMPLE ]\n speed 1.00'),[{effect:'LOWPASS',cutoff:.4},{effect:'SAMPLE',speed:1}]);
 for(const text of ['', 'Traceback Error','0 [ 1 LOWPASS ]\n cutoff NaN','1 [ 1 LOWPASS ]\n cutoff 0.40'])assert.throws(()=>parseLoadedPreset(text));
});
test('serial permission denial sends no command and releases cleanly',async()=>{
 const adapter=createSerialTransport({probeProfile:profile,serial:{requestPort:async()=>{throw Error('Permission denied');}}});await assert.rejects(()=>adapter.connect(),/Permission denied/);await adapter.disconnect();
});

function serialFake({reply,holdWrite=false}={}){
 const commands=[];let controller,closed=0;
 const port={
  getInfo:()=>({usbVendorId:0x2367,usbProductId:0x0620}),open:async()=>{},close:async()=>{closed++;},
  readable:new ReadableStream({start(c){controller=c;}}),
  writable:new WritableStream({write(bytes){
   const cmd=new TextDecoder().decode(bytes).trim();commands.push(cmd);
   const answer=reply?.(cmd)??(cmd.includes('_machine')?'EP-2350 1.0.8':cmd.startsWith('print(fx.param')?'True':'0\n0 [ 1 LOWPASS ]\n cutoff 0.60\n0');
   if(answer!==false){const text=cmd+'\r\n'+answer+'\r\n>>> ';for(let i=0;i<text.length;i+=3)controller.enqueue(new TextEncoder().encode(text.slice(i,i+3)));}
   if(holdWrite)return new Promise(()=>{});
  }})
 };
 return{commands,get closed(){return closed;},controller,adapter:createSerialTransport({serial:{requestPort:async()=>port},probeProfile:profile,timeoutMs:25})};
}
test('serial default evidence gate stops even device selection',async()=>{
 let requested=false;const adapter=createSerialTransport({serial:{requestPort:async()=>{requested=true;}}});
 await assert.rejects(()=>adapter.connect(),/acceptance/);assert.equal(requested,false);
});
test('fixed serial codec handles fragmented echo/prompt and reads back without arbitrary commands',async()=>{
 const h=serialFake();assert.deepEqual(await h.adapter.connect(),identity);
 assert.deepEqual(await h.adapter.readState(),{slot:0,list:[{effect:'LOWPASS',cutoff:.6}]});
 assert.equal(await h.adapter.writeParameter({slot:0,row:0,effect:'LOWPASS',param:'cutoff',value:.6}),true);
 await assert.rejects(()=>h.adapter.writeParameter({slot:0,row:0,effect:'LOWPASS',param:'cutoff";bad',value:.6}));
 assert.equal(h.commands.length,3);assert.equal('sendCommand'in h.adapter,false);await h.adapter.disconnect();assert.equal(h.closed,1);
});
for(const [name,options]of [['missing prompt',{reply:()=>false}],['hung writer',{holdWrite:true}],['wrong firmware',{reply:()=> 'EP-2350 1.1.2'}],['device exception',{reply:()=> 'Traceback: Error'}]])test('serial fails closed: '+name,async()=>{
 const h=serialFake(options);await assert.rejects(()=>h.adapter.connect());await assert.rejects(()=>h.adapter.readState());assert.equal(h.commands.length,1);assert.ok(h.closed>=1);
});
test('serial stream loss invalidates session and false acknowledgement never succeeds',async()=>{
 const h=serialFake({reply:cmd=>cmd.startsWith('print(fx.param')?'False':undefined});await h.adapter.connect();
 await assert.rejects(()=>h.adapter.writeParameter({slot:0,row:0,effect:'LOWPASS',param:'cutoff',value:.6}),/acknowledged/);await h.adapter.disconnect();
 const lost=serialFake();let called=false;lost.adapter.onDisconnect(()=>{called=true;});await lost.adapter.connect();lost.controller.close();await new Promise(r=>setImmediate(r));
 assert.equal(called,true);await assert.rejects(()=>lost.adapter.readState());
});
test('Live wrong active slot and truncated readback cannot be marked verified',async()=>{
 for(const result of [{slot:1,list:[{effect:'LOWPASS',cutoff:.6}]},{slot:0,list:[{effect:'LOWPASS'}]}]){
  const h=fake();await h.session.connect();h.transport.readState=async()=>result;
  await assert.rejects(()=>h.session.setParameter({row:0,param:'cutoff',value:.6}),/readback/);assert.equal(h.session.snapshot().state,'unsafe');
 }
});
test('stale serial open cannot disconnect a newer session',async()=>{
 let finishOpen;const old={open:()=>new Promise(r=>finishOpen=r),close:async()=>{}};
 // Reuse the fake's port through an explicit test-only serial selection provider.
 let controller;const port={getInfo:()=>({usbVendorId:0x2367,usbProductId:0x0620}),open:async()=>{},close:async()=>{},
  readable:new ReadableStream({start(c){controller=c;}}),writable:new WritableStream({write(b){
   const cmd=new TextDecoder().decode(b).trim();controller.enqueue(new TextEncoder().encode(cmd+'\r\n'+(cmd.includes('_machine')?'EP-2350 1.0.8':'0\n0 [ 1 LOWPASS ]\n cutoff 0.40\n0')+'\r\n>>> '));
  }})};
 let selections=0;const adapter=createSerialTransport({probeProfile:profile,serial:{requestPort:async()=>selections++?port:old}});
 const first=adapter.connect();await new Promise(r=>setImmediate(r));await adapter.disconnect();await adapter.connect();
 finishOpen();await assert.rejects(()=>first);assert.equal((await adapter.readState()).slot,0);await adapter.disconnect();
});

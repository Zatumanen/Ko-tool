import{test}from 'node:test';
import assert from 'node:assert/strict';
import{createMidiDiagnostics}from '../js/sequencer/midiDiagnostics.js';
const setup=(options={})=>{
 let session=null,visible=true,callback,reset,subscriptions=0,unsubscribed=0;
 const model=createMidiDiagnostics({getSession:()=>session,canStart:()=>visible,limit:3,
  subscribe:(onEvents,options)=>{subscriptions++;callback=onEvents;reset=options.onReset;return{clear:()=>reset({reason:'cleared'}),unsubscribe:()=>unsubscribed++};},...options});
 return{model,setSession:s=>session=s,hide:()=>visible=false,emit:batch=>callback(batch),reset:reason=>reset({reason}),counts:()=>({subscriptions,unsubscribed})};
};
test('diagnostics is opt-in, bounded and retains only actual events without inferred transport state',()=>{
 const h=setup();assert.equal(h.counts().subscriptions,0);assert.equal(h.model.start(),false);
 h.setSession('private-token-not-for-output');h.model.sync();assert.equal(h.model.start(),true);
 const events=Array.from({length:5},(_,i)=>({type:'clock',timestamp:i})),before=structuredClone(events);
 h.emit({events,dropped:7});const state=h.model.getState();
 assert.deepEqual(state.rows,events.slice(-3));assert.equal(state.delivered,5);assert.equal(state.dropped,7);assert.equal(state.trimmed,2);
 assert.equal(state.status,'EVENTS ONLY');assert.doesNotMatch(JSON.stringify(state),/private-token|playhead|scene|LIVE SYNCED/);
 assert.deepEqual(events,before);h.model.stop();assert.equal(h.model.getState().active,false);assert.equal(h.model.getState().rows.length,3);
 h.emit({events:[{type:'start',timestamp:9}],dropped:0});assert.equal(h.model.getState().rows.length,3);
 h.model.clear();assert.equal(h.model.getState().rows.length,0);
});
test('manual trace export retains delivered prefix beyond display rows and explicitly reports losses without private fields',()=>{
 const h=setup();h.setSession('private-session');h.model.start();
 const events=Array.from({length:5},(_,i)=>({type:'clock',channel:null,data:[0xF8],timestamp:i,model:'TE032AS001',firmware:'2.5.1',connectionEpoch:7,session:2,serial:'SECRET-SERIAL',inputId:'PRIVATE-PORT'}));
 h.emit({events,dropped:3});assert.equal(h.model.exportTrace(),null);
 h.model.stop();const trace=h.model.exportTrace({buildVersion:'test-sha'});
 assert.equal(trace.events.length,5);assert.equal(h.model.getState().rows.length,3);
 assert.equal(trace.loss.observerDropped,3);assert.equal(trace.evidence,'UNVERIFIED');assert.equal(trace.hilStatus,'PENDING');
 assert.equal(trace.appBuildVersion,'test-sha');assert.deepEqual(trace.events.map(e=>e.timestamp),[0,1,2,3,4]);
 assert.doesNotMatch(JSON.stringify(trace),/SECRET-SERIAL|PRIVATE-PORT|private-session/);
 trace.events[0].data[0]=0;assert.equal(h.model.exportTrace().events[0].data[0],0xF8);
 h.model.clear();assert.equal(h.model.exportTrace(),null);
});
test('capture limit stops observation with an explicit truncated prefix; session/close resets discard export data',()=>{
 const h=setup({captureLimit:2});h.setSession('one');h.model.start();
 h.emit({events:[{type:'clock',timestamp:1,data:[0xF8]},{type:'stop',timestamp:2,data:[0xFC]},{type:'start',timestamp:3,data:[0xFA]}],dropped:0});
 const trace=h.model.exportTrace();assert.equal(h.model.getState().active,false);
 assert.equal(trace.loss.captureLimitReached,true);assert.equal(trace.loss.deliveredButNotStored,1);
 assert.deepEqual(trace.events.map(e=>e.timestamp),[1,2]);assert.equal(trace.stopReason,'limit');
 h.setSession('two');h.model.sync();assert.equal(h.model.exportTrace(),null);
 h.model.start();h.emit({events:[{type:'clock',timestamp:4,data:[0xF8]}],dropped:0});h.model.suspend();assert.equal(h.model.exportTrace(),null);
});
test('clear, epoch/session reset, hidden/closed suspension and restart reject late batches',()=>{
 const h=setup();h.setSession('one');h.model.start();h.emit({events:[{type:'stop',timestamp:1}],dropped:0});
 h.model.clear();assert.equal(h.model.getState().active,true);assert.equal(h.model.getState().rows.length,0);
 h.setSession('two');h.model.sync();assert.equal(h.model.getState().active,false);
 h.emit({events:[{type:'note-on',timestamp:2}],dropped:0});assert.equal(h.model.getState().rows.length,0);
 h.model.start();h.reset('session-changed');assert.equal(h.model.getState().active,false);
 h.model.start();h.model.suspend();assert.equal(h.model.getState().rows.length,0);
 h.hide();assert.equal(h.model.start(),false);assert.equal(h.counts().subscriptions,h.counts().unsubscribed);
 h.model.dispose();h.setSession('three');h.model.sync();assert.equal(h.model.start(),false);
});

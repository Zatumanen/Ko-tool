import{test}from 'node:test';
import assert from 'node:assert/strict';
import{createMidiDiagnostics}from '../js/sequencer/midiDiagnostics.js';
const setup=()=>{
 let session=null,visible=true,callback,reset,subscriptions=0,unsubscribed=0;
 const model=createMidiDiagnostics({getSession:()=>session,canStart:()=>visible,limit:3,
  subscribe:(onEvents,options)=>{subscriptions++;callback=onEvents;reset=options.onReset;return{clear:()=>reset({reason:'cleared'}),unsubscribe:()=>unsubscribed++};}});
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

import{test}from 'node:test';
import assert from 'node:assert/strict';
import{decodeMidiEvent,createMidiEventObserver}from '../js/ep133/midiEvents.js';

test('standard MIDI decoding preserves channels, note releases, transport and 14-bit SPP',()=>{
 for(let channel=1;channel<=16;channel++){
  const bytes=[0x90+channel-1,60,100],before=[...bytes];
  assert.deepEqual(decodeMidiEvent(bytes),{type:'note-on',channel,note:60,velocity:100,data:bytes});
  assert.deepEqual(bytes,before);
  assert.equal(decodeMidiEvent([0x90+channel-1,60,0]).type,'note-off');
  assert.equal(decodeMidiEvent([0x80+channel-1,60,73]).velocity,73);
 }
 for(const[status,type]of [[0xF8,'clock'],[0xFA,'start'],[0xFB,'continue'],[0xFC,'stop']])assert.equal(decodeMidiEvent([status]).type,type);
 assert.equal(decodeMidiEvent([0xF2,1,2]).position,257);
 assert.equal(decodeMidiEvent([0xF2,127,127]).position,16383);
 assert.equal(decodeMidiEvent([0xF2,0,0]).position,0);
});
test('decoder rejects malformed lengths, invalid bytes, unsupported messages and SysEx',()=>{
 for(const bytes of [null,[],[0x90],[0x90,60],[0x90,60,2,3],[0xF8,0],[0xF2,0],[0xF2,0,128],[0x90,128,1],[0x90,1,-1],[0x90,1,256],[0x90,1,1.5],[60,100],[0xB0,1,2],[0xF0,1,0xF7]])assert.equal(decodeMidiEvent(bytes),null);
});
const harness=()=>{
 const input={},output={},timers=new Map(),batches=[],resets=[];let timer=0;
 let context={input,output,connectionEpoch:7,model:'TE032AS001',firmware:'2.5.1'};
 const observer=createMidiEventObserver({getContext:()=>context,setTimeoutFn:fn=>{timers.set(++timer,fn);return timer;},clearTimeoutFn:id=>timers.delete(id)});
 const subscribe=()=>observer.subscribe(batch=>batches.push(batch),{capacity:4,onReset:()=>resets.push(true)});
 const receive=(port=input,epoch=7)=>observer.receive({port,epoch,data:[0xF8],timestamp:12.25});
 const flush=()=>{for(const[id,fn]of [...timers]){timers.delete(id);fn();}};
 return{observer,subscribe,receive,flush,batches,resets,input,timers,setContext:c=>context=c,getContext:()=>context};
};
test('passive observer bounds and batches Clock, isolates subscriber failures and exposes no port identifiers',()=>{
 const h=harness();const sub=h.subscribe();h.observer.subscribe(()=>{throw Error('consumer');});
 for(let i=0;i<10;i++)h.receive();
 assert.equal(h.batches.length,0);h.flush();
 assert.equal(h.batches[0].events.length,4);assert.equal(h.batches[0].dropped,6);
 const event=h.batches[0].events[0];assert.equal(event.timestamp,12.25);assert.equal(event.connectionEpoch,7);
 assert.equal(event.model,'TE032AS001');assert.equal(typeof event.session,'number');assert.equal('input' in event,false);
 assert.ok(Object.isFrozen(event));assert.ok(Object.isFrozen(event.data));sub.unsubscribe();
});
test('foreign ports, stale listener epochs, queued old sessions, disconnect, clear and resubscription fail closed',()=>{
 const h=harness(),sub=h.subscribe();h.receive({});h.receive(h.input,6);h.flush();assert.equal(h.batches.length,0);
 h.receive();h.setContext({...h.getContext(),connectionEpoch:8});h.observer.sync();h.flush();assert.equal(h.batches.length,0);
 h.receive(h.input,7);h.receive(h.input,8);h.setContext(null);h.observer.sync();h.flush();assert.equal(h.batches.length,0);
 h.setContext({input:h.input,output:{},connectionEpoch:9,model:'TE032AS006',firmware:'2.5.1'});
 h.receive(h.input,9);sub.clear();h.flush();assert.equal(h.batches.length,0);
 h.receive(h.input,9);sub.unsubscribe();h.flush();assert.equal(h.batches.length,0);
 h.subscribe();h.receive(h.input,9);h.flush();assert.equal(h.batches.length,1);assert.equal(h.batches[0].events[0].model,'TE032AS006');
 assert.ok(h.resets.length>=2);
});
test('explicit flush drains the current batch once and rejects a queued stale-session tail',()=>{
 const h=harness(),sub=h.subscribe();h.receive();sub.flush();
 assert.equal(h.batches.length,1);h.flush();assert.equal(h.batches.length,1);
 h.receive();h.setContext(null);sub.flush();h.flush();assert.equal(h.batches.length,1);
 sub.unsubscribe();sub.flush();assert.equal(h.batches.length,1);
});

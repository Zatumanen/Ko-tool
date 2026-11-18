import{test}from 'node:test';
import assert from 'node:assert/strict';
import{getSequencerSessionState}from '../js/sequencer/session.js';

const ready={status:'ready',connection:{status:'connected',epoch:4,device:{identityVerified:true,sku:'EP-133',firmware:'2.5.1'}},ownership:{status:'owned'},safety:{status:'safe'},recovery:{hydrated:true},operation:{phase:'idle'}};
test('Sequencer observes an authorized ready session without exposing private device identity',()=>{
  const state=getSequencerSessionState(ready);
  assert.equal(state.status,'ready');
  assert.equal(state.identity,'EP-133 · FW 2.5.1');
  assert.equal(state.epoch,4);
});
test('Sequencer fails closed for absent identity, ownership, recovery or safety',()=>{
  for(const patch of [
    {ownership:{status:'none'}},
    {connection:{...ready.connection,device:{identityVerified:false}}},
    {recovery:{hydrated:false}},
    {safety:{status:'unsafe'}},
    {status:'mutating',operation:{phase:'mutating'}},
    {status:'reading',operation:{phase:'reading'}}
  ])assert.equal(getSequencerSessionState({...ready,...patch}).status,'blocked');
  assert.equal(getSequencerSessionState(null).status,'disconnected');
  assert.equal(getSequencerSessionState({ownership:{status:'blocked'}}).status,'blocked');
  assert.equal(getSequencerSessionState({...ready,status:'disconnected',connection:{status:'disconnected',epoch:5}}).identity,'');
});

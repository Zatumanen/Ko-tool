import test from 'node:test';
import assert from 'node:assert/strict';
import{createHardwareTrial}from '../js/fxMic/hardwareTrial.js';

function fixture({firmware='1.0.8',cutoff=.4,wrongReadback=false,hasModulation=false,firmwareVerified=true}={}){
 const calls=[];
 const trial=createHardwareTrial({makeTransport:({probeProfile})=>({
  connect:async()=>({model:'EP-2350',firmware:probeProfile.firmware,firmwareVerified}),
  readState:async()=>({slot:0,list:[{effect:'LOWPASS',cutoff}],hasModulation}),
  writeParameter:async update=>{calls.push(update);if(!wrongReadback)cutoff=update.value;return true;},
  disconnect:async()=>{}
 })});
 return{trial,calls,firmware,changeAtDevice:value=>{cutoff=value;}};
}

test('hardware trial confirms a single change, independent readback and explicit restore',async()=>{
 const{trial,calls,firmware}=fixture();
 await trial.connect(firmware);
 assert.equal(trial.snapshot().original,.4);
 assert.deepEqual(calls,[]);
 await assert.rejects(()=>trial.apply(false),/confirm/i);
 await trial.apply(true);
 assert.equal(trial.snapshot().current.list[0].cutoff,.45);
 assert.equal(trial.snapshot().restorePending,true);
 await assert.rejects(()=>trial.apply(true),/one change/i);
 await trial.restore();
 assert.deepEqual(calls.map(x=>x.value),[.45,.4]);
 assert.equal(trial.snapshot().current.list[0].cutoff,.4);
 assert.equal(trial.snapshot().restorePending,false);
 assert.equal(trial.snapshot().phase,'restored');
});

test('diagnostic firmware reads without offering any writes',async()=>{
 const{trial,calls,firmware}=fixture({firmware:'1.1.2'});
 await trial.connect(firmware);
 assert.equal(trial.snapshot().current.list[0].cutoff,.4);
 assert.equal(trial.snapshot().original,null);
 await assert.rejects(()=>trial.apply(true),/unavailable/i);
 assert.deepEqual(calls,[]);
});

test('trial rejects stale hardware state before sending a write',async()=>{
 const{trial,calls,firmware,changeAtDevice}=fixture();
 await trial.connect(firmware);
 changeAtDevice(.8);
 await assert.rejects(()=>trial.apply(true),/changed/i);
 assert.deepEqual(calls,[]);
 assert.equal(trial.snapshot().restorePending,false);
});

test('a failed readback leaves recovery advice and never writes a rollback',async()=>{
 const{trial,calls,firmware}=fixture({wrongReadback:true});
 await trial.connect(firmware);
 await assert.rejects(()=>trial.apply(true),/readback/i);
 assert.equal(trial.snapshot().restorePending,true);
 await assert.rejects(()=>trial.restore());
 assert.equal(calls.length,1);
});

test('unverified stock OS and modulated live chains cannot enter write trial',async()=>{
 for(const options of [{firmwareVerified:false},{hasModulation:true}]){
  const {trial,firmware,calls}=fixture(options);
  await trial.connect(firmware);
  assert.equal(trial.snapshot().original,null);
  await assert.rejects(()=>trial.apply(true),/unavailable/);
  assert.deepEqual(calls,[]);
  await trial.disconnect();
 }
});

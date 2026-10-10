import test from 'node:test';
import assert from 'node:assert/strict';
import {describeUserDeviceState,DEVICE_STATE_MESSAGES} from '../os/deviceStatusCopy.js';

const healthy=Object.freeze({
 status:'ready',connection:'connected',ownership:'owned',
 safety:'safe',phase:'idle',recoveryHydrated:true,
 sku:'TE032AS001',firmware:'2.5.1'
});

test('ZAT-18 defines one human-facing message and next action for each status',()=>{
 for(const [status,copy]of Object.entries(DEVICE_STATE_MESSAGES)){
  assert.ok(copy.title.length>=10,status);
  assert.ok(copy.summary.length>=30,status);
  assert.ok(copy.next.length>=35,status);
  assert.ok(['ready','busy','danger','idle'].includes(copy.tone),status);
  assert.doesNotMatch(copy.title+' '+copy.summary+' '+copy.next,/\b(?:FID|CRC|SysEx|FILE_PUT)\b/i,status);
 }
});
test('ZAT-18 prevents a false ready state when ownership, connection or recovery evidence is missing',()=>{
 assert.equal(describeUserDeviceState(healthy).title,'Device session ready');
 for(const delta of [
  {connection:'disconnected'},{ownership:'blocked'},
  {recoveryHydrated:false},{safety:'blocked'},{phase:'unknown'}
 ]){
  const copy=describeUserDeviceState({...healthy,...delta});
  assert.notEqual(copy.title,'Device session ready',JSON.stringify(delta));
 }
 assert.equal(describeUserDeviceState(null).title,'Device status unavailable');
 assert.equal(describeUserDeviceState({status:'made-up'}).title,'Device status unavailable');
});
test('ZAT-18 prioritizes unsafe and recovery-required evidence over a contradictory status',()=>{
 assert.equal(describeUserDeviceState({...healthy,safety:'unsafe'}).title,'Device state uncertain');
 assert.equal(describeUserDeviceState({...healthy,safety:'recovery-required'}).title,'Device recovery needed');
 assert.equal(describeUserDeviceState({...healthy,phase:'mutating'}).title,'Changing device data');
 assert.equal(describeUserDeviceState({...healthy,phase:'verifying'}).title,'Checking device changes');
});
test('ZAT-18 excludes raw device reasons from routine help text',()=>{
 const dangerous=describeUserDeviceState({...healthy,status:'unsafe',safety:'unsafe',reason:'FID 93 CRC private diagnostic'});
 assert.doesNotMatch(dangerous.title+' '+dangerous.summary+' '+dangerous.next,/FID 93|CRC private/);
 assert.match(dangerous.next,/My EP/);
});

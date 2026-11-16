import test from 'node:test';
import assert from 'node:assert/strict';
import {validateConfig,defaultConfig,moveEffect,removeEffect} from '../js/fxMic/config.js';

test('stock configuration validates without changing omitted fields',()=>{
  const c={name:'Original',presets:[{list:[{effect:'LOWPASS',cutoff:.2},{effect:'SAMPLE'}],handle:{row:0,param:'cutoff',depth:.8},trigger:{row:1}}]};
  const before=JSON.stringify(c);assert.equal(validateConfig(c).errors.length,0);assert.equal(JSON.stringify(c),before);
  assert.equal(defaultConfig().presets.length,4);
});
for(const [label,mutate] of [
  ['CircuitPython',c=>c.sample_fx='preset'],
  ['unknown effect',c=>c.presets[0].list[0].effect='eval'],
  ['nonfinite',c=>c.presets[0].list[0].cutoff=Infinity],
  ['range',c=>c.presets[0].list[0].cutoff=2],
  ['duplicate preset slot',c=>c.presets[1].pos=0],
  ['duplicate singleton',c=>c.presets[0].list=[{effect:'DELAY'},{effect:'DELAY'}]],
  ['dangling row',c=>c.presets[0].handle={row:8,param:'cutoff',depth:.1}],
  ['BUS target',c=>c.presets[0].handle={row:0,param:'BUS',depth:1}],
  ['missing LFO target',c=>c.presets[0].handle={target:'lfo',param:'speed',depth:1}],
  ['wrong trigger target',c=>c.presets[0].trigger={row:0}],
  ['unknown parameter',c=>c.presets[0].list[0].q=.5],
  ['path traversal',c=>c.samples=[{file:'../1.wav'}]],
  ['slot collision with implicit index',c=>c.samples=[{file:'a.wav',pos:1},{file:'b.wav'}]],
  ['too many rows',c=>c.presets[0].list=Array.from({length:17},()=>({effect:'LOWPASS'}))],
  ['invalid container',c=>c.presets[0].list[0]=[]]
])test('config rejects '+label,()=>{const c=defaultConfig();mutate(c);assert.ok(validateConfig(c).errors.length,label);});

test('effect reorder preserves all row targets and LFO targeting',()=>{
  const p={list:[{effect:'LOWPASS'},{effect:'DIST'},{effect:'SAMPLE'}],handle:{target:'lfo',param:'speed',depth:2},shake:{row:0,param:'cutoff',depth:.2},lfo:{row:1,param:'mix',depth:.3},trigger:{row:2}};
  const moved=moveEffect(p,0,2);
  assert.deepEqual(moved.list.map(x=>x.effect),['DIST','SAMPLE','LOWPASS']);
  assert.equal(moved.shake.row,2);assert.equal(moved.lfo.row,0);assert.equal(moved.trigger.row,1);assert.deepEqual(moved.handle,p.handle);
  assert.equal(p.shake.row,0);assert.deepEqual(moveEffect(moved,2,0),p);
});
test('delete refuses referenced effect until explicit removal of its assignments',()=>{
  const p={list:[{effect:'LOWPASS'},{effect:'SAMPLE'}],handle:{row:0,param:'cutoff',depth:.2},trigger:{row:1}};
  assert.throws(()=>removeEffect(p,0),/assignment/i);
  const next=removeEffect(p,0,{removeAssignments:true});assert.equal(next.handle,undefined);assert.equal(next.trigger.row,0);assert.equal(p.list.length,2);
});
test('BUS is an explicit preview limitation; sample filenames are not limited to numbered names',()=>{
  const c=defaultConfig();c.presets[0].list[0].BUS=1;c.samples=[{file:'Drum.wav',playmode:'hold'}];
  const r=validateConfig(c);assert.deepEqual(r.errors,[]);assert.ok(r.warnings.some(x=>x.includes('BUS')));
});
for(const key of ['constructor','__proto__','toString'])test('rejects inherited parameter and modulation key '+key,()=>{
 const c=defaultConfig();c.presets[0].list[0]=JSON.parse('{"effect":"LOWPASS","'+key+'":0}');
 assert.ok(validateConfig(c).errors.length>0);
 const m=defaultConfig();m.presets[0].handle={row:0,param:key,depth:.1};assert.ok(validateConfig(m).errors.length>0);
});
test('modulation targets require a string and LFO warns about its negative half-cycle',()=>{
 const c=defaultConfig();c.presets[0].handle={row:0,param:['cutoff'],depth:.1};assert.ok(validateConfig(c).errors.length>0);
 const p=defaultConfig();p.presets[0].list[0].cutoff=.2;p.presets[0].lfo={row:0,param:'cutoff',depth:.5};
 assert.ok(validateConfig(p).warnings.some(s=>s.includes('modulation reaches')));
});

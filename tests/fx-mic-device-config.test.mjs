import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeDeviceConfig } from '../js/fxMic/deviceConfig.js';

// Synthetic fixture follows the public Broken Radio Pack config.json shape
// in the pinned reference. It is NOT captured hardware evidence.
const referenceShape = {
  name: 'BROKEN RADIO PACK',
  samples: [{ pos: 0, file: '1.wav' }],
  presets: [
    { pos: 0, name: 'WALKIE >>> Error', list: [
      { effect: 'HIGHPASS', cutoff: .1, deviceSpecific: 6 },
      { effect: 'LOWPASS', cutoff: .4 },
      { effect: 'DIST', amount: 15, mix: .5 },
      { effect: 'SAMPLE' }],
      handle: { row: 1, param: 'cutoff', depth: .5 },
      shake: { row: 2, param: 'mix', depth: .5 }, trigger: { row: 3 } },
    { pos: 1, name: 'AM TUNER', list: [
      { effect: 'SSB', frequency: -500 }, { effect: 'SAMPLE' }] },
    { pos: 2, name: 'CRYPTIC', list: [
      { effect: 'RING', frequency: 100, mix: .8 },
      { effect: 'REVERB', time: .5, 'wet-level': .4 }, { effect: 'SAMPLE' }],
      lfo: { row: 0, param: 'frequency', depth: 50, shape: 'random', speed: 8 } },
    { pos: 3, name: 'LOSING SIGNAL', list: [
      { effect: 'SAMPLE' }] }
  ]
};
test('read-only firmware config reports four real-shaped presets without authoring validation',()=>{
 const result = summarizeDeviceConfig(JSON.stringify(referenceShape), 0);
 assert.equal(result.source, 'stored-config');
 assert.equal(result.slot, 0);
 assert.equal(result.packName, 'BROKEN RADIO PACK');
 assert.equal(result.sampleCount, 1);
 assert.deepEqual(result.presets.map(p=>p.rowCount), [4,2,3,1]);
 assert.equal(result.presets[0].name, 'WALKIE >>> Error');
 assert.deepEqual(result.presets[0].modulation, ['handle','shake','trigger']);
 assert.equal(result.list[0].deviceSpecific, 6);
 assert.deepEqual(result.list[3], {effect:'SAMPLE'});
 assert.equal(result.hasModulation, true);
});
test('empty saved presets, missing selected slot and no running slot remain readable',()=>{
 const a=summarizeDeviceConfig(JSON.stringify({name:'empty',presets:[{pos:2,name:'EMPTY',list:[]}]}),-1);
 assert.equal(a.slot,-1);assert.deepEqual(a.list,[]);
 assert.deepEqual(a.presets.map(p=>p.present),[false,false,true,false]);
 const b=summarizeDeviceConfig(JSON.stringify({presets:[]}),0);
 assert.deepEqual(b.list,[]);
 assert.equal(b.presets[0].present,false);
});
test('unknown stock fields are diagnostic-only and cannot become writes or validator allowances',()=>{
 const result=summarizeDeviceConfig(JSON.stringify({presets:[{pos:0,list:[
  {effect:'FUTURE_FX',strange:99,text:'no effect',nested:{value:1},BUS:2}
 ]}]}),0);
 assert.equal(result.list[0].effect,'FUTURE_FX');
 assert.equal(result.list[0].strange,99);
 assert.equal(result.list[0].BUS,2);
 assert.equal(result.list[0].text,undefined);
 assert.equal(result.unknownFields,2);
});
test('bad JSON, duplicate positions, overlong data and invalid rows fail clearly',()=>{
 const invalid=[
  ['{{','invalid JSON'], ['{}','presets array'],
  [JSON.stringify({presets:[{pos:0,list:[]},{pos:0,list:[]}]}),'duplicate'],
  [JSON.stringify({presets:[{pos:0,list:[null]}]}),'effect row'],
  [JSON.stringify({presets:[{pos:0,list:Array(17).fill({effect:'SAMPLE'})}]}),'row count'],
  ['a'.repeat(65537),'size limit']
 ];
 for(const [raw,pattern] of invalid) assert.throws(()=>summarizeDeviceConfig(raw,0),new RegExp(pattern));
 assert.throws(()=>summarizeDeviceConfig('{"presets":[]}',4),/FX slot/);
});

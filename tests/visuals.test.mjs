import test from 'node:test';
import assert from 'node:assert/strict';
import{
 MODULES,IDS,PRESET_NAMES,makePreset,validLayout,allocateWidths,moveModule,setVisible,
 resizePair,readWorking,saveWorking,readPresets,savePresets,clampHeight,resolvedPalette,
 STORAGE_WORKING,STORAGE_PRESETS
}from '../js/visuals/layout.js';

const makeStorage=()=>{const data=new Map();return{getItem:key=>data.get(key)||null,setItem:(key,v)=>data.set(key,v),raw:data}};
test('all seven modules, approved layouts, visibility and order',()=>{
 assert.equal(MODULES.length,7);
 assert.deepEqual(PRESET_NAMES,['Balanced','Beatmaking','Mixing','Live']);
 const layouts={
 Balanced:['waveform','spectrum','spectrogram','loudness','stereo','output','oscilloscope'],
 Beatmaking:['waveform','spectrum','spectrogram','output','loudness'],
 Mixing:['output','loudness','spectrum','stereo','spectrogram','waveform'],
 Live:['waveform','spectrum','spectrogram','oscilloscope','output']
 };
 for(const [name,order]of Object.entries(layouts)){
   const l=makePreset(name);
   assert.deepEqual(l.order.filter(x=>l.visible.includes(x)),order);
   assert.deepEqual([...l.order].sort(),[...IDS].sort());
   assert.equal(l.version,1);
 }
});
test('approved visible weights are preserved per preset',()=>{
 const expected={
 Balanced:[25,25,18,8,8,8,8],Beatmaking:[35,30,15,10,10],
 Mixing:[20,20,20,20,10,10],Live:[30,25,20,15,10]
 };
 for(const [name,weights]of Object.entries(expected)){
   const l=makePreset(name);
   assert.deepEqual(l.order.filter(x=>l.visible.includes(x)).map(id=>l.weights[id]),weights);
 }
});
test('minimum widths and horizontal overflow without hiding any meters',()=>{
 const l=makePreset();
 const widths=allocateWidths(l,700);
 assert.deepEqual(l.visible,IDS);
 assert.equal(Object.values(widths).reduce((s,x)=>s+x,0),944);
 for(const module of MODULES)assert.ok(widths[module.id]>=module.min);
 const wide=allocateWidths(l,2400);
 assert.ok(Math.abs(Object.values(wide).reduce((s,x)=>s+x,0)-2400)<.001);
 assert.ok(wide.waveform>wide.loudness);
});
test('pairwise resizing preserves other weights, totals and boundaries',()=>{
 const base=makePreset('Mixing');
 const left='output',right='loudness';
 const updated=resizePair(base,left,right,240,240,80);
 assert.ok(updated.weights[left]>base.weights[left]);
 assert.ok(updated.weights[right]<base.weights[right]);
 assert.equal(updated.weights[left]+updated.weights[right],base.weights[left]+base.weights[right]);
 for(const id of IDS.filter(x=>x!==left&&x!==right))assert.equal(updated.weights[id],base.weights[id]);
 const stopped=resizePair(base,left,right,240,240,10000);
 assert.ok(stopped.weights[right]>=40*(96/480)-1e-6);
 assert.equal(base.weights[left],20);
});
test('reorder, hide all and restore one preserve hidden modules',()=>{
 let l=makePreset();const weights={...l.weights};
 l=moveModule(l,'oscilloscope','waveform');assert.equal(l.order[0],'oscilloscope');
 for(const id of IDS)l=setVisible(l,id,false);
 assert.equal(l.visible.length,0);
 assert.deepEqual(l.weights,weights);
 l=setVisible(l,'spectrogram',true);assert.deepEqual(l.visible,['spectrogram']);
 assert.ok(allocateWidths(l,800).spectrogram>=800);
});
test('reject corrupted snapshots, return Balanced via caller fallback',()=>{
 for(const value of [null,{}, {version:2,order:IDS,visible:IDS,weights:{}},
  {...makePreset(),visible:['waveform','waveform']},
  {...makePreset(),order:IDS.slice(1).concat('waveform','waveform')},
  {...makePreset(),weights:{...makePreset().weights,waveform:NaN}}]){
  assert.equal(validLayout(value),null);
 }
});
test('browser local working snapshot is distinct from named presets',()=>{
 const storage=makeStorage();const l=makePreset('Live');
 assert.equal(saveWorking(storage,l),true);
 assert.deepEqual(readWorking(storage),l);
 assert.equal(savePresets(storage,[{name:'My Studio',layout:makePreset('Mixing')}]),true);
 assert.deepEqual(readPresets(storage)[0].name,'My Studio');
 assert.notEqual(storage.raw.get(STORAGE_WORKING),storage.raw.get(STORAGE_PRESETS));
 const blocked={getItem:()=>null,setItem:()=>{throw Error('quota')}};
 assert.equal(saveWorking(blocked,l),false);
 assert.equal(readWorking(blocked),null);
});
test('height and palette fallbacks are conservative',()=>{
 assert.equal(clampHeight(250,500),200);
 assert.equal(clampHeight(250,800),250);
 assert.equal(clampHeight(150,200),90);
 assert.equal(resolvedPalette('device','TE032AS001'),'ep133');
 assert.equal(resolvedPalette('device','TE032AS006'),'ep40');
 assert.equal(resolvedPalette('device','TE032AS005'),'app');
 assert.equal(resolvedPalette('device','TE032AS002'),'app');
 assert.equal(resolvedPalette('device','UNKNOWN'),'app');
 assert.equal(resolvedPalette('mono','TE032AS001'),'mono');
});

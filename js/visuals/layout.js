// Visuals layout model. No browser globals: shared by UI and Node tests.
export const MODULES=Object.freeze([
  {id:'waveform',name:'Waveform',min:200},
  {id:'spectrum',name:'Spectrum',min:200},
  {id:'spectrogram',name:'Spectrogram',min:160},
  {id:'loudness',name:'Loudness',min:96},
  {id:'stereo',name:'Stereo Meter',min:96},
  {id:'output',name:'Output Meters',min:96},
  {id:'oscilloscope',name:'Oscilloscope',min:96}
]);
export const IDS=Object.freeze(MODULES.map(x=>x.id));
export const STORAGE_WORKING='ko-tool-visuals-working-v1';
export const STORAGE_PRESETS='ko-tool-visuals-presets-v1';
const weights=Object.freeze({waveform:25,spectrum:25,spectrogram:18,loudness:8,stereo:8,output:8,oscilloscope:8});
const definitions=Object.freeze({
  Balanced:{visible:IDS,order:IDS,weights},
  Beatmaking:{visible:['waveform','spectrum','spectrogram','output','loudness'],order:['waveform','spectrum','spectrogram','output','loudness'],weights:{waveform:35,spectrum:30,spectrogram:15,output:10,loudness:10}},
  Mixing:{visible:['output','loudness','spectrum','stereo','spectrogram','waveform'],order:['output','loudness','spectrum','stereo','spectrogram','waveform'],weights:{output:20,loudness:20,spectrum:20,stereo:20,spectrogram:10,waveform:10}},
  Live:{visible:['waveform','spectrum','spectrogram','oscilloscope','output'],order:['waveform','spectrum','spectrogram','oscilloscope','output'],weights:{waveform:30,spectrum:25,spectrogram:20,oscilloscope:15,output:10}}
});
export const PRESET_NAMES=Object.freeze(Object.keys(definitions));
export function makePreset(name='Balanced'){
  const base=definitions[name]||definitions.Balanced;
  return{version:1,order:[...base.order,...IDS.filter(id=>!base.order.includes(id))],visible:[...base.visible],weights:{...weights,...base.weights}};
}
export function validLayout(input){
  if(!input||input.version!==1||!Array.isArray(input.order)||input.order.length!==IDS.length||new Set(input.order).size!==IDS.length||!input.order.every(id=>IDS.includes(id)))return null;
  if(!Array.isArray(input.visible)||new Set(input.visible).size!==input.visible.length||!input.visible.every(id=>IDS.includes(id)))return null;
  if(!input.weights||!IDS.every(id=>Number.isFinite(input.weights[id])&&input.weights[id]>0&&input.weights[id]<=1e6))return null;
  return{version:1,order:[...input.order],visible:input.order.filter(id=>input.visible.includes(id)),weights:Object.fromEntries(IDS.map(id=>[id,input.weights[id]]))};
}
export function setVisible(layout,id,show){if(!IDS.includes(id))return layout;return validLayout({...layout,visible:show?[...layout.visible,id]:layout.visible.filter(x=>x!==id)})}
export function moveModule(layout,id,to){if(!IDS.includes(id)||!IDS.includes(to)||id===to)return layout;const next=layout.order.filter(x=>x!==id);next.splice(next.indexOf(to),0,id);return validLayout({...layout,order:next})}
export function moduleMin(id){return MODULES.find(x=>x.id===id)?.min||96}
// Allocate relative widths, satisfying minimums when space permits. Overflow uses native browser scroll.
export function allocateWidths(layout,available){
  const visible=layout.order.filter(id=>layout.visible.includes(id));
  if(!visible.length)return{};
  const budget=Math.max(0,Number(available)||0);
  const minSum=visible.reduce((s,id)=>s+moduleMin(id),0);
  if(minSum>=budget)return Object.fromEntries(visible.map(id=>[id,moduleMin(id)]));
  let remaining=budget,remainingIds=[...visible],result={};
  while(remainingIds.length){
    const sum=remainingIds.reduce((s,id)=>s+layout.weights[id],0);
    const below=remainingIds.filter(id=>remaining*layout.weights[id]/sum<moduleMin(id));
    if(!below.length){for(const id of remainingIds)result[id]=remaining*layout.weights[id]/sum;break}
    for(const id of below){result[id]=moduleMin(id);remaining-=result[id]}
    remainingIds=remainingIds.filter(id=>!below.includes(id));
  }
  return result;
}
// A divider changes only its adjacent visible pair; keep their combined intended weight.
export function resizePair(layout,left,right,leftPx,rightPx,delta){
  const seen=layout.order.filter(id=>layout.visible.includes(id));
  if(seen.indexOf(right)!==seen.indexOf(left)+1||!Number.isFinite(delta))return layout;
  const minL=moduleMin(left),minR=moduleMin(right);
  const targetL=Math.max(minL,Math.min(leftPx+rightPx-minR,leftPx+delta));
  const targetR=leftPx+rightPx-targetL;
  if(targetR<minR||!Number.isFinite(targetL)||!Number.isFinite(targetR)||targetL+targetR<=0)return layout;
  const sum=layout.weights[left]+layout.weights[right];
  return validLayout({...layout,weights:{...layout.weights,[left]:sum*targetL/(targetL+targetR),[right]:sum*targetR/(targetL+targetR)}});
}
export function readWorking(storage){try{return validLayout(JSON.parse(storage?.getItem(STORAGE_WORKING)||'null'))}catch{return null}}
export function saveWorking(storage,layout){try{storage.setItem(STORAGE_WORKING,JSON.stringify(validLayout(layout)));return true}catch{return false}}
export function readPresets(storage){try{const a=JSON.parse(storage?.getItem(STORAGE_PRESETS)||'[]');if(!Array.isArray(a))return[];return a.filter(x=>typeof x.name==='string'&&x.name.length>0&&x.name.length<=40&&validLayout(x.layout)).slice(0,30).map(x=>({name:x.name,layout:validLayout(x.layout)}))}catch{return[]}}
export function savePresets(storage,presets){try{storage.setItem(STORAGE_PRESETS,JSON.stringify(presets));return true}catch{return false}}
export function clampHeight(preferred,viewportHeight){
  const max=Math.max(90,viewportHeight*.4);
  return Math.max(90,Math.min(Number(preferred)||150,max));
}
export function resolvedPalette(mode,sku){
  if(mode==='mono')return'mono';
  if(mode==='app')return'app';
  if(sku==='TE032AS001')return'ep133';
  if(sku==='TE032AS006')return'ep40';
  return'app';
}

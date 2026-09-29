export const TIME_MODES=Object.freeze(['off','bpm','bar']);
export const BAR_VALUES=Object.freeze([1,2]);
export const PROPERTY_DEBOUNCE_MS=120;

export function normalizePlayMode(value,playModes=[]){
  const modes=Array.isArray(playModes)&&playModes.length?playModes:['oneshot','key','legato'];
  if(typeof value==='number'&&modes[value])return modes[value];
  const normalized=String(value||'oneshot').toLowerCase();
  return modes.includes(normalized)?normalized:modes[0];
}

export function normalizeTimeMode(value){
  if(typeof value==='number'&&TIME_MODES[value])return TIME_MODES[value];
  const normalized=String(value||'off').toLowerCase();
  return TIME_MODES.includes(normalized)?normalized:'off';
}

export function nearestBar(value,barValues=BAR_VALUES){
  const values=Array.isArray(barValues)&&barValues.length?barValues:BAR_VALUES;
  const numeric=Number(value);
  if(!Number.isFinite(numeric)||numeric<=0)return values[0];
  return values.reduce((best,item)=>Math.abs(item-numeric)<Math.abs(best-numeric)?item:best,values[0]);
}

const row=(slot,key,label,value,{numeric=false,drag='',isPending=()=>false,escapeHtml=String}={})=>{
  const pending=isPending(key)?' pending':'';
  const previous=numeric?'Decrease ':'Previous ';
  const next=numeric?'Increase ':'Next ';
  const left=numeric?'−':'◀',right=numeric?'+':'▶';
  return'<div class="ep133-property-row'+pending+'" data-property-row="'+escapeHtml(key)+'">'+
    '<span class="ep133-property-label">'+escapeHtml(label)+'</span>'+
    '<span class="ep133-property-control">'+
      '<button type="button" data-property="'+escapeHtml(key)+'" data-direction="-1" aria-label="'+previous+escapeHtml(label)+'">'+left+'</button>'+
      '<span class="ep133-prop-value"'+(drag?' data-drag="'+escapeHtml(drag)+'"':'')+'>'+escapeHtml(value)+'</span>'+
      '<button type="button" data-property="'+escapeHtml(key)+'" data-direction="1" aria-label="'+next+escapeHtml(label)+'">'+right+'</button>'+
    '</span>'+
  '</div>';
};

export function renderSampleProperties(slot,{playModes=[],barValues=BAR_VALUES,isPending=()=>false,escapeHtml=String}={}){
  if(!slot?.file)return'';
  const meta=slot.meta||{};
  const options={isPending,escapeHtml};
  const playMode=normalizePlayMode(meta['sound.playmode'],playModes);
  const pitch=Number.isFinite(Number(meta['sound.pitch']))?Number(meta['sound.pitch']):0;
  const timeMode=normalizeTimeMode(meta['time.mode']);
  const bpm=Number.isFinite(Number(meta['sound.bpm']))&&Number(meta['sound.bpm'])>0?Math.round(Number(meta['sound.bpm'])):120;
  const bars=nearestBar(meta['sound.bars'],barValues);
  let html=row(slot,'sound.playmode','PLAY MODE',playMode.toUpperCase(),options);
  html+='<div class="ep133-property-separator"></div>';
  html+=row(slot,'sound.pitch','PITCH',pitch>0?'+'+pitch:String(pitch),{...options,numeric:true});
  html+='<div class="ep133-property-separator"></div>';
  html+=row(slot,'time.mode','TIME MODE',timeMode.toUpperCase(),options);
  if(timeMode==='bpm')html+=row(slot,'sound.bpm','BPM',String(bpm),{...options,numeric:true,drag:'bpm'});
  if(timeMode==='bar')html+=row(slot,'sound.bars','BARS',bars===1?'1 BAR':bars+' BARS',options);
  return html;
}

export function getSamplePropertyChange(slot,key,direction,{playModes=[],barValues=BAR_VALUES}={}){
  const meta=slot?.meta||{};
  const step=Number(direction)||0;
  if(key==='sound.playmode'){
    const modes=Array.isArray(playModes)&&playModes.length?playModes:['oneshot','key','legato'];
    const current=normalizePlayMode(meta[key],modes);
    const index=modes.indexOf(current);
    return{value:modes[(index+step+modes.length)%modes.length],extra:{}};
  }
  if(key==='sound.pitch'){
    const current=Number.isFinite(Number(meta[key]))?Number(meta[key]):0;
    return{value:Math.max(-12,Math.min(12,Math.round(current)+step)),extra:{}};
  }
  if(key==='time.mode'){
    const current=normalizeTimeMode(meta[key]);
    const index=TIME_MODES.indexOf(current);
    const value=TIME_MODES[(index+step+TIME_MODES.length)%TIME_MODES.length];
    const extra={};
    if(value==='bpm'&&!(Number(meta['sound.bpm'])>=1&&Number(meta['sound.bpm'])<=200))extra['sound.bpm']=120;
    if(value==='bar'&&!barValues.includes(Number(meta['sound.bars'])))extra['sound.bars']=barValues[0];
    return{value,extra};
  }
  if(key==='sound.bpm'){
    const current=Number.isFinite(Number(meta[key]))&&Number(meta[key])>0?Math.round(Number(meta[key])):120;
    return{value:Math.max(1,Math.min(200,current+step)),extra:{}};
  }
  if(key==='sound.bars'){
    const current=nearestBar(meta[key],barValues);
    const index=barValues.indexOf(current);
    const nextIndex=Math.max(0,Math.min(barValues.length-1,index+step));
    return{value:barValues[nextIndex],extra:{}};
  }
  return null;
}

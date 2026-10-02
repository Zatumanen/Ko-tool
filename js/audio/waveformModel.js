import{
  addChopCut,buildEvenChopCuts,detectTransientChopCuts,getChopRanges,
  moveChopCut,nearestChopCutIndex,normalizeChopCuts,removeChopCut
}from './chopEngine.js?v=20261003-2';

const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const MODES=new Set(['manual','transients','even']);
const selectionFor=(buffer,start=0,end=null)=>{
  const duration=Math.max(0,finite(buffer?.duration,buffer.length/buffer.sampleRate));
  let a=clamp(finite(start,0),0,duration),b=end==null?duration:clamp(finite(end,duration),0,duration);
  if(b<a)[a,b]=[b,a];
  const min=duration>0?Math.min(duration,1/Math.max(1,buffer.sampleRate)):0;
  if(duration>0&&b-a<min)b=Math.min(duration,a+min);
  if(duration>0&&b<=a){a=Math.max(0,duration-min);b=duration;}
  return{start:a,end:b,duration:b-a,totalDuration:duration};
};

export function createWaveformModel(buffer,initial={}){
  if(!buffer?.getChannelData||!Number.isFinite(buffer?.sampleRate)||buffer.sampleRate<=0||!Number.isInteger(buffer?.length)||buffer.length<=0)
    throw new Error('Waveform model requires a valid audio buffer.');
  const totalDuration=buffer.duration||buffer.length/buffer.sampleRate;
  let selection=selectionFor(buffer,initial.selection?.start??0,initial.selection?.end??totalDuration);
  let playhead=clamp(finite(initial.playhead,selection.start),0,totalDuration);
  let zoom=clamp(Math.round(finite(initial.zoom,1)),1,16);
  let gainDb=clamp(finite(initial.gainDb,0),-24,12);
  let normalize=!!initial.normalize;
  let chopMode=MODES.has(initial.chopMode)?initial.chopMode:'manual';
  let chopTarget=clamp(Math.round(finite(initial.chopTarget,8)),1,64);
  let chopCuts=normalizeChopCuts(buffer,initial.chopCuts||[0],{minSpacingMs:0});
  if(!chopCuts.length)chopCuts=[0];
  let focusedCutIndex=Number.isInteger(initial.focusedCutIndex)?initial.focusedCutIndex:null;

  const syncModeCuts=()=>{
    if(chopMode==='transients')chopCuts=detectTransientChopCuts(buffer,{slices:chopTarget});
    else if(chopMode==='even')chopCuts=buildEvenChopCuts(buffer,chopTarget);
    if(!chopCuts.length)chopCuts=[0];
    focusedCutIndex=null;
  };
  if(chopMode!=='manual')syncModeCuts();

  const snapshot=()=>Object.freeze({
    totalDuration,selection:Object.freeze({...selection}),playhead,zoom,gainDb,normalize,
    chop:Object.freeze({mode:chopMode,target:chopTarget,cuts:Object.freeze([...chopCuts]),focusedCutIndex})
  });
  const setSelection=(start,end)=>{selection=selectionFor(buffer,start,end);playhead=clamp(playhead,selection.start,selection.end);return snapshot();};
  const setPlayhead=value=>{playhead=clamp(finite(value,playhead),0,totalDuration);return snapshot();};
  const setZoom=value=>{zoom=clamp(Math.round(finite(value,1)),1,16);return snapshot();};
  const setGainDb=value=>{gainDb=clamp(finite(value,0),-24,12);return snapshot();};
  const setNormalize=value=>{normalize=!!value;return snapshot();};
  const setChopMode=value=>{chopMode=MODES.has(value)?value:'manual';if(chopMode!=='manual')syncModeCuts();return snapshot();};
  const setChopTarget=value=>{chopTarget=clamp(Math.round(finite(value,8)),1,64);if(chopMode!=='manual')syncModeCuts();return snapshot();};
  const switchToManual=()=>{chopMode='manual';return snapshot();};
  const setFocusedCut=value=>{const index=Number(value);focusedCutIndex=Number.isInteger(index)&&index>0&&index<chopCuts.length?index:null;return snapshot();};
  const focusNearestCut=(frame,options={})=>{const index=nearestChopCutIndex(buffer,chopCuts,frame,options);focusedCutIndex=index>0?index:null;return focusedCutIndex;};
  const addCut=frame=>{chopCuts=addChopCut(buffer,chopCuts,frame);switchToManual();focusNearestCut(frame,{maxDistanceMs:1000});return snapshot();};
  const moveCut=(index,frame)=>{chopCuts=moveChopCut(buffer,chopCuts,index,frame);switchToManual();focusNearestCut(frame,{maxDistanceMs:1000});return snapshot();};
  const removeCut=index=>{chopCuts=removeChopCut(buffer,chopCuts,index);focusedCutIndex=null;switchToManual();return snapshot();};
  const clearCuts=()=>{chopCuts=[0];focusedCutIndex=null;chopMode='manual';return snapshot();};
  const reset=()=>{selection=selectionFor(buffer,0,totalDuration);playhead=0;zoom=1;gainDb=0;normalize=false;chopMode='manual';chopTarget=8;chopCuts=[0];focusedCutIndex=null;return snapshot();};
  const viewRange=()=>{const width=Math.max(.001,totalDuration/zoom);if(width>=totalDuration)return Object.freeze({start:0,end:totalDuration});const center=clamp(playhead,0,totalDuration),start=clamp(center-width/2,0,totalDuration-width);return Object.freeze({start,end:start+width});};
  const frameAtTime=time=>clamp(Math.round(finite(time,0)*buffer.sampleRate),0,buffer.length-1);
  const timeAtFrame=frame=>clamp(Math.round(finite(frame,0)),0,buffer.length-1)/buffer.sampleRate;
  const ranges=()=>getChopRanges(buffer,chopCuts);
  const selectionPeak=()=>{const first=Math.max(0,Math.floor(selection.start*buffer.sampleRate)),last=Math.min(buffer.length,Math.max(first+1,Math.ceil(selection.end*buffer.sampleRate)));let peak=0;for(let channel=0;channel<buffer.numberOfChannels;channel++){const data=buffer.getChannelData(channel);for(let frame=first;frame<last;frame++)peak=Math.max(peak,Math.abs(data[frame]||0));}return peak;};

  return Object.freeze({
    getState:snapshot,setSelection,setPlayhead,setZoom,setGainDb,setNormalize,
    setChopMode,setChopTarget,switchToManual,setFocusedCut,focusNearestCut,
    addCut,moveCut,removeCut,clearCuts,reset,viewRange,frameAtTime,timeAtFrame,
    getChopRanges:ranges,getSelectionPeak:selectionPeak
  });
}

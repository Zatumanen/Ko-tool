import{renderWaveformEdit}from './waveform-editor.js?v=20261001-1';

const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const integer=(value,fallback=0)=>Number.isFinite(Number(value))?Math.floor(Number(value)):fallback;

const validBuffer=buffer=>!!(
  buffer?.getChannelData&&
  Number.isInteger(buffer?.length)&&buffer.length>0&&
  Number.isFinite(buffer?.sampleRate)&&buffer.sampleRate>0&&
  Number.isInteger(buffer?.numberOfChannels)&&buffer.numberOfChannels>0
);

export const CHOP_TRANSIENT_DEFAULTS=Object.freeze({
  analysisHz:500,
  rmsWindowMs:20,
  hopMs:5,
  neighborhoodMs:80,
  baselineMs:400,
  attackBacktrackRatio:.3,
  minSpacingMs:50,
  manualMinSpacingMs:5
});

export function normalizeChopCuts(buffer,cuts,{minSpacingMs=CHOP_TRANSIENT_DEFAULTS.manualMinSpacingMs}={}){
  if(!validBuffer(buffer))return[];
  const minSpacing=Math.max(1,Math.floor(buffer.sampleRate*Math.max(0,finite(minSpacingMs))/1000));
  const normalized=[0];
  const values=(cuts||[])
    .map(value=>integer(value,-1))
    .filter(value=>value>0&&value<buffer.length)
    .sort((a,b)=>a-b);
  for(const value of values){
    if(value-normalized.at(-1)>=minSpacing)normalized.push(value);
  }
  return normalized;
}

export function buildEvenChopCuts(buffer,slices=8){
  if(!validBuffer(buffer))return[];
  const count=Math.max(1,Math.min(64,integer(slices,8)));
  const cuts=[0];
  for(let index=1;index<count;index++){
    const frame=Math.floor(buffer.length*index/count);
    if(frame>cuts.at(-1)&&frame<buffer.length)cuts.push(frame);
  }
  return cuts;
}

export function detectTransientChopCuts(buffer,{
  slices=8,
  analysisHz=CHOP_TRANSIENT_DEFAULTS.analysisHz,
  rmsWindowMs=CHOP_TRANSIENT_DEFAULTS.rmsWindowMs,
  hopMs=CHOP_TRANSIENT_DEFAULTS.hopMs,
  neighborhoodMs=CHOP_TRANSIENT_DEFAULTS.neighborhoodMs,
  baselineMs=CHOP_TRANSIENT_DEFAULTS.baselineMs,
  attackBacktrackRatio=CHOP_TRANSIENT_DEFAULTS.attackBacktrackRatio,
  minSpacingMs=CHOP_TRANSIENT_DEFAULTS.minSpacingMs
}={}){
  if(!validBuffer(buffer))return[];
  const targetCount=Math.max(1,Math.min(64,integer(slices,8)));
  const targetPeakCount=targetCount-1;
  if(targetPeakCount<=0)return[0];

  const targetHz=Math.max(50,finite(analysisHz)||500);
  const step=Math.max(1,Math.floor(buffer.sampleRate/targetHz));
  const frameCount=Math.max(1,Math.floor(buffer.length/step));
  const down=new Float32Array(frameCount);
  const channels=Array.from({length:buffer.numberOfChannels},(_,index)=>buffer.getChannelData(index));
  for(let index=0;index<frameCount;index++){
    const frame=Math.min(buffer.length-1,index*step);
    let sample=0;
    for(const channel of channels)sample+=channel[frame]||0;
    down[index]=sample/channels.length;
  }
  const effectiveRate=buffer.sampleRate/step;
  const windowSize=Math.max(8,Math.floor(effectiveRate*Math.max(1,finite(rmsWindowMs))/1000));
  const hop=Math.max(1,Math.floor(effectiveRate*Math.max(1,finite(hopMs))/1000));
  if(down.length<=windowSize)return[0];

  const envelopeLength=Math.max(1,Math.floor((down.length-windowSize)/hop)+1);
  const envelope=new Float32Array(envelopeLength);
  for(let index=0;index<envelopeLength;index++){
    let energy=0;
    const start=index*hop;
    for(let offset=0;offset<windowSize;offset++){
      const value=down[start+offset]||0;
      energy+=value*value;
    }
    envelope[index]=Math.sqrt(energy/windowSize);
  }

  const neighborhoodFrames=Math.max(2,Math.floor((Math.max(1,finite(neighborhoodMs))/1000)*effectiveRate/hop));
  const baselineFrames=Math.max(
    neighborhoodFrames*3,
    Math.floor((Math.max(1,finite(baselineMs))/1000)*effectiveRate/hop)
  );
  const candidates=[];
  for(let index=neighborhoodFrames;index<envelopeLength-neighborhoodFrames;index++){
    const amplitude=envelope[index];
    if(amplitude<.001)continue;
    let isPeak=true;
    for(let offset=1;offset<=neighborhoodFrames;offset++){
      if(envelope[index-offset]>amplitude||envelope[index+offset]>amplitude){
        isPeak=false;break;
      }
    }
    if(!isPeak)continue;
    let sum=0,count=0;
    const low=Math.max(0,index-baselineFrames);
    const high=Math.min(envelopeLength,index+baselineFrames);
    for(let cursor=low;cursor<high;cursor++){
      if(Math.abs(cursor-index)<neighborhoodFrames)continue;
      sum+=envelope[cursor];count++;
    }
    const baseline=count?sum/count:amplitude;
    candidates.push({
      index,
      amplitude,
      prominence:amplitude/(baseline+.005)
    });
  }

  candidates.sort((a,b)=>b.prominence-a.prominence||b.amplitude-a.amplitude||a.index-b.index);
  const selected=candidates.slice(0,targetPeakCount).sort((a,b)=>a.index-b.index);
  const minSpacing=Math.max(1,Math.floor(buffer.sampleRate*Math.max(1,finite(minSpacingMs))/1000));
  const backtrackRatio=Math.max(.01,Math.min(.99,finite(attackBacktrackRatio)||.3));
  const cuts=[0];
  for(const candidate of selected){
    const threshold=candidate.amplitude*backtrackRatio;
    let attackIndex=candidate.index;
    for(let cursor=candidate.index;cursor>0;cursor--){
      if(envelope[cursor]<threshold){attackIndex=cursor;break;}
    }
    const frame=Math.floor(attackIndex*hop*step);
    if(frame>0&&frame-cuts.at(-1)>=minSpacing&&frame<buffer.length)cuts.push(frame);
  }
  return normalizeChopCuts(buffer,cuts,{minSpacingMs});
}

export function addChopCut(buffer,cuts,frame,{minSpacingMs=CHOP_TRANSIENT_DEFAULTS.manualMinSpacingMs}={}){
  return normalizeChopCuts(buffer,[...(cuts||[]),integer(frame,0)],{minSpacingMs});
}

export function moveChopCut(buffer,cuts,index,frame,{minSpacingMs=CHOP_TRANSIENT_DEFAULTS.manualMinSpacingMs}={}){
  const normalized=normalizeChopCuts(buffer,cuts,{minSpacingMs:0});
  const target=integer(index,-1);
  if(target<=0||target>=normalized.length)return normalizeChopCuts(buffer,normalized,{minSpacingMs});
  normalized[target]=integer(frame,normalized[target]);
  return normalizeChopCuts(buffer,normalized,{minSpacingMs});
}

export function removeChopCut(buffer,cuts,index){
  const normalized=normalizeChopCuts(buffer,cuts,{minSpacingMs:0});
  const target=integer(index,-1);
  if(target<=0||target>=normalized.length)return normalized;
  normalized.splice(target,1);
  return normalized;
}

export function getChopRanges(buffer,cuts){
  if(!validBuffer(buffer))return[];
  const normalized=normalizeChopCuts(buffer,cuts,{minSpacingMs:0});
  return normalized.map((start,index)=>{
    const end=index+1<normalized.length?normalized[index+1]:buffer.length;
    return Object.freeze({
      index,
      startFrame:start,
      endFrame:end,
      frames:end-start,
      start:start/buffer.sampleRate,
      end:end/buffer.sampleRate,
      duration:(end-start)/buffer.sampleRate
    });
  }).filter(range=>range.frames>0);
}

export function nearestChopCutIndex(buffer,cuts,frame,{maxDistanceMs=12}={}){
  if(!validBuffer(buffer))return-1;
  const normalized=normalizeChopCuts(buffer,cuts,{minSpacingMs:0});
  const target=integer(frame,-1);
  const maxDistance=Math.max(1,Math.floor(buffer.sampleRate*Math.max(0,finite(maxDistanceMs))/1000));
  let best=-1,distance=Infinity;
  for(let index=1;index<normalized.length;index++){
    const next=Math.abs(normalized[index]-target);
    if(next<distance){distance=next;best=index;}
  }
  return distance<=maxDistance?best:-1;
}

export async function renderChopWavs(buffer,cuts,{
  gainDb=0,
  normalize=false,
  playmode='oneshot',
  referenceModuleProvider=null
}={}){
  const ranges=getChopRanges(buffer,cuts);
  const outputs=[];
  for(const range of ranges){
    const rendered=await renderWaveformEdit(buffer,{
      start:range.start,
      end:range.end,
      gainDb,
      normalize,
      playmode,
      referenceModuleProvider
    });
    outputs.push(Object.freeze({
      ...range,
      buffer:rendered.buffer,
      blob:rendered.blob,
      epStorage:rendered.epStorage
    }));
  }
  return outputs;
}

import{renderWaveformEdit}from './waveform-editor.js?v=20261001-1';
import{getChopRanges}from './chopEngine.js?v=20261003-2';

export{
  CHOP_TRANSIENT_DEFAULTS,isWaveformBuffer,normalizeChopCuts,buildEvenChopCuts,
  detectTransientChopCuts,addChopCut,moveChopCut,removeChopCut,getChopRanges,
  nearestChopCutIndex
}from './chopEngine.js?v=20261003-2';

export async function renderChopWavs(buffer,cuts,{
  gainDb=0,
  normalize=false,
  playmode='oneshot',
  metadata=null,
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
      metadata,
      referenceModuleProvider
    });
    outputs.push(Object.freeze({
      ...range,
      buffer:rendered.buffer,
      blob:rendered.blob,
      epStorage:rendered.epStorage,
      metadata:rendered.metadata
    }));
  }
  return outputs;
}

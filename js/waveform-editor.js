import{openSharedWaveformEditor}from './shared-waveform-editor.js?v=20261003-2';
import{classifyRepitchInput,markSpeedUppercutWav}from './ep133/repitchProvenance.js?v=20261113-1';

export function openWaveformEditor(item,options={}){
  const assertTrustedSource=async()=>{
    const blob=item?.result?.blob;
    if(!blob||typeof blob.arrayBuffer!=='function')
      throw new Error('Cannot verify SpeedUpperCut edit source WAV.');
    const source=new Uint8Array(await blob.arrayBuffer());
    const verdict=await classifyRepitchInput(source,{filename:item?.file?.name||'source.wav'});
    if(verdict.kind!=='trusted')
      throw new Error('Edited WAV needs verified SpeedUpperCut ×2 provenance; no output was saved.');
  };
  return openSharedWaveformEditor({
    buffer:item?.result?.buffer,
    name:item?.file?.name||'AUDIO',
    playmode:item?.playmode||item?.result?.metadata?.['sound.playmode']||'oneshot',
    metadata:item?.result?.metadata||null
  },{
    ...options,
    onApply:async(edited,details)=>{
      await assertTrustedSource();
      const blob=await markSpeedUppercutWav(edited.blob);
      await options.onApply?.({...edited,blob},details);
    },
    onExportChops:async(outputs,details)=>{
      await assertTrustedSource();
      const tagged=[];
      for(const output of outputs){
        const blob=await markSpeedUppercutWav(output.blob);
        tagged.push({...output,blob});
      }
      await options.onExportChops?.(tagged,details);
    },
    title:'WAVEFORM / TRIM EDITOR',
    applyLabel:'APPLY CROP',
    exportLabel:'EXPORT CHOPS',
    allowApply:true,
    allowExportChops:true
  });
}

export{openSharedWaveformEditor};

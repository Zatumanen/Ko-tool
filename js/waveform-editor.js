import{openSharedWaveformEditor}from './shared-waveform-editor.js?v=20261003-2';

export function openWaveformEditor(item,options={}){
  return openSharedWaveformEditor({
    buffer:item?.result?.buffer,
    name:item?.file?.name||'AUDIO',
    playmode:item?.playmode||item?.result?.metadata?.['sound.playmode']||'oneshot',
    metadata:item?.result?.metadata||null
  },{
    ...options,
    title:'WAVEFORM / TRIM EDITOR',
    applyLabel:'APPLY CROP',
    exportLabel:'EXPORT CHOPS',
    allowApply:true,
    allowExportChops:true
  });
}

export{openSharedWaveformEditor};

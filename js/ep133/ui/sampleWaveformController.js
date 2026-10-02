import{s16PcmToAudioBuffer}from '../../audio/audioEngine.js?v=20261001-1';
import{openSharedWaveformEditor}from '../../shared-waveform-editor.js?v=20261003-2';
import{createZip}from '../../zip.js?v=20261001-1';

const safeBaseName=value=>String(value||'sample')
  .replace(/\.[^.]+$/,'')
  .replace(/[\\/:*?"<>|]/g,'_')
  .trim()||'sample';

const browserAudioContext=()=>{
  const C=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!C)throw new Error('Web Audio API is not supported in this browser.');
  return new C();
};

const browserSaveBlob=(blob,name,{documentRef=globalThis.document,urlApi=globalThis.URL}={})=>{
  const url=urlApi.createObjectURL(blob);
  const anchor=documentRef.createElement('a');
  anchor.href=url;anchor.download=name;documentRef.body.appendChild(anchor);anchor.click();anchor.remove();
  setTimeout(()=>urlApi.revokeObjectURL(url),1200);
};

export function validateEditableEpSample(metadata={},bytes){
  const channels=Number(metadata?.channels),sampleRate=Number(metadata?.samplerate??metadata?.sample_rate),format=String(metadata?.format||'').toLowerCase();
  const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes||[]);
  if(!Number.isInteger(channels)||channels<1||channels>2)throw new Error('Sample waveform requires mono or stereo metadata.');
  if(!Number.isFinite(sampleRate)||sampleRate<=0)throw new Error('Sample waveform requires a valid sample rate.');
  if(format&&format!=='s16')throw new Error('Sample waveform currently supports EP s16 PCM only.');
  if(!data.byteLength||data.byteLength%(channels*2)!==0)throw new Error('Sample PCM length is invalid.');
  return Object.freeze({channels,sampleRate,data});
}

export function createSampleWaveformController({
  withFileTransaction,
  openEditor=openSharedWaveformEditor,
  pcmToBuffer=s16PcmToAudioBuffer,
  createZipFn=createZip,
  saveBlob=browserSaveBlob,
  createAudioContext=browserAudioContext,
  reportError=()=>{}
}={}){
  if(typeof withFileTransaction!=='function')throw new TypeError('Sample waveform controller requires FILE read transactions.');
  const editorState={ctx:null};
  let activeEditor=null;

  const readSample=async inputSlot=>{
    const slotId=Number(inputSlot?.nodeId||inputSlot?.id);
    if(!Number.isInteger(slotId)||slotId<1||slotId>999||!inputSlot?.file)throw new Error('Sample is not available for waveform editing.');
    return withFileTransaction('sample waveform read',async fileOps=>{
      const result=await fileOps.getFile(slotId);
      const metadata=inputSlot.meta||await fileOps.getFileMetadata(slotId);
      const bytes=result?.data instanceof Uint8Array?result.data:new Uint8Array(result?.data||[]);
      const validated=validateEditableEpSample(metadata,bytes);
      const buffer=pcmToBuffer(validated.data,{sampleRate:validated.sampleRate,channels:validated.channels});
      return Object.freeze({
        slotId,
        name:String(metadata?.name||inputSlot?.file?.name||result?.name||('slot-'+slotId)),
        metadata:Object.freeze({...metadata}),
        buffer
      });
    });
  };

  const open=async slot=>{
    try{
      activeEditor?.close?.();
      const source=await readSample(slot);
      const base=safeBaseName(source.name);
      activeEditor=openEditor({
        buffer:source.buffer,
        name:'SLOT '+String(source.slotId).padStart(3,'0')+' · '+source.name,
        metadata:source.metadata,
        playmode:source.metadata['sound.playmode']||'oneshot'
      },{
        state:editorState,
        createAudioContext,
        title:'MY EP · WAVEFORM / CHOP',
        applyLabel:'DOWNLOAD EDIT',
        exportLabel:'DOWNLOAD CHOPS',
        onApply:async edit=>{
          saveBlob(edit.blob,base+'-edited.wav');
        },
        onExportChops:async outputs=>{
          const files=outputs.map((output,index)=>({
            path:base+'-'+String(index+1).padStart(2,'0')+'.wav',
            blob:output.blob
          }));
          const zip=await createZipFn(files);
          saveBlob(zip,base+'-chops.zip');
        },
        onClose:()=>{activeEditor=null;},
        showError:message=>reportError('COULD NOT EDIT SAMPLE WAVEFORM.',message instanceof Error?message:new Error(String(message||'Waveform operation failed.')))
      });
      return activeEditor;
    }catch(error){
      reportError('COULD NOT OPEN SAMPLE WAVEFORM.',error);
      return null;
    }
  };

  const close=()=>{activeEditor?.close?.();activeEditor=null;};
  return Object.freeze({open,close,readSample,getActiveEditor:()=>activeEditor});
}

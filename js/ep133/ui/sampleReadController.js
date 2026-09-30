import{createEp133Wav}from '../audio.js?v=20260930-5';

export function sampleDownloadName(slot,result){
  const raw=String(slot?.meta?.name||slot?.file?.name||result?.name||'sample')
    .replace(/\.[^.]+$/,'')
    .replace(/[\\/:*?"<>|]/g,'_')
    .trim()||'sample';
  return raw+'.wav';
}

export function createSampleReadController({
  sampleStore,getMemory,isConnected,
  startPlayback,stopPlayback,
  withFileTransaction,getFile,getFileMetadata,
  captureBatchSession,assertBatchSession,
  setGlobalProgress,hideGlobalProgress,
  reportError,
  createWav=createEp133Wav,
  windowRef=globalThis.window,
  documentRef=globalThis.document,
  urlApi=globalThis.URL,
  consoleRef=globalThis.console,
  setTimeoutFn=(callback,delay)=>setTimeout(callback,delay),
  clearTimeoutFn=timer=>clearTimeout(timer),
  previewDurationMs=1050
}={}){
  let playingNodeId=null;
  let previewTimer=null;
  const runReadTransaction=operation=>typeof withFileTransaction==='function'
    ?withFileTransaction('sample download read',operation)
    :operation({getFile,getFileMetadata});
  const canonicalSlot=slot=>{
    const id=Number(slot?.id||slot?.nodeId);
    return Number.isInteger(id)&&sampleStore?.getSlot?.(id)||slot||null;
  };

  const fallbackDownload=(blob,name)=>{
    const url=urlApi.createObjectURL(blob);
    const anchor=documentRef.createElement('a');
    anchor.href=url;
    anchor.download=name;
    documentRef.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeoutFn(()=>urlApi.revokeObjectURL(url),1200);
  };

  const saveBlobAs=async(blob,name)=>{
    if(windowRef?.showSaveFilePicker){
      try{
        const handle=await windowRef.showSaveFilePicker({
          suggestedName:name,
          types:[{description:'WAV audio',accept:{'audio/wav':['.wav']}}]
        });
        const writable=await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
      }catch(error){
        if(error?.name==='AbortError')return false;
        if(error?.name!=='NotAllowedError'&&error?.name!=='SecurityError')throw error;
      }
    }
    fallbackDownload(blob,name);
    return true;
  };

  const stopPreview=async()=>{
    if(previewTimer!=null)clearTimeoutFn(previewTimer);
    previewTimer=null;
    const nodeId=playingNodeId;
    playingNodeId=null;
    getMemory()?.setPreviewing?.(null);
    if(nodeId&&isConnected()){
      try{
        await stopPlayback(nodeId);
      }catch(error){
        consoleRef?.warn?.('EP preview stop failed',error);
      }
    }
  };

  const audition=async inputSlot=>{
    const slot=canonicalSlot(inputSlot);
    if(!slot?.file||!isConnected())return;
    const nodeId=slot.nodeId||slot.id;
    try{
      if(playingNodeId)await stopPreview();
      await startPlayback(nodeId,true);
      playingNodeId=nodeId;
      getMemory()?.setPreviewing?.(slot.id);
      previewTimer=setTimeoutFn(()=>{
        if(playingNodeId===nodeId){
          playingNodeId=null;
          getMemory()?.setPreviewing?.(null);
        }
      },previewDurationMs);
    }catch(error){
      reportError?.('COULD NOT PREVIEW SAMPLE.',error);
    }
  };

  const performDownload=async(inputSlot,{saveAs=false,index=0,total=1}={})=>{
    const slot=canonicalSlot(inputSlot);
    if(!slot?.file)throw new Error('Sample is no longer available.');
    const divisor=Math.max(1,total);
    setGlobalProgress('DOWNLOAD',(index/divisor)*100);
    const{result,meta}=await runReadTransaction(async fileOps=>{
      const result=await fileOps.getFile(slot.nodeId||slot.id,(done,size)=>{
        const local=size?done/size:0;
        setGlobalProgress('DOWNLOAD',((index+local)/divisor)*100);
      });
      const meta=slot.meta||await fileOps.getFileMetadata(slot.nodeId||slot.id);
      return{result,meta};
    });
    const bytes=result?.data instanceof Uint8Array?result.data:new Uint8Array(result?.data||[]);
    const wav=await createWav(bytes,{
      name:result?.name||slot.file?.name||'sample',
      metadata:meta
    });
    const filename=sampleDownloadName(slot,result);
    if(saveAs)await saveBlobAs(wav,filename);
    else fallbackDownload(wav,filename);
    setGlobalProgress('DOWNLOAD',((index+1)/divisor)*100);
    return{wav,result,filename};
  };

  const downloadOne=async slot=>{
    try{
      return await performDownload(slot,{saveAs:true,index:0,total:1});
    }finally{
      hideGlobalProgress();
    }
  };

  const downloadMany=async selectedSlots=>{
    const sessionToken=captureBatchSession();
    try{
      for(let index=0;index<selectedSlots.length;index++){
        assertBatchSession(sessionToken);
        await performDownload(selectedSlots[index],{
          saveAs:false,
          index,
          total:selectedSlots.length
        });
      }
    }finally{
      hideGlobalProgress();
    }
  };

  return{
    audition,stopPreview,
    performDownload,downloadOne,downloadMany,
    getPlayingNodeId:()=>playingNodeId
  };
}

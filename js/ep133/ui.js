import{connectEp133,isConnected,onConnectionChange}from './index.js';
import{listDeviceFiles,getFileMetadata,uploadSampleToSlot,startPlayback,normalizeFileName}from './filesystem.js';
import{prepareEp133Sample}from './audio.js';
import{createSampleSlots,createSampleMemory}from './sampleMemory.js';

export function initEp133Browser({showError}={}){
  const open=document.getElementById('my-ep-icon');
  const panel=document.getElementById('ep133-browser');
  const close=document.getElementById('ep133-close');
  const connect=document.getElementById('ep133-connect');
  const refresh=document.getElementById('ep133-refresh');
  const list=document.getElementById('ep133-sample-list');
  const tabs=document.getElementById('ep133-sample-tabs');
  const search=document.getElementById('ep133-sample-search');
  const info=document.getElementById('ep133-sample-info');
  if(!open||!panel||!connect||!list)return;

  const setStatus=t=>{const el=document.getElementById('ep133-status');if(el)el.textContent=t;};
  const setDevice=t=>{const el=document.getElementById('ep133-device');if(el)el.textContent=t;};
  const setBusy=b=>{connect.disabled=b;refresh.disabled=b;};
  const getSoundsParentId=files=>files.find(item=>item.fileName==='/sounds'&&item.fileType==='folder')?.nodeId||0;
  const setSlotStatus=(slot,message)=>{setStatus('SLOT '+String(slot.id).padStart(3,'0')+' · '+message);};
  const getDroppedFile=event=>{
    const resultId=event.dataTransfer?.getData('application/x-speeduppercut-result');
    if(resultId){
      const item=window.__speedUpperCutFiles?.get(resultId);
      if(item?.result?.blob)return new File([item.result.blob],item.outputName||item.file.name.replace(/\.[^.]+$/,'')+'_x2.wav',{type:'audio/wav'});
    }
    const file=event.dataTransfer?.files?.[0];
    return file||null;
  };

  let soundsParentId=0;
  let soundFormats=[];
  const memory=createSampleMemory({
    listEl:list,tabsEl:tabs,searchEl:search,infoEl:info,
    onSelect:slot=>setStatus(slot?'SLOT '+String(slot.id).padStart(3,'0')+' SELECTED':'READY'),
    onPlay:async slot=>{
      try{await startPlayback(slot.nodeId||slot.id,true);setSlotStatus(slot,'PLAYING');}catch(error){showError?.(error?.message||error);}
    },
    onDrop:async(slot,event)=>{
      if(!isConnected()){showError?.('Connect EP-133 before writing a sample.');return;}
      if(!soundsParentId){showError?.('EP-133 /sounds destination is not available. Refresh the device.');return;}
      const file=getDroppedFile(event);if(!file)return;
      try{
        setSlotStatus(slot,'PREPARING...');
        const prepared=await prepareEp133Sample(file,{formats:soundFormats,onProgress:(value,info)=>setSlotStatus(slot,(info?.status||'PREPARING').toUpperCase()+' '+Math.round(value)+'%')});
        const metadata={channels:prepared.channels,samplerate:prepared.samplerate,format:prepared.format,...(prepared.metadata||{})};
        await uploadSampleToSlot({file,data:prepared.data,filename:file.name,parentId:soundsParentId,destinationId:slot.id,metadata,onProgress:(done,total)=>setSlotStatus(slot,'UPLOADING '+Math.round(done/Math.max(1,total)*100)+'%')});
        const normalizedName=normalizeFileName(file.name);
        slot.file={name:normalizedName,path:'/sounds/'+normalizedName,size:prepared.data.byteLength};
        slot.nodeId=slot.id;slot.meta={...metadata,name:normalizedName};memory.refresh();setSlotStatus(slot,'WRITTEN');
      }catch(error){setSlotStatus(slot,'WRITE ERROR');showError?.(error?.message||error);}
    }
  });

  const closePanel=()=>{panel.style.display='none';panel.setAttribute('aria-hidden','true');};
  const isMobileDevice=()=>/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'');
  open.onclick=()=>{if(isMobileDevice()){showError?.('My EP works on desktop computers only. Connect your EP-133 to a computer to use this feature.');return;}panel.style.display='flex';panel.setAttribute('aria-hidden','false');};
  open.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;e.preventDefault();open.click();});
  close.onclick=closePanel;

  const makeDraggable=windowEl=>{
    const title=windowEl?.querySelector('.title-bar');if(!windowEl||!title||title.dataset.dragReady)return;
    title.dataset.dragReady='1';let dragging=false,offsetX=0,offsetY=0;title.style.cursor='move';title.style.touchAction='none';
    const clamp=()=>{const width=windowEl.offsetWidth,height=windowEl.offsetHeight,maxX=Math.max(0,window.innerWidth-width),maxY=Math.max(0,window.innerHeight-height),left=Math.min(maxX,Math.max(0,parseFloat(windowEl.style.left)||0)),top=Math.min(maxY,Math.max(0,parseFloat(windowEl.style.top)||0));windowEl.style.left=left+'px';windowEl.style.top=top+'px';};
    title.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button'))return;const rect=windowEl.getBoundingClientRect();windowEl.style.position='fixed';windowEl.style.transform='none';windowEl.style.left=rect.left+'px';windowEl.style.top=rect.top+'px';offsetX=e.clientX-rect.left;offsetY=e.clientY-rect.top;dragging=true;title.setPointerCapture?.(e.pointerId);});
    title.addEventListener('pointermove',e=>{if(!dragging)return;const maxX=Math.max(0,window.innerWidth-windowEl.offsetWidth),maxY=Math.max(0,window.innerHeight-windowEl.offsetHeight);windowEl.style.left=Math.min(maxX,Math.max(0,e.clientX-offsetX))+'px';windowEl.style.top=Math.min(maxY,Math.max(0,e.clientY-offsetY))+'px';});
    const stop=e=>{if(!dragging)return;dragging=false;if(title.hasPointerCapture?.(e.pointerId))title.releasePointerCapture(e.pointerId);};title.addEventListener('pointerup',stop);title.addEventListener('pointercancel',stop);window.addEventListener('resize',clamp);
  };
  makeDraggable(panel.querySelector('.ep133-browser-window'));

  const readDevice=async()=>{
    setBusy(true);setStatus('READING FILES...');
    try{
      const files=await listDeviceFiles((item,total)=>setStatus('READING FILES... '+total));
      soundsParentId=getSoundsParentId(files);
      soundFormats=[];
      if(soundsParentId){try{const soundsMeta=await getFileMetadata(soundsParentId);soundFormats=Array.isArray(soundsMeta?.formats)?soundsMeta.formats:[];}catch(e){console.warn('EP /sounds metadata read failed',e);}}
      const slots=createSampleSlots(files);memory.setSlots(slots);
      const occupied=slots.filter(slot=>slot.file);let loaded=0;
      for(const slot of occupied){try{const meta=await getFileMetadata(slot.nodeId);memory.setMetadata(slot.id,meta);}catch(e){console.warn('EP sample metadata read failed for slot '+slot.id,e);}loaded+=1;setStatus('READING SAMPLE METADATA... '+loaded+'/'+occupied.length);}
      setStatus('READY · '+occupied.length+' SAMPLES · 999 SLOTS');refresh.disabled=false;
    }catch(e){setStatus('READ ERROR');showError?.(e?.message||e);}finally{setBusy(false);refresh.disabled=!isConnected();}
  };

  const renderConnection=state=>{
    if(state.connected){
      const meta=state.device?.metadata||{};
      setDevice(meta.product||state.device?.sku||'EP SERIES');
      setStatus('CONNECTED · READ/WRITE');
      connect.disabled=true;
      refresh.disabled=false;
      return;
    }
    setDevice('NO DEVICE');
    setStatus('NOT CONNECTED');
    connect.disabled=false;
    refresh.disabled=true;
    soundsParentId=0;
    soundFormats=[];
    memory.setSlots([]);
  };
  connect.onclick=async()=>{setBusy(true);setStatus('CONNECTING...');setDevice('NO DEVICE');try{const device=await connectEp133();renderConnection({connected:true,device});await readDevice();}catch(e){setStatus('NOT CONNECTED');showError?.(e?.message||e);setBusy(false);refresh.disabled=true;}};
  onConnectionChange(state=>{
    renderConnection(state);
    if(state.connected&&panel.style.display!=='none'&&list?.querySelector('.ep133-empty'))readDevice();
  });
  refresh.onclick=readDevice;search?.addEventListener('input',()=>memory.refresh());panel.addEventListener('click',e=>{if(e.target===panel)closePanel();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.style.display!=='none')closePanel();});
}

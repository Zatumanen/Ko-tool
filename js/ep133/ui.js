import{isConnected,onConnectionChange,listDeviceFiles,getFile,getFileMetadata,uploadSampleToSlot,deleteFile,startPlayback,normalizeFileName}from './index.js';
import{prepareEp133Sample}from './audio.js?v=20260922-2';
import{createSampleSlots,createSampleMemory}from './sampleMemory.js';

export function initEp133Browser({showError}={}){
  const open=document.getElementById('my-ep-icon');
  const panel=document.getElementById('ep133-browser');
  const close=document.getElementById('ep133-close');
  const refresh=document.getElementById('ep133-refresh');
  const fileList=document.getElementById('ep133-file-list');
  const fileSearch=document.getElementById('ep133-file-search');
  const breadcrumbs=document.getElementById('ep133-breadcrumbs');
  const fileInfo=document.getElementById('ep133-file-info');
  const fileDownload=document.getElementById('ep133-file-download');
  const fileDelete=document.getElementById('ep133-file-delete');
  const filesPanel=document.getElementById('ep133-files-panel');
  const samplesPanel=document.getElementById('ep133-samples-panel');
  const filesTab=document.getElementById('ep133-files-tab');
  const samplesTab=document.getElementById('ep133-samples-tab');
  const list=document.getElementById('ep133-sample-list');
  const tabs=document.getElementById('ep133-sample-tabs');
  const search=document.getElementById('ep133-sample-search');
  const info=document.getElementById('ep133-sample-info');
  if(!open||!panel||!list||!fileList)return;

  const setStatus=t=>{const el=document.getElementById('ep133-status');if(el)el.textContent=t;};
  const setDevice=t=>{const el=document.getElementById('ep133-device');if(el)el.textContent=t;};
  const setBusy=b=>{refresh.disabled=b;};
  const getSoundsParentId=files=>files.find(item=>item.fileName==='/sounds'&&item.fileType==='folder')?.nodeId||0;
  const setSlotStatus=(slot,message)=>{setStatus('SLOT '+String(slot.id).padStart(3,'0')+' · '+message);};
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const formatSize=size=>{if(!size)return '—';if(size<1024)return size+' B';if(size<1024*1024)return(size/1024).toFixed(1)+' KB';return(size/1024/1024).toFixed(2)+' MB';};
  const parentPath=path=>{if(path==='/')return '/';const parts=path.split('/').filter(Boolean);parts.pop();return parts.length?'/'+parts.join('/'):'/';};
  const baseName=path=>String(path||'').split('/').filter(Boolean).pop()||'/';
  const renderFileInfo=()=>{
    const item=selectedFile;
    fileDownload.disabled=!item||item.fileType!=='file'||!isConnected();
    fileDelete.disabled=!item||item.fileType!=='file'||!isConnected();
    if(!item){fileInfo.innerHTML='<div class="ep133-info-empty">Select a file.</div>';return;}
    fileInfo.innerHTML='<div><b>NAME</b> '+escapeHtml(baseName(item.fileName))+'</div><div><b>PATH</b> '+escapeHtml(item.fileName)+'</div><div><b>TYPE</b> '+escapeHtml(item.fileType.toUpperCase())+'</div>'+(item.fileType==='file'?'<div><b>SIZE</b> '+formatSize(item.fileSize)+'</div>':'');
  };
  const renderBreadcrumbs=()=>{
    const parts=currentPath==='/'?[]:currentPath.split('/').filter(Boolean);
    let path='';const items=['<button type="button" class="ep133-breadcrumb" data-path="/">ROOT</button>'];
    for(const part of parts){path+='/'+part;items.push('<span>/</span><button type="button" class="ep133-breadcrumb" data-path="'+escapeHtml(path)+'">'+escapeHtml(part)+'</button>');}
    breadcrumbs.innerHTML=items.join('');
    breadcrumbs.querySelectorAll('[data-path]').forEach(button=>button.onclick=()=>{currentPath=button.dataset.path;selectedFile=null;renderFiles();});
  };
  const renderFiles=()=>{
    renderBreadcrumbs();
    const query=(fileSearch.value||'').trim().toLowerCase();
    const rows=query?deviceFiles.filter(item=>item.fileName.toLowerCase().includes(query)):deviceFiles.filter(item=>parentPath(item.fileName)===currentPath);
    fileList.innerHTML='';
    if(currentPath!=='/'&&!query){const up=document.createElement('button');up.type='button';up.className='ep133-file-row ep133-up-row';up.innerHTML='<span class="ep133-file-type">DIR</span><span class="ep133-file-name">..</span><span class="ep133-file-size">—</span>';up.onclick=()=>{currentPath=parentPath(currentPath);selectedFile=null;renderFiles();};fileList.appendChild(up);}
    rows.sort((a,b)=>a.fileType===b.fileType?baseName(a.fileName).localeCompare(baseName(b.fileName)):a.fileType==='folder'?-1:1).forEach(item=>{
      const row=document.createElement('button');row.type='button';row.className='ep133-file-row'+(selectedFile?.nodeId===item.nodeId?' selected':'');
      row.innerHTML='<span class="ep133-file-type">'+(item.fileType==='folder'?'DIR':'FILE')+'</span><span class="ep133-file-name">'+escapeHtml(baseName(item.fileName))+'</span><span class="ep133-file-size">'+(item.fileType==='file'?formatSize(item.fileSize):'—')+'</span>';
      row.onclick=()=>{if(item.fileType==='folder'){currentPath=item.fileName;selectedFile=null;renderFiles();return;}selectedFile=item;renderFiles();setStatus('FILE '+baseName(item.fileName)+' SELECTED');};
      fileList.appendChild(row);
    });
    if(!fileList.children.length)fileList.innerHTML='<div class="ep133-empty">No files in this location.</div>';
    renderFileInfo();
  };
  const downloadFile=async()=>{
    if(!selectedFile||selectedFile.fileType!=='file'||!isConnected())return;
    try{setStatus('DOWNLOADING '+baseName(selectedFile.fileName)+' · 0%');const result=await getFile(selectedFile.nodeId,(done,total)=>setStatus('DOWNLOADING '+baseName(selectedFile.fileName)+' · '+Math.round(done/Math.max(1,total)*100)+'%'));const blob=new Blob([result.data],{type:'application/octet-stream'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=result.name||baseName(selectedFile.fileName);document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),0);setStatus('DOWNLOADED · '+baseName(selectedFile.fileName));}catch(error){showError?.(error?.message||error);}
  };
  const deleteSelectedFile=async()=>{
    if(!selectedFile||selectedFile.fileType!=='file'||!isConnected())return;
    try{const name=baseName(selectedFile.fileName);setStatus('DELETING '+name+'...');await deleteFile(selectedFile.nodeId);deviceFiles=deviceFiles.filter(item=>item.nodeId!==selectedFile.nodeId);selectedFile=null;renderFiles();setStatus('DELETED · '+name);}catch(error){showError?.(error?.message||error);}
  };
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
  let deviceFiles=[];
  let currentPath='/';
  let selectedFile=null;
  const memory=createSampleMemory({
    listEl:list,tabsEl:tabs,searchEl:search,infoEl:info,
    onSelect:slot=>setStatus(slot?'SLOT '+String(slot.id).padStart(3,'0')+' SELECTED':'READY'),
    onPlay:async slot=>{
      try{await startPlayback(slot.nodeId||slot.id,true);setSlotStatus(slot,'PLAYING');}catch(error){showError?.(error?.message||error);}
    },
    onDelete:async slot=>{if(!isConnected())throw new Error('Connect EP-133 before deleting a sample.');setSlotStatus(slot,'DELETING...');await deleteFile(slot.nodeId);setSlotStatus(slot,'DELETED');},
    onDownload:async slot=>{if(!isConnected())throw new Error('Connect EP-133 before downloading a sample.');setSlotStatus(slot,'DOWNLOADING 0%');const result=await getFile(slot.nodeId,(done,total)=>setSlotStatus(slot,'DOWNLOADING '+Math.round(done/Math.max(1,total)*100)+'%'));const blob=new Blob([result.data],{type:'audio/wav'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=result.name||slot.file?.name||('sample_'+String(slot.id).padStart(3,'0')+'.wav');document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),0);setSlotStatus(slot,'DOWNLOADED');},
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
  filesTab?.addEventListener('click',()=>{filesPanel.hidden=false;samplesPanel.hidden=true;filesTab.classList.add('selected');samplesTab.classList.remove('selected');});
  samplesTab?.addEventListener('click',()=>{filesPanel.hidden=true;samplesPanel.hidden=false;samplesTab.classList.add('selected');filesTab.classList.remove('selected');});
  fileSearch?.addEventListener('input',()=>{currentPath='/';selectedFile=null;renderFiles();});
  fileDownload?.addEventListener('click',downloadFile);
  fileDelete?.addEventListener('click',deleteSelectedFile);

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
      deviceFiles=await listDeviceFiles((item,total)=>setStatus('READING FILES... '+total));
      currentPath='/';selectedFile=null;renderFiles();
      const files=deviceFiles;
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
      refresh.disabled=false;
      return;
    }
    setDevice('NO DEVICE');
    setStatus('NOT CONNECTED');
    refresh.disabled=true;
    soundsParentId=0;
    soundFormats=[];
    deviceFiles=[];selectedFile=null;renderFiles();memory.setSlots([]);
  };
  renderFiles();
  renderFileInfo();
  onConnectionChange(state=>{
    renderConnection(state);
    if(state.connected&&panel.style.display!=='none'&&list?.querySelector('.ep133-empty'))readDevice();
  });
  refresh.onclick=readDevice;search?.addEventListener('input',()=>memory.refresh());panel.addEventListener('click',e=>{if(e.target===panel)closePanel();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.style.display!=='none')closePanel();});
}

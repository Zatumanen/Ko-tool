import{connectEp133,isConnected,onConnectionChange,onFileEvent,onMidiActivity,listDeviceFiles,getFile,getFileMetadata,getFileInfo,moveFile,uploadSampleToSlot,deleteFile,setFileMetadata,startPlayback,stopPlayback,normalizeFileName}from './index.js?v=20260923-9';
import{TE_SYSEX_FILE_CAPABILITY_READ,TE_SYSEX_FILE_CAPABILITY_WRITE,TE_SYSEX_FILE_CAPABILITY_DELETE,TE_SYSEX_FILE_CAPABILITY_MOVE,TE_SYSEX_FILE_CAPABILITY_PLAYBACK,TE_SYSEX_FILE_FILE_TYPE_FILE,TE_SYSEX_FILE_EVENT_METADATA_UPDATED,TE_SYSEX_FILE_EVENT_FILE_ADDED,TE_SYSEX_FILE_EVENT_FILE_UPDATED,TE_SYSEX_FILE_EVENT_FILE_DELETED,TE_SYSEX_FILE_EVENT_FILE_MOVED}from './constants.js';
import{prepareEp133Sample,createEp133Wav}from './audio.js?v=20260923-2';
import{createSampleSlots,createSampleMemory,DEFAULT_SAMPLE_TABS}from './sampleMemory.js?v=20260923-7';
import{outputFileName}from '../output-name.js';
import{createZip}from '../zip.js?v=20260921-7';

export function initEp133Browser({showError}={}){
  const open=document.getElementById('my-ep-icon');
  const panel=document.getElementById('ep133-browser');
  const close=document.getElementById('ep133-close');
  const title=document.getElementById('ep133-browser-title');
  const sampleCount=document.getElementById('ep133-sample-count');
  const txIndicator=document.getElementById('ep133-tx-indicator');
  const rxIndicator=document.getElementById('ep133-rx-indicator');
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
  const setTitleDevice=state=>{
    if(!title)return;
    const sku=String(state?.device?.sku||'').toUpperCase();
    const model=sku==='TE032AS001'?'-133':sku==='TE032AS005'?'-1320':sku==='TE032AS006'?'-40':'';
    title.textContent=model?'MY EP'+model:'MY EP';
  };
  const setBusy=()=>{};
  const getSoundsParentId=files=>files.find(item=>item.fileName==='/sounds'&&item.fileType==='folder')?.nodeId||0;
  const setSlotStatus=(slot,message)=>{setStatus('SLOT '+String(slot.id).padStart(3,'0')+' · '+message);};
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const formatSize=size=>{if(!size)return '—';if(size<1024)return size+' B';if(size<1024*1024)return(size/1024).toFixed(1)+' KB';return(size/1024/1024).toFixed(2)+' MB';};
  const formatMemory=bytes=>{
    const value=Number(bytes||0);
    if(!Number.isFinite(value)||value<=0)return '0.0KB';
    const kb=value/1e3;
    const mb=kb/1e3;
    return mb>1?mb.toFixed(2)+'MB':Math.max(kb,0).toFixed(1)+'KB';
  };
  const renderDeviceStats=(metadata={},samples=[])=>{
    const maxCapacity=Number(metadata?.max_capacity)||0;
    const freeSpace=Number(metadata?.free_space_in_bytes);
    const usedBytes=maxCapacity>0&&Number.isFinite(freeSpace)?Math.max(0,maxCapacity-freeSpace):0;
    const memoryStats=document.getElementById('ep133-memory-stats');
    const sampleCount=document.getElementById('ep133-sample-count');
    if(memoryStats)memoryStats.textContent=maxCapacity>0&&Number.isFinite(freeSpace)
      ? formatMemory(usedBytes)+' / '+formatMemory(maxCapacity)
      : '—';
    const count=Array.isArray(samples)?samples.length:Number(samples||0);
    if(sampleCount)sampleCount.textContent=String(Math.max(0,count)).padStart(3,'0');
  };
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
  const getDroppedFiles=event=>{
    const resultId=event.dataTransfer?.getData('application/x-speeduppercut-result');
    if(resultId){
      const sourceWindows=[window,window.opener].filter(Boolean);const item=sourceWindows.map(w=>w.__speedUpperCutFiles?.get(resultId)).find(Boolean);
      if(item?.result?.blob)return[new File([item.result.blob],item.outputName||outputFileName(item.file.name),{type:'audio/wav'})];
    }
    return Array.from(event.dataTransfer?.files||[]);
  };
  const getClipboardAudioFiles=event=>Array.from(event.clipboardData?.items||[])
    .filter(item=>String(item.type||'').includes('audio'))
    .map(item=>item.getAsFile?.())
    .filter(Boolean);

  let soundsParentId=0;
  let soundFormats=[];
  let soundsMetadata={};
  let deviceFiles=[];
  let currentPath='/';
  let selectedFile=null;
  const memory=createSampleMemory({
    listEl:list,tabsEl:tabs,searchEl:search,infoEl:info,
    onSelect:slot=>setStatus(slot?'SLOT '+String(slot.id).padStart(3,'0')+' SELECTED':'READY'),
    onPlay:async slot=>{
      try{await startPlayback(slot.nodeId||slot.id,true);setSlotStatus(slot,'PLAYING');}catch(error){showError?.(error?.message||error);}
    },
    onStop:async slot=>{
      try{await stopPlayback(slot.nodeId||slot.id);}catch(error){console.warn('EP sample playback stop failed',error);}
    },
    onDelete:async slot=>{if(!isConnected())throw new Error('Connect EP-133 before deleting a sample.');setSlotStatus(slot,'DELETING...');await deleteFile(slot.nodeId);setSlotStatus(slot,'DELETED');},
    onRename:async(slot,value)=>{
      if(!isConnected()){showError?.('Connect EP-133 before renaming a sample.');return null;}
      if(slot.node?.isWritable!==true){showError?.('This EP sample is not writable.');return null;}
      const name=normalizeFileName(value);
      if(!name)return null;
      try{
        await setFileMetadata(slot.nodeId||slot.id,{name});
        slot.meta={...(slot.meta||{}),name};
        setSlotStatus(slot,'RENAMED · '+name);
        return name;
      }catch(error){
        showError?.(error?.message||error);
        return null;
      }
    },
    onMove:async(source,target)=>{if(!isConnected())throw new Error('Connect EP-133 before moving a sample.');if(!soundsParentId)throw new Error('EP-133 /sounds destination is not available. Refresh the device.');try{setSlotStatus(source,'MOVING TO '+String(target.id).padStart(3,'0')+'...');const moved=await moveFile(source.nodeId,soundsParentId,target.id);if(Number(moved?.oldFileId)!==Number(source.nodeId)||Number(moved?.parentId)!==Number(soundsParentId)||Number(moved?.newFileId)!==Number(target.id))throw new Error('EP-133 returned an unexpected FILE_MOVE response.');const item=await syncMovedFile({oldNodeId:moved.oldFileId,parentId:moved.parentId,nodeId:moved.newFileId});if(!item||Number(item.nodeId)!==Number(target.id))throw new Error('EP-133 acknowledged FILE_MOVE but the destination slot could not be verified.');setStatus('MOVED · '+String(source.id).padStart(3,'0')+' → '+String(target.id).padStart(3,'0'));}catch(error){setSlotStatus(source,'MOVE ERROR');showError?.(error?.message||error);}} ,
    onDownload:async slot=>{
      if(!isConnected())throw new Error('Connect EP-133 before downloading a sample.');
      setSlotStatus(slot,'DOWNLOADING 0%');
      const result=await getFile(slot.nodeId,(done,total)=>setSlotStatus(slot,'DOWNLOADING '+Math.round(done/Math.max(1,total)*100)+'%'));
      const bytes=result?.data instanceof Uint8Array?result.data:new Uint8Array(result?.data||[]);
      const meta=slot.meta||await getFileMetadata(slot.nodeId);
      const wav=await createEp133Wav(bytes,{name:result?.name||slot.file?.name||'sample',metadata:meta});
      const base=String(meta?.name||slot.file?.name||result?.name||'sample').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]/g,'_').trim()||'sample';
      const filename=base+'.wav';
      const url=URL.createObjectURL(wav);const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
      setSlotStatus(slot,'DOWNLOADED');
    },
    onDownloadMany:async selectedSlots=>{
      if(!isConnected())throw new Error('Connect EP-133 before downloading samples.');
      const files=[];
      for(let index=0;index<selectedSlots.length;index++){
        const slot=selectedSlots[index];
        const slotNumber=String(slot.id).padStart(3,'0');
        setStatus('DOWNLOADING '+(index+1)+'/'+selectedSlots.length+' · SLOT '+slotNumber+' · 0%');
        const result=await getFile(slot.nodeId,(done,total)=>setStatus('DOWNLOADING '+(index+1)+'/'+selectedSlots.length+' · SLOT '+slotNumber+' · '+Math.round(done/Math.max(1,total)*100)+'%'));
        const bytes=result?.data instanceof Uint8Array?result.data:new Uint8Array(result?.data||[]);
        const meta=slot.meta||await getFileMetadata(slot.nodeId);
        let wav;
        try{wav=await createEp133Wav(bytes,{name:result?.name||slot.file?.name||'sample',metadata:meta});}
        catch(error){throw new Error('Could not create reference WAV for slot '+slotNumber+': '+(error?.message||error));}
        const base=String(meta?.name||slot.file?.name||result?.name||'sample').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]/g,'_').trim()||'sample';
        files.push({path:slotNumber+' '+base+'.wav',blob:wav});
      }
      const zip=await createZip(files);
      const url=URL.createObjectURL(zip);const anchor=document.createElement('a');anchor.href=url;anchor.download='samples.zip';document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
      setStatus('DOWNLOADED · '+selectedSlots.length+' SAMPLES');
    },
    onDrop:async(slot,event)=>{await uploadFilesToSlot(slot,getDroppedFiles(event));}
  })
  async function uploadFilesToSlot(slot,files){
    if(!isConnected()){showError?.('Connect EP-133 before writing a sample.');return;}
    if(!soundsParentId){showError?.('EP-133 /sounds destination is not available. Refresh the device.');return;}
    if(!slot||!files?.length)return;
    const targets=[];
    let searchFrom=slot.id;
    for(const file of files){
      const destinationId=memory.findNextFree(searchFrom);
      if(destinationId===-1){showError?.('No more free sample slots in the library.');return;}
      const destination=memory.getSlot(destinationId);
      if(!destination){showError?.('Invalid sample destination.');return;}
      targets.push(destination);
      memory.setOperation(destination.id,{status:'pending',label:'PENDING'});
      searchFrom=destinationId+1;
    }
    let completed=0;
    const failures=[];
    for(let index=0;index<files.length;index++){
      const file=files[index],target=targets[index];
      try{
        setSlotStatus(target,'PREPARING...');
        memory.setOperation(target.id,{status:'preparing',label:'PREPARING'});
        const prepared=await prepareEp133Sample(file,{formats:soundFormats,onProgress:(value,info)=>{
          const status=String(info?.status||'preparing').toLowerCase();
          const label=status==='ready'?'READY':status.toUpperCase();
          memory.setOperation(target.id,{status,label,progress:value});
          setSlotStatus(target,label+' '+Math.round(value)+'%');
        }});
        const metadata={channels:prepared.channels,samplerate:prepared.samplerate,format:prepared.format,...(prepared.metadata||{})};
        memory.setOperation(target.id,{status:'uploading',label:'UPLOADING',progress:0});
        const fileId=await uploadSampleToSlot({file,data:prepared.data,filename:file.name,parentId:soundsParentId,destinationId:target.id,metadata,onProgress:(done,total)=>{
          const progress=Math.round(done/Math.max(1,total)*100);
          memory.setOperation(target.id,{status:'uploading',label:'UPLOADING',progress});
          setSlotStatus(target,'UPLOADING '+progress+'%');
        }});
        const normalizedName=normalizeFileName(file.name);
        target.file={name:normalizedName,path:'/sounds/'+normalizedName,size:prepared.data.byteLength};
        target.nodeId=fileId;target.meta={...metadata,name:normalizedName};memory.refresh();
        memory.setOperation(target.id,{status:'complete',label:'WRITTEN',progress:100});
        completed++;
        setTimeout(()=>memory.clearOperation(target.id),1200);
      }catch(error){
        failures.push({file,error});
        memory.setOperation(target.id,{status:'failed',label:'FAIL'});
        setTimeout(()=>memory.clearOperation(target.id),2000);
      }
    }
    if(files.length>1)setStatus('UPLOADED · '+completed+'/'+files.length+' FILES');
    else if(completed===1)setSlotStatus(targets[0],'WRITTEN');
    if(failures.length)showError?.(failures.length===1?(failures[0].error?.message||failures[0].error):failures.length+' files failed to upload.');
  }

;

  const closePanel=()=>{panel.style.display='none';panel.setAttribute('aria-hidden','true');};
  const isMobileDevice=()=>/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'');
  open.onclick=()=>{if(isMobileDevice()){showError?.('My EP works on desktop computers only. Connect your EP-133 to a computer to use this feature.');return;}panel.style.display='flex';panel.setAttribute('aria-hidden','false');};
  open.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;e.preventDefault();open.click();});
  close.onclick=closePanel;
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
      memory.setTabs(DEFAULT_SAMPLE_TABS);
      memory.setSlots(createSampleSlots([]));
      renderDeviceStats({},0);
      const progressiveBatchSize=29;
      const progressiveEntries=[];
      const flushProgressiveEntries=()=>{
        if(!progressiveEntries.length)return;
        memory.setEntries(progressiveEntries.splice(0,progressiveEntries.length));
        renderDeviceStats(soundsMetadata,memory.countOccupied());
      };
      deviceFiles=await listDeviceFiles((item,total)=>{
        setStatus('READING FILES... '+total);
        if(/^\/sounds\/[^/]+$/.test(item?.fileName||'')){
          progressiveEntries.push(item);
          if(progressiveEntries.length>=progressiveBatchSize)flushProgressiveEntries();
        }
      });
      flushProgressiveEntries();
      currentPath='/';selectedFile=null;renderFiles();
      const files=deviceFiles;
      soundsParentId=getSoundsParentId(files);
      soundFormats=[];
      soundsMetadata={};
      if(soundsParentId){try{soundsMetadata=await getFileMetadata(soundsParentId);soundFormats=Array.isArray(soundsMetadata?.formats)?soundsMetadata.formats:[];}catch(e){console.warn('EP /sounds metadata read failed',e);}}
      memory.setTabs(soundsMetadata?.tabs);
      const occupied=createSampleSlots(files).filter(slot=>slot.file);
      renderDeviceStats(soundsMetadata,occupied);let loaded=0;
      for(const slot of occupied){try{const meta=await getFileMetadata(slot.nodeId);memory.setMetadata(slot.id,meta);}catch(e){console.warn('EP sample metadata read failed for slot '+slot.id,e);}loaded+=1;setStatus('READING SAMPLE METADATA... '+loaded+'/'+occupied.length);}
      renderDeviceStats(soundsMetadata,occupied);
      setStatus('READY · '+occupied.length+' SAMPLES · 999 SLOTS');
    }catch(e){setStatus('READ ERROR');showError?.(e?.message||e);}finally{setBusy(false);}
  };

  const renderConnection=state=>{
    setTitleDevice(state);
    if(!state.connected)renderDeviceStats({},[]);
    if(state.connected){
      const meta=state.device?.metadata||{};
      setStatus('CONNECTED · READ/WRITE');
      return;
    }
    const deviceEl=document.getElementById('ep133-device');
    if(deviceEl)deviceEl.textContent='NO DEVICE';
    setStatus('NOT CONNECTED');
    soundsParentId=0;
    soundFormats=[];
    soundsMetadata={};
    deviceFiles=[];selectedFile=null;renderFiles();memory.setSlots([]);
  };
  renderFiles();
  renderFileInfo();
  const activityTimers={tx:null,rx:null};
  onMidiActivity(({direction})=>{
    const element=direction==='tx'?txIndicator:direction==='rx'?rxIndicator:null;
    if(!element)return;
    element.classList.add('active');
    clearTimeout(activityTimers[direction]);
    activityTimers[direction]=setTimeout(()=>element.classList.remove('active'),direction==='rx'?275:250);
  });
  // Match the reference MIDI lifecycle: request MIDI immediately so an
  // already-connected EP-133 is discovered without requiring a statechange.
  const autoConnect=async()=>{
    if(isConnected())return;
    try{
      await connectEp133();
    }catch(error){
      // No device / denied MIDI is intentionally silent here. The reference
      // keeps checking for devices instead of requiring a Connect button.
      console.debug('EP auto-connect:',error?.message||error);
    }
  };
  const fileItemFromInfo=info=>{
    const parent=Number(info?.parentId)===0?null:deviceFiles.find(item=>Number(item.nodeId)===Number(info?.parentId));
    const parentPath=Number(info?.parentId)===0?'':parent?.fileName;
    if(Number(info?.parentId)!==0&&!parentPath)return null;
    const fileName=(parentPath||'')+'/'+String(info?.fileName||'').replace(/^\/+/, '');
    const flags=Number(info?.flags)||0;
    return{
      nodeId:Number(info.nodeId),flags,fileSize:Number(info.fileSize)||0,fileName,
      fileType:(flags&TE_SYSEX_FILE_FILE_TYPE_FILE)?'file':'folder',
      isReadable:!!(flags&TE_SYSEX_FILE_CAPABILITY_READ),
      isWritable:!!(flags&TE_SYSEX_FILE_CAPABILITY_WRITE),
      isDeletable:!!(flags&TE_SYSEX_FILE_CAPABILITY_DELETE),
      isMovable:!!(flags&TE_SYSEX_FILE_CAPABILITY_MOVE),
      isPlayable:!!(flags&TE_SYSEX_FILE_CAPABILITY_PLAYBACK)
    };
  };
  const updateDeviceFile=item=>{
    const index=deviceFiles.findIndex(file=>Number(file.nodeId)===Number(item.nodeId));
    if(index>=0)deviceFiles[index]=item;else deviceFiles.push(item);
    renderFiles();
  };
  const syncMovedFile=async({oldNodeId,parentId,nodeId})=>{
    const oldId=Number(oldNodeId),newId=Number(nodeId),destinationParentId=Number(parentId);
    if(!Number.isInteger(oldId)||!Number.isInteger(newId)||!Number.isInteger(destinationParentId))throw new Error('Invalid EP-series FILE_MOVED identifiers.');
    const oldItem=deviceFiles.find(item=>Number(item.nodeId)===oldId)||null;
    const oldWasSound=!!oldItem&&/^\/sounds\/[^/]+$/.test(oldItem.fileName||'');
    const oldMeta=oldId>=1&&oldId<=999?memory.getSlot(oldId)?.meta||null:null;
    const selectedWasOld=selectedFile&&Number(selectedFile.nodeId)===oldId;
    if(oldId!==newId)deviceFiles=deviceFiles.filter(item=>Number(item.nodeId)!==oldId);
    const info=await getFileInfo(newId);
    const item=fileItemFromInfo(info);
    if(!item)throw new Error('EP-series FILE_MOVED destination node could not be resolved.');
    updateDeviceFile(item);
    if(selectedWasOld){selectedFile=item;renderFiles();}
    if(oldWasSound&&oldId>=1&&oldId<=999&&oldId!==newId)memory.clearSlot(oldId);
    const newIsSound=destinationParentId===Number(soundsParentId)&&/^\/sounds\/[^/]+$/.test(item.fileName||'')&&newId>=1&&newId<=999;
    if(newIsSound){
      memory.setSlot(item);
      try{memory.setMetadata(newId,await getFileMetadata(newId));}
      catch(error){if(oldMeta)memory.setMetadata(newId,oldMeta);else console.warn('EP moved sample metadata read failed',error);}
    }
    if(oldWasSound||newIsSound)renderDeviceStats(soundsMetadata,memory.countOccupied());
    return item;
  };
  const handleFileEvent=async event=>{
    if(!event?.data||!isConnected())return;
    const payload=event.data;
    try{
      if(event.type===TE_SYSEX_FILE_EVENT_METADATA_UPDATED){
        if(Number(payload.nodeId)===Number(soundsParentId)){
          soundsMetadata={...soundsMetadata,...(payload.metadata||{})};
          if(Array.isArray(soundsMetadata?.formats))soundFormats=soundsMetadata.formats;
          renderDeviceStats(soundsMetadata,memory.countOccupied());
        }else if(Number(payload.nodeId)>=1&&Number(payload.nodeId)<=999){
          memory.mergeMetadata(Number(payload.nodeId),payload.metadata||{});
        }
        return;
      }
      if(event.type===TE_SYSEX_FILE_EVENT_FILE_ADDED||event.type===TE_SYSEX_FILE_EVENT_FILE_UPDATED){
        const info=await getFileInfo(Number(payload.nodeId));
        const item=fileItemFromInfo(info);
        if(!item)return;
        updateDeviceFile(item);
        if(/^\/sounds\/[^/]+$/.test(item.fileName)&&item.nodeId>=1&&item.nodeId<=999){
          memory.setSlot(item);
          try{memory.setMetadata(item.nodeId,await getFileMetadata(item.nodeId));}catch(error){console.warn('EP sample event metadata read failed',error);}
          renderDeviceStats(soundsMetadata,memory.countOccupied());
        }
        return;
      }
      if(event.type===TE_SYSEX_FILE_EVENT_FILE_DELETED){
        const nodeId=Number(payload.nodeId);
        const existing=deviceFiles.find(item=>Number(item.nodeId)===nodeId);
        deviceFiles=deviceFiles.filter(item=>Number(item.nodeId)!==nodeId);
        if(selectedFile&&Number(selectedFile.nodeId)===nodeId)selectedFile=null;
        renderFiles();
        if(existing&&/^\/sounds\/[^/]+$/.test(existing.fileName)&&nodeId>=1&&nodeId<=999){
          memory.clearSlot(nodeId);
          renderDeviceStats(soundsMetadata,memory.countOccupied());
        }
        return;
      }
      if(event.type===TE_SYSEX_FILE_EVENT_FILE_MOVED){
        await syncMovedFile(payload);
        return;
      }
    }catch(error){
      console.warn('EP file event update failed',error);
      showError?.(error?.message||error);
    }
  };
  onFileEvent(event=>{void handleFileEvent(event);});

  onConnectionChange(state=>{
    renderConnection(state);
    if(state.connected)readDevice();
  });
  autoConnect();
  // Reference tool also performs periodic discovery while no device is present.
  const autoConnectTimer=setInterval(()=>{if(!isConnected())autoConnect();},4000);
  window.addEventListener('beforeunload',()=>clearInterval(autoConnectTimer),{once:true});
  window.addEventListener('paste',event=>{
    if(panel.style.display==='none')return;
    const files=getClipboardAudioFiles(event);
    const slot=memory.getSelected();
    if(files.length&&slot)void uploadFilesToSlot(slot,files);
  });
  search?.addEventListener('input',()=>memory.refresh());document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.style.display!=='none')closePanel();});
}

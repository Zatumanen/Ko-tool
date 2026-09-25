import{
  connectEp133,isConnected,onConnectionChange,onFileEvent,onMidiActivity,
  listDeviceFiles,getFile,getFileMetadata,getFileInfo,uploadSampleToSlot,
  deleteFile,setFileMetadata,startPlayback,stopPlayback,normalizeFileName,
  prepareSampleTransferMetadata,prepareSampleWritableMetadata,prepareSampleCreateMetadata,createTransferFileName
}from './index.js?v=20260925-1';
import{
  TE_SYSEX_FILE_CAPABILITY_READ,TE_SYSEX_FILE_CAPABILITY_WRITE,
  TE_SYSEX_FILE_CAPABILITY_DELETE,TE_SYSEX_FILE_CAPABILITY_MOVE,
  TE_SYSEX_FILE_CAPABILITY_PLAYBACK,TE_SYSEX_FILE_FILE_TYPE_FILE,
  TE_SYSEX_FILE_EVENT_METADATA_UPDATED,TE_SYSEX_FILE_EVENT_FILE_ADDED,
  TE_SYSEX_FILE_EVENT_FILE_UPDATED,TE_SYSEX_FILE_EVENT_FILE_DELETED,
  TE_SYSEX_FILE_EVENT_FILE_MOVED
}from './constants.js';
import{prepareEp133Sample,createEp133Wav}from './audio.js?v=20260925-1';
import{
  createSampleSlots,createSampleMemory,DEFAULT_SAMPLE_TABS,
  planSampleTransferTargets
}from './sampleMemory.js?v=20260925-1';
import{outputFileName}from '../output-name.js';

const PLAY_MODES=['oneshot','key','legato'];
const TIME_MODES=['off','bpm','bar'];
const BAR_VALUES=[1,2,4,8,16,32,64,128,256];
const PROPERTY_DEBOUNCE_MS=120;

export function initEp133Browser({showError}={}){
  const open=document.getElementById('my-ep-icon');
  const panel=document.getElementById('ep133-browser');
  const close=document.getElementById('ep133-close');
  const title=document.getElementById('ep133-browser-title');
  const list=document.getElementById('ep133-sample-list');
  const tabs=document.getElementById('ep133-sample-tabs');
  const search=document.getElementById('ep133-sample-search');
  const searchClear=document.getElementById('ep133-search-clear');
  const deviceHead=document.getElementById('ep133-device-head');
  const deviceName=document.getElementById('ep133-device');
  const connectionOverlay=document.getElementById('ep133-connection-overlay');
  const txIndicator=document.getElementById('ep133-tx-indicator');
  const rxIndicator=document.getElementById('ep133-rx-indicator');
  const properties=document.getElementById('ep133-properties');
  const propertiesGrid=document.getElementById('ep133-properties-grid');
  const globalProgress=document.getElementById('ep133-global-progress');
  const globalProgressLabel=document.getElementById('ep133-global-progress-label');
  const globalProgressFill=document.getElementById('ep133-global-progress-fill');
  const globalProgressText=document.getElementById('ep133-global-progress-text');
  const confirmDialog=document.getElementById('ep133-confirm-dialog');
  const confirmMessage=document.getElementById('ep133-confirm-message');
  const confirmOk=document.getElementById('ep133-confirm-ok');
  const confirmCancel=document.getElementById('ep133-confirm-cancel');
  if(!open||!panel||!close||!list||!tabs||!search)return;

  const setStatus=text=>{
    const el=document.getElementById('ep133-status');
    if(el)el.textContent=String(text||'');
  };
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
  const humanError=message=>String(message||'OPERATION FAILED.').toUpperCase();
  const logTechnical=(label,error)=>{
    const detail=String(error?.stack||error?.message||error||'unknown error');
    console.error(label,error);
    const log=document.getElementById('log-tab');
    if(log)log.insertAdjacentHTML('beforeend','<div><i class="fas fa-exclamation-triangle"></i> MY EP · '+escapeHtml(label)+' · '+escapeHtml(detail)+'</div>');
  };
  const reportError=(message,error)=>{
    logTechnical(message,error);
    showError?.(humanError(message));
  };

  let soundsParentId=0;
  let soundFormats=[];
  let soundsMetadata={};
  let deviceFiles=[];
  let synchronized=false;
  let mutating=false;
  let deviceUnsafe=false;
  let everConnected=false;
  let lastDeviceInfo={title:'MY EP',name:''};
  let playingSlotId=null;
  let previewTimer=null;
  let currentPropertySlotId=null;
  let confirmResolver=null;
  const propertyStates=new Map();
  const pendingPropertyKeys=new Set();

  const updateMutationAvailability=()=>{
    memory?.setMutationsEnabled?.(!!(isConnected()&&!deviceUnsafe&&synchronized&&!mutating));
  };
  const setMutating=value=>{
    mutating=!!value;
    updateMutationAvailability();
  };

  const modelInfo=state=>{
    const sku=String(state?.device?.sku||'').toUpperCase();
    if(sku==='TE032AS001')return{title:'MY EP-133',name:'K.O. II'};
    if(sku==='TE032AS005')return{title:'MY EP-1320',name:'MEDIEVAL'};
    if(sku==='TE032AS006')return{title:'MY EP-40',name:'RIDDIM'};
    return{title:'MY EP',name:''};
  };
  const setTitleDevice=state=>{
    if(state?.connected)lastDeviceInfo=modelInfo(state);
    const info=state?.connected?lastDeviceInfo:(everConnected?lastDeviceInfo:modelInfo(state));
    if(title)title.textContent=info.title;
    if(deviceName)deviceName.textContent=info.name;
  };
  const setConnectionOverlay=text=>{
    if(!deviceHead||!connectionOverlay)return;
    const disconnected=!!text;
    deviceHead.classList.toggle('disconnected',disconnected);
    connectionOverlay.textContent=text||'';
  };

  const formatMb=value=>{
    const mb=Number(value)/1e6;
    if(!Number.isFinite(mb)||mb<0)return'—';
    const fixed=mb.toFixed(1);
    return fixed.endsWith('.0')?fixed.slice(0,-2):fixed;
  };
  const renderDeviceStats=(metadata={},sampleCount=0)=>{
    const maxCapacity=Number(metadata?.max_capacity)||0;
    const freeSpace=Number(metadata?.free_space_in_bytes);
    const used=maxCapacity>0&&Number.isFinite(freeSpace)?Math.max(0,maxCapacity-freeSpace):NaN;
    const stats=document.getElementById('ep133-memory-stats');
    const meter=document.getElementById('ep133-memory-meter-fill');
    const count=document.getElementById('ep133-sample-count');
    if(stats)stats.textContent=maxCapacity>0&&Number.isFinite(used)
      ?formatMb(used)+' / '+formatMb(maxCapacity)+' MB'
      :'—';
    if(meter){
      const ratio=maxCapacity>0&&Number.isFinite(used)?Math.max(0,Math.min(1,used/maxCapacity)):0;
      meter.style.width=(ratio*100).toFixed(1)+'%';
    }
    if(count)count.textContent=String(Math.max(0,Number(sampleCount)||0));
  };

  const setGlobalProgress=(label,progress)=>{
    if(!globalProgress)return;
    const value=Math.max(0,Math.min(100,Number(progress)||0));
    globalProgress.hidden=false;
    if(globalProgressLabel)globalProgressLabel.textContent=String(label||'WORKING').toUpperCase();
    if(globalProgressFill)globalProgressFill.style.width=value.toFixed(1)+'%';
    if(globalProgressText)globalProgressText.textContent=Math.round(value)+'%';
  };
  const hideGlobalProgress=()=>{
    if(globalProgress)globalProgress.hidden=true;
    if(globalProgressFill)globalProgressFill.style.width='0%';
    if(globalProgressText)globalProgressText.textContent='0%';
  };

  const confirmAction=message=>new Promise(resolve=>{
    if(!confirmDialog||!confirmMessage||!confirmOk||!confirmCancel){
      resolve(window.confirm(message));
      return;
    }
    if(confirmResolver)confirmResolver(false);
    confirmResolver=resolve;
    confirmMessage.textContent=message;
    confirmDialog.hidden=false;
    confirmOk.focus();
  });
  const resolveConfirm=value=>{
    if(!confirmResolver)return;
    const resolve=confirmResolver;
    confirmResolver=null;
    if(confirmDialog)confirmDialog.hidden=true;
    resolve(!!value);
  };
  confirmOk?.addEventListener('click',()=>resolveConfirm(true));
  confirmCancel?.addEventListener('click',()=>resolveConfirm(false));

  const getSoundsParentId=files=>files.find(item=>item.fileName==='/sounds'&&item.fileType==='folder')?.nodeId||0;
  const fileItemFromInfo=info=>{
    const parentId=Number(info?.parentId);
    const parent=parentId===0?null:deviceFiles.find(item=>Number(item.nodeId)===parentId);
    const parentPath=parentId===0?'':parent?.fileName;
    if(parentId!==0&&!parentPath)return null;
    const fileName=(parentPath||'')+'/'+String(info?.fileName||'').replace(/^\/+/,'');
    const flags=Number(info?.flags)||0;
    return{
      nodeId:Number(info?.nodeId),
      flags,
      fileSize:Number(info?.fileSize)||0,
      fileName,
      fileType:(flags&TE_SYSEX_FILE_FILE_TYPE_FILE)?'file':'folder',
      isReadable:!!(flags&TE_SYSEX_FILE_CAPABILITY_READ),
      isWritable:!!(flags&TE_SYSEX_FILE_CAPABILITY_WRITE),
      isDeletable:!!(flags&TE_SYSEX_FILE_CAPABILITY_DELETE),
      isMovable:!!(flags&TE_SYSEX_FILE_CAPABILITY_MOVE),
      isPlayable:!!(flags&TE_SYSEX_FILE_CAPABILITY_PLAYBACK)
    };
  };
  const updateDeviceFile=item=>{
    if(!item)return;
    const index=deviceFiles.findIndex(file=>Number(file.nodeId)===Number(item.nodeId));
    if(index>=0)deviceFiles[index]=item;
    else deviceFiles.push(item);
  };
  const soundSlotIds=files=>new Set(
    (files||[])
      .filter(item=>/^\/sounds\/[^/]+$/.test(item?.fileName||'')&&Number(item?.nodeId)>=1&&Number(item?.nodeId)<=999)
      .map(item=>Number(item.nodeId))
  );
  const readAuthoritativeFiles=async()=>{
    const files=await listDeviceFiles();
    return Array.isArray(files)?files:[];
  };
  const assertSlotsEmpty=async ids=>{
    const requested=[...new Set((ids||[]).map(Number))];
    const files=await readAuthoritativeFiles();
    const occupied=soundSlotIds(files);
    const collisions=requested.filter(id=>occupied.has(id));
    if(collisions.length)throw new Error('Target sample slot changed on the device: '+collisions.map(id=>String(id).padStart(3,'0')).join(', ')+'. Reload before retrying.');
    return files;
  };
  const assertSlotsDeleted=async ids=>{
    const requested=[...new Set((ids||[]).map(Number))];
    const files=await readAuthoritativeFiles();
    const occupied=soundSlotIds(files);
    const remaining=requested.filter(id=>occupied.has(id));
    if(remaining.length)throw new Error('EP-series delete was not confirmed by /sounds LIST for slot(s): '+remaining.map(id=>String(id).padStart(3,'0')).join(', '));
    deviceFiles=files;
    return files;
  };
  const verifyPcmReadback=async(fileId,expected,onProgress)=>{
    const readback=await getFile(fileId,onProgress);
    const actual=readback?.data instanceof Uint8Array?readback.data:new Uint8Array(readback?.data||[]);
    if(actual.byteLength!==expected.byteLength)throw new Error('PCM readback size mismatch for slot '+String(fileId).padStart(3,'0')+'.');
    for(let i=0;i<actual.byteLength;i++){
      if(actual[i]!==expected[i])throw new Error('PCM readback mismatch for slot '+String(fileId).padStart(3,'0')+' at byte '+i+'.');
    }
    return readback;
  };
  const assertMetadataReadback=(slotId,expected,actual)=>{
    const expectedCreate=prepareSampleCreateMetadata(expected);
    const expectedWritable=prepareSampleWritableMetadata(expected);
    const fields={...expectedCreate,...expectedWritable};
    for(const[key,value]of Object.entries(fields)){
      if(key==='crc')continue;
      const got=actual?.[key];
      const numeric=typeof value==='number';
      const matches=numeric?Number(got)===Number(value):String(got)===String(value);
      if(!matches)throw new Error('Metadata readback mismatch for slot '+String(slotId).padStart(3,'0')+' field '+key+'.');
    }
  };

  const getDroppedFiles=event=>{
    const resultId=event.dataTransfer?.getData('application/x-speeduppercut-result');
    if(resultId){
      const sourceWindows=[window,window.opener].filter(Boolean);
      const item=sourceWindows.map(w=>w.__speedUpperCutFiles?.get(resultId)).find(Boolean);
      if(item?.result?.blob){
        return[new File([item.result.blob],item.outputName||outputFileName(item.file.name),{type:'audio/wav'})];
      }
    }
    return Array.from(event.dataTransfer?.files||[]);
  };
  const getClipboardAudioFiles=event=>Array.from(event.clipboardData?.items||[])
    .filter(item=>String(item.type||'').includes('audio'))
    .map(item=>item.getAsFile?.())
    .filter(Boolean);

  const fallbackDownload=(blob,name)=>{
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;
    anchor.download=name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1200);
  };
  const saveBlobAs=async(blob,name)=>{
    if(window.showSaveFilePicker){
      try{
        const handle=await window.showSaveFilePicker({
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
  const downloadName=(slot,result)=>{
    const raw=String(slot?.meta?.name||slot?.file?.name||result?.name||'sample')
      .replace(/\.[^.]+$/,'')
      .replace(/[\\/:*?"<>|]/g,'_')
      .trim()||'sample';
    return raw+'.wav';
  };
  const makeWav=async slot=>{
    const result=await getFile(slot.nodeId||slot.id);
    const bytes=result?.data instanceof Uint8Array?result.data:new Uint8Array(result?.data||[]);
    const meta=slot.meta||await getFileMetadata(slot.nodeId||slot.id);
    const wav=await createEp133Wav(bytes,{name:result?.name||slot.file?.name||'sample',metadata:meta});
    return{wav,result};
  };

  const closeProperties=()=>{
    if(properties)properties.hidden=true;
    currentPropertySlotId=null;
  };
  const normalizePlayMode=value=>{
    if(typeof value==='number'&&PLAY_MODES[value])return PLAY_MODES[value];
    const normalized=String(value||'oneshot').toLowerCase();
    return PLAY_MODES.includes(normalized)?normalized:'oneshot';
  };
  const normalizeTimeMode=value=>{
    if(typeof value==='number'&&TIME_MODES[value])return TIME_MODES[value];
    const normalized=String(value||'off').toLowerCase();
    return TIME_MODES.includes(normalized)?normalized:'off';
  };
  const nearestBar=value=>{
    const numeric=Number(value);
    if(!Number.isFinite(numeric)||numeric<=0)return 1;
    return BAR_VALUES.reduce((best,item)=>Math.abs(item-numeric)<Math.abs(best-numeric)?item:best,BAR_VALUES[0]);
  };
  const propertyStateId=(slotId,key)=>String(slotId)+':'+key;
  const isPropertyPending=(slotId,key)=>pendingPropertyKeys.has(propertyStateId(slotId,key));

  const propertyRow=(slot,key,label,value,drag='')=>{
    const pending=isPropertyPending(slot.id,key)?' pending':'';
    return'<div class="ep133-property-row'+pending+'" data-property-row="'+escapeHtml(key)+'">'+
      '<span class="ep133-property-label">'+escapeHtml(label)+'</span>'+
      '<span class="ep133-property-control">'+
        '<button type="button" data-property="'+escapeHtml(key)+'" data-direction="-1" aria-label="Previous '+escapeHtml(label)+'">◀</button>'+
        '<span class="ep133-prop-value"'+(drag?' data-drag="'+escapeHtml(drag)+'"':'')+'>'+escapeHtml(value)+'</span>'+
        '<button type="button" data-property="'+escapeHtml(key)+'" data-direction="1" aria-label="Next '+escapeHtml(label)+'">▶</button>'+
      '</span>'+
    '</div>';
  };
  const numericPropertyRow=(slot,key,label,value,drag='')=>{
    const pending=isPropertyPending(slot.id,key)?' pending':'';
    return'<div class="ep133-property-row'+pending+'" data-property-row="'+escapeHtml(key)+'">'+
      '<span class="ep133-property-label">'+escapeHtml(label)+'</span>'+
      '<span class="ep133-property-control">'+
        '<button type="button" data-property="'+escapeHtml(key)+'" data-direction="-1" aria-label="Decrease '+escapeHtml(label)+'">−</button>'+
        '<span class="ep133-prop-value"'+(drag?' data-drag="'+escapeHtml(drag)+'"':'')+'>'+escapeHtml(value)+'</span>'+
        '<button type="button" data-property="'+escapeHtml(key)+'" data-direction="1" aria-label="Increase '+escapeHtml(label)+'">+</button>'+
      '</span>'+
    '</div>';
  };
  const renderProperties=slot=>{
    if(!propertiesGrid||!slot?.file)return;
    const meta=slot.meta||{};
    const playMode=normalizePlayMode(meta['sound.playmode']);
    const pitch=Number.isFinite(Number(meta['sound.pitch']))?Number(meta['sound.pitch']):0;
    const timeMode=normalizeTimeMode(meta['time.mode']);
    const bpm=Number.isFinite(Number(meta['sound.bpm']))&&Number(meta['sound.bpm'])>0?Math.round(Number(meta['sound.bpm'])):120;
    const bars=nearestBar(meta['sound.bars']);
    let html=propertyRow(slot,'sound.playmode','PLAY MODE',playMode.toUpperCase());
    html+='<div class="ep133-property-separator"></div>';
    html+=numericPropertyRow(slot,'sound.pitch','PITCH',pitch>0?'+'+pitch:String(pitch));
    html+='<div class="ep133-property-separator"></div>';
    html+=propertyRow(slot,'time.mode','TIME MODE',timeMode.toUpperCase());
    if(timeMode==='bpm')html+=numericPropertyRow(slot,'sound.bpm','BPM',String(bpm),'bpm');
    if(timeMode==='bar')html+=propertyRow(slot,'sound.bars','BARS',bars===1?'1 BAR':bars+' BARS');
    propertiesGrid.innerHTML=html;
  };
  const positionProperties=event=>{
    if(!properties)return;
    properties.hidden=false;
    const gap=8;
    const rect=properties.getBoundingClientRect();
    let left=event.clientX+gap;
    let top=event.clientY+gap;
    if(left+rect.width>window.innerWidth-gap)left=event.clientX-rect.width-gap;
    if(top+rect.height>window.innerHeight-gap)top=window.innerHeight-rect.height-gap;
    properties.style.left=Math.max(gap,left)+'px';
    properties.style.top=Math.max(gap,top)+'px';
  };
  const openProperties=(slot,event)=>{
    if(!slot?.file||!isConnected()||!synchronized||mutating)return;
    currentPropertySlotId=slot.id;
    renderProperties(slot);
    positionProperties(event);
  };

  const schedulePropertyWrite=(slot,key,value,extra={})=>{
    if(!slot?.file||!isConnected()||!synchronized||mutating)return;
    const id=propertyStateId(slot.id,key);
    let state=propertyStates.get(id);
    if(!state){
      state={
        slotId:slot.id,key,
        committed:slot.meta?.[key],
        desired:value,
        extra:{...extra},
        timer:null,
        inFlight:false,
        version:0
      };
      propertyStates.set(id,state);
    }
    state.desired=value;
    state.extra={...extra};
    state.version+=1;
    clearTimeout(state.timer);
    pendingPropertyKeys.add(id);
    memory.mergeMetadata(slot.id,{[key]:value,...extra});
    const updated=memory.getSlot(slot.id);
    if(currentPropertySlotId===slot.id)renderProperties(updated);
    state.timer=setTimeout(()=>{void flushPropertyWrite(id);},PROPERTY_DEBOUNCE_MS);
  };

  const flushPropertyWrite=async id=>{
    const state=propertyStates.get(id);
    if(!state)return;
    if(state.inFlight){
      state.timer=setTimeout(()=>{void flushPropertyWrite(id);},PROPERTY_DEBOUNCE_MS);
      return;
    }
    const slot=memory.getSlot(state.slotId);
    if(!slot?.file||!isConnected()){
      pendingPropertyKeys.delete(id);
      propertyStates.delete(id);
      return;
    }
    state.inFlight=true;
    const version=state.version;
    const sentValue=state.desired;
    const sentExtra={...state.extra};
    try{
      const payload={[state.key]:sentValue,...sentExtra};
      if(state.key==='sound.playmode'){
        const release=Number(slot.meta?.['envelope.release']);
        payload['envelope.release']=Number.isFinite(release)?release:255;
      }
      await setFileMetadata(slot.nodeId||slot.id,payload);
      const readback=await getFileMetadata(slot.nodeId||slot.id);
      memory.setMetadata(slot.id,readback);
      state.committed=readback?.[state.key]??sentValue;
      if(state.version!==version){
        memory.mergeMetadata(slot.id,{[state.key]:state.desired,...state.extra});
        state.inFlight=false;
        clearTimeout(state.timer);
        state.timer=setTimeout(()=>{void flushPropertyWrite(id);},40);
        if(currentPropertySlotId===slot.id)renderProperties(memory.getSlot(slot.id));
        return;
      }
      pendingPropertyKeys.delete(id);
      propertyStates.delete(id);
    }catch(error){
      logTechnical('PROPERTY '+state.key,error);
      let restored=null;
      try{restored=await getFileMetadata(slot.nodeId||slot.id);}
      catch(readbackError){logTechnical('PROPERTY READBACK '+state.key,readbackError);}
      if(restored)memory.setMetadata(slot.id,restored);
      else memory.mergeMetadata(slot.id,{[state.key]:state.committed});
      pendingPropertyKeys.delete(id);
      propertyStates.delete(id);
      showError?.('COULD NOT UPDATE SAMPLE PROPERTY.');
    }finally{
      const latest=propertyStates.get(id);
      if(latest)latest.inFlight=false;
      if(currentPropertySlotId===slot.id)renderProperties(memory.getSlot(slot.id));
    }
  };

  const changeProperty=(slot,key,direction)=>{
    if(!slot?.file||slot.node?.isWritable!==true)return;
    const meta=slot.meta||{};
    if(key==='sound.playmode'){
      const current=normalizePlayMode(meta[key]);
      const index=PLAY_MODES.indexOf(current);
      const next=PLAY_MODES[(index+direction+PLAY_MODES.length)%PLAY_MODES.length];
      schedulePropertyWrite(slot,key,next);
      return;
    }
    if(key==='sound.pitch'){
      const current=Number.isFinite(Number(meta[key]))?Number(meta[key]):0;
      const next=Math.max(-12,Math.min(12,Math.round(current)+direction));
      schedulePropertyWrite(slot,key,next);
      return;
    }
    if(key==='time.mode'){
      const current=normalizeTimeMode(meta[key]);
      const index=TIME_MODES.indexOf(current);
      const next=TIME_MODES[(index+direction+TIME_MODES.length)%TIME_MODES.length];
      const extra={};
      if(next==='bpm'&&!(Number(meta['sound.bpm'])>=1&&Number(meta['sound.bpm'])<=200))extra['sound.bpm']=120;
      if(next==='bar'&&!BAR_VALUES.includes(Number(meta['sound.bars'])))extra['sound.bars']=1;
      schedulePropertyWrite(slot,key,next,extra);
      return;
    }
    if(key==='sound.bpm'){
      const current=Number.isFinite(Number(meta[key]))&&Number(meta[key])>0?Math.round(Number(meta[key])):120;
      schedulePropertyWrite(slot,key,Math.max(1,Math.min(200,current+direction)));
      return;
    }
    if(key==='sound.bars'){
      const current=nearestBar(meta[key]);
      const index=BAR_VALUES.indexOf(current);
      const nextIndex=Math.max(0,Math.min(BAR_VALUES.length-1,index+direction));
      schedulePropertyWrite(slot,key,BAR_VALUES[nextIndex]);
    }
  };

  propertiesGrid?.addEventListener('click',event=>{
    const button=event.target.closest('[data-property]');
    if(!button||!currentPropertySlotId)return;
    const slot=memory.getSlot(currentPropertySlotId);
    changeProperty(slot,button.dataset.property,Number(button.dataset.direction)||0);
  });
  propertiesGrid?.addEventListener('pointerdown',event=>{
    const value=event.target.closest('[data-drag="bpm"]');
    if(!value||!currentPropertySlotId)return;
    event.preventDefault();
    const slotId=currentPropertySlotId;
    const slot=memory.getSlot(slotId);
    const startY=event.clientY;
    const startValue=Number(slot?.meta?.['sound.bpm'])>0?Math.round(Number(slot.meta['sound.bpm'])):120;
    let lastValue=startValue;
    const move=moveEvent=>{
      const delta=Math.round((startY-moveEvent.clientY)/3);
      const next=Math.max(1,Math.min(200,startValue+delta));
      if(next===lastValue)return;
      lastValue=next;
      const current=memory.getSlot(slotId);
      if(current) schedulePropertyWrite(current,'sound.bpm',next);
    };
    const stop=()=>{
      document.removeEventListener('pointermove',move);
      document.removeEventListener('pointerup',stop);
      document.removeEventListener('pointercancel',stop);
    };
    document.addEventListener('pointermove',move);
    document.addEventListener('pointerup',stop,{once:true});
    document.addEventListener('pointercancel',stop,{once:true});
  });

  let memory;
  const stopCurrentPreview=async()=>{
    clearTimeout(previewTimer);
    previewTimer=null;
    const nodeId=playingSlotId;
    playingSlotId=null;
    memory?.setPreviewing?.(null);
    if(nodeId&&isConnected()){
      try{await stopPlayback(nodeId);}
      catch(error){console.warn('EP preview stop failed',error);}
    }
  };
  const auditionSample=async slot=>{
    if(!slot?.file||!isConnected())return;
    const nodeId=slot.nodeId||slot.id;
    try{
      if(playingSlotId)await stopCurrentPreview();
      await startPlayback(nodeId,true);
      playingSlotId=nodeId;
      memory.setPreviewing(slot.id);
      previewTimer=setTimeout(()=>{
        if(playingSlotId===nodeId){
          playingSlotId=null;
          memory.setPreviewing(null);
        }
      },1050);
    }catch(error){
      reportError('COULD NOT PREVIEW SAMPLE.',error);
    }
  };

  const performDownload=async(slot,{saveAs=false,index=0,total=1}={})=>{
    const base=(index/Math.max(1,total))*100;
    setGlobalProgress('DOWNLOAD',base);
    const result=await getFile(slot.nodeId||slot.id,(done,size)=>{
      const local=size?done/size:0;
      setGlobalProgress('DOWNLOAD',((index+local)/Math.max(1,total))*100);
    });
    const bytes=result?.data instanceof Uint8Array?result.data:new Uint8Array(result?.data||[]);
    const meta=slot.meta||await getFileMetadata(slot.nodeId||slot.id);
    const wav=await createEp133Wav(bytes,{name:result?.name||slot.file?.name||'sample',metadata:meta});
    const filename=downloadName(slot,result);
    if(saveAs)await saveBlobAs(wav,filename);
    else fallbackDownload(wav,filename);
    setGlobalProgress('DOWNLOAD',((index+1)/Math.max(1,total))*100);
  };

  const transactionalTransfer=async(sources,dropSlot,{copy=false,draggedId}={})=>{
    if(!isConnected())throw new Error('EP device is disconnected.');
    if(!synchronized||!soundsParentId)throw new Error('Sample library is still synchronizing.');
    if(pendingPropertyKeys.size)throw new Error('Wait for the pending sample property write to finish before moving or copying samples.');
    const sourceIds=sources.map(item=>item.id);
    const plan=planSampleTransferTargets(memory.getSlots(),sourceIds,draggedId,dropSlot.id);
    if(plan.length!==sources.length)throw new Error('No valid free destination slots are available.');
    const sourceById=new Map(sources.map(item=>[item.id,item]));
    if(!copy&&sources.some(item=>item.node?.isDeletable!==true))throw new Error('One or more source samples cannot be deleted safely.');
    if(sources.some(item=>item.node?.isReadable!==true))throw new Error('One or more source samples cannot be read.');
    const created=[];
    let deletePhase=false;
    setMutating(true);
    try{
      await assertSlotsEmpty(plan.map(pair=>pair.targetId));
      for(let index=0;index<plan.length;index++){
        const pair=plan[index];
        const source=sourceById.get(pair.sourceId);
        const target=memory.getSlot(pair.targetId);
        if(!source||!target)throw new Error('Invalid transfer plan.');
        const operationLabel=copy?'COPYING':'MOVING';
        memory.setOperation(target.id,{status:'uploading',label:operationLabel,progress:0});
        const downloaded=await getFile(source.nodeId||source.id,(done,total)=>{
          const local=total?done/total:0;
          setGlobalProgress(copy?'COPY':'MOVE',((index+local*.35)/plan.length)*100);
        });
        const bytes=downloaded?.data instanceof Uint8Array?downloaded.data:new Uint8Array(downloaded?.data||[]);
        if(!bytes.byteLength)throw new Error('The device returned an empty sample.');
        const sourceMetadata=source.meta||await getFileMetadata(source.nodeId||source.id);
        const metadata=prepareSampleTransferMetadata(sourceMetadata);
        const displayName=metadata?.name||downloaded?.name||source.file?.name||'sample';
        const transferName=createTransferFileName(source.id,target.id);
        const expectedMetadata={...metadata,name:displayName};
        const fileId=await uploadSampleToSlot({
          data:bytes,
          filename:transferName,
          parentId:soundsParentId,
          destinationId:target.id,
          metadata:expectedMetadata,
          onCreated:id=>{const createdId=Number(id)||target.id;if(!created.includes(createdId))created.push(createdId);},
          onProgress:(done,total)=>{
            const local=total?done/total:0;
            const rowProgress=Math.round(local*100);
            memory.setOperation(target.id,{status:'uploading',label:operationLabel,progress:rowProgress});
            setGlobalProgress(copy?'COPY':'MOVE',((index+.35+local*.55)/plan.length)*100);
          }
        });
        if(Number(fileId)!==Number(target.id))throw new Error('The device wrote a sample to an unexpected slot.');
        memory.setOperation(target.id,{status:'verifying',label:'VERIFYING',progress:0});
        await verifyPcmReadback(fileId,bytes,(done,total)=>{
          const local=total?done/total:0;
          memory.setOperation(target.id,{status:'verifying',label:'VERIFYING',progress:local*100});
          setGlobalProgress(copy?'COPY':'MOVE',((index+.90+local*.05)/plan.length)*100);
        });
        const info=await getFileInfo(fileId);
        const item=fileItemFromInfo(info);
        if(!item||Number(item.nodeId)!==Number(target.id))throw new Error('The destination slot could not be verified.');
        updateDeviceFile(item);
        memory.setSlot(item);
        const destinationMetadata=await getFileMetadata(target.id);
        assertMetadataReadback(target.id,expectedMetadata,destinationMetadata);
        memory.setMetadata(target.id,destinationMetadata);
        memory.setOperation(target.id,{status:'complete',label:copy?'COPIED':'MOVED',progress:100});
        setGlobalProgress(copy?'COPY':'MOVE',((index+.95)/plan.length)*100);
      }

      if(!copy){
        deletePhase=true;
        const deletedIds=[];
        for(let index=0;index<plan.length;index++){
          const source=sourceById.get(plan[index].sourceId);
          await deleteFile(source.nodeId||source.id);
          deletedIds.push(source.id);
          deviceFiles=deviceFiles.filter(item=>Number(item.nodeId)!==Number(source.nodeId||source.id));
          memory.clearSlot(source.id);
          setGlobalProgress('MOVE',95+(index+1)/plan.length*4);
        }
        await assertSlotsDeleted(deletedIds);
        setGlobalProgress('MOVE',100);
      }
      renderDeviceStats(soundsMetadata,memory.countOccupied());
      for(const id of created)memory.clearOperation(id);
      setGlobalProgress(copy?'COPY':'MOVE',100);
      return{targetIds:plan.map(pair=>pair.targetId)};
    }catch(error){
      if(!deletePhase&&isConnected()){
        for(const id of [...created].reverse()){
          try{await deleteFile(id);}
          catch(rollbackError){logTechnical('TRANSFER ROLLBACK SLOT '+id,rollbackError);}
          memory.clearSlot(id);
          deviceFiles=deviceFiles.filter(item=>Number(item.nodeId)!==Number(id));
        }
      }
      memory.clearOperations();
      if(isConnected()){
        try{await readDevice();}
        catch(syncError){logTechnical('RESYNC AFTER TRANSFER ERROR',syncError);}
      }
      throw error;
    }finally{
      hideGlobalProgress();
      setMutating(false);
    }
  };

  const deleteSamples=async targets=>{
    if(!targets?.length||!isConnected()||!synchronized)return false;
    if(pendingPropertyKeys.size)throw new Error('Wait for the pending sample property write to finish before deleting samples.');
    const message=targets.length>1
      ?'DELETE '+targets.length+' SELECTED SAMPLES?'
      :'DELETE "'+String(targets[0]?.meta?.name||targets[0]?.file?.name||'SAMPLE').toUpperCase()+'"?';
    if(!await confirmAction(message))return false;
    setMutating(true);
    try{
      for(let index=0;index<targets.length;index++){
        const slot=targets[index];
        setGlobalProgress('DELETE',(index/targets.length)*100);
        await deleteFile(slot.nodeId||slot.id);
        deviceFiles=deviceFiles.filter(item=>Number(item.nodeId)!==Number(slot.nodeId||slot.id));
        memory.clearSlot(slot.id);
        setGlobalProgress('DELETE',((index+1)/targets.length)*100);
      }
      await assertSlotsDeleted(targets.map(slot=>slot.id));
      renderDeviceStats(soundsMetadata,memory.countOccupied());
      return true;
    }catch(error){
      if(isConnected()){
        try{await readDevice();}
        catch(syncError){logTechnical('RESYNC AFTER DELETE ERROR',syncError);}
      }
      throw error;
    }finally{
      hideGlobalProgress();
      setMutating(false);
    }
  };

  memory=createSampleMemory({
    listEl:list,
    tabsEl:tabs,
    searchEl:search,
    searchClearEl:searchClear,
    onSelect:slot=>{
      closeProperties();
      setStatus(slot?'SLOT '+String(slot.id).padStart(3,'0')+' SELECTED':'');
    },
    onPlay:auditionSample,
    onDelete:deleteSamples,
    onRename:async(slot,value)=>{
      if(!isConnected()||!synchronized)throw new Error('Sample library is not ready.');
      if(slot.node?.isWritable!==true)throw new Error('This sample is not writable.');
      const name=normalizeFileName(value);
      if(!name)return null;
      await setFileMetadata(slot.nodeId||slot.id,{name});
      const readback=await getFileMetadata(slot.nodeId||slot.id);
      memory.setMetadata(slot.id,readback);
      return String(readback?.name||name);
    },
    onDownload:async slot=>{
      try{await performDownload(slot,{saveAs:true,index:0,total:1});}
      finally{hideGlobalProgress();}
    },
    onDownloadMany:async selectedSlots=>{
      try{
        for(let index=0;index<selectedSlots.length;index++){
          await performDownload(selectedSlots[index],{saveAs:false,index,total:selectedSlots.length});
        }
      }finally{hideGlobalProgress();}
    },
    onTransfer:transactionalTransfer,
    onDrop:async(slot,event)=>uploadFilesToSlot(slot,getDroppedFiles(event)),
    onContext:(slot,event)=>openProperties(slot,event),
    onDragStart:closeProperties,
    onUserError:(message,error)=>reportError(message,error)
  });
  updateMutationAvailability();

  async function uploadFilesToSlot(slot,files){
    if(!isConnected())throw new Error('EP device is disconnected.');
    if(!synchronized||!soundsParentId)throw new Error('Sample library is still synchronizing.');
    if(!slot||!files?.length)return;
    const audioFiles=Array.from(files).filter(file=>file&&(/\.(wav|mp3|aac|ogg|flac|m4a|aif|aiff)$/i.test(file.name)||String(file.type||'').startsWith('audio/')));
    if(!audioFiles.length)throw new Error('No supported audio files were found.');

    const targets=[];
    let searchFrom=slot.id;
    for(const file of audioFiles){
      const destinationId=memory.findNextFree(searchFrom);
      if(destinationId===-1)break;
      targets.push({file,slot:memory.getSlot(destinationId)});
      searchFrom=destinationId+1;
    }
    if(targets.length<audioFiles.length)throw new Error('Not enough free sample slots above the drop position.');

    setMutating(true);
    const successes=[];
    const failures=[];
    try{
      await assertSlotsEmpty(targets.map(item=>item.slot.id));
      for(let index=0;index<targets.length;index++){
        const item=targets[index];
        const target=item.slot;
        try{
          memory.setOperation(target.id,{status:'preparing',label:'PREPARING',progress:0});
          const prepared=await prepareEp133Sample(item.file,{
            formats:soundFormats,
            onProgress:(value,info)=>{
              const progress=Math.max(0,Math.min(100,Number(value)||0));
              const phase=String(info?.status||'preparing').toUpperCase();
              memory.setOperation(target.id,{status:String(info?.status||'preparing'),label:phase,progress});
              setGlobalProgress('UPLOAD',((index+(progress/100)*.35)/targets.length)*100);
            }
          });
          const metadata={
            channels:prepared.channels,
            samplerate:prepared.samplerate,
            format:prepared.format,
            ...(prepared.metadata||{})
          };
          memory.setOperation(target.id,{status:'uploading',label:'UPLOADING',progress:0});
          let createdId=null;
          const fileId=await uploadSampleToSlot({
            file:item.file,
            data:prepared.data,
            filename:item.file.name,
            parentId:soundsParentId,
            destinationId:target.id,
            metadata,
            onCreated:id=>{createdId=Number(id)||target.id;item.createdId=createdId;},
            onProgress:(done,total)=>{
              const local=total?done/total:0;
              memory.setOperation(target.id,{status:'uploading',label:'UPLOADING',progress:local*100});
              setGlobalProgress('UPLOAD',((index+.35+local*.65)/targets.length)*100);
            }
          });
          memory.setOperation(target.id,{status:'verifying',label:'VERIFYING',progress:0});
          await verifyPcmReadback(fileId,prepared.data,(done,total)=>{
            const local=total?done/total:0;
            memory.setOperation(target.id,{status:'verifying',label:'VERIFYING',progress:local*100});
            setGlobalProgress('UPLOAD',((index+.94+local*.06)/targets.length)*100);
          });
          const info=await getFileInfo(fileId);
          const fileItem=fileItemFromInfo(info);
          if(!fileItem)throw new Error('Uploaded sample could not be verified.');
          updateDeviceFile(fileItem);
          memory.setSlot(fileItem);
          try{memory.setMetadata(target.id,await getFileMetadata(target.id));}
          catch(error){
            memory.setMetadata(target.id,{...metadata,name:normalizeFileName(item.file.name)});
            logTechnical('UPLOAD METADATA READBACK SLOT '+target.id,error);
          }
          memory.setOperation(target.id,{status:'complete',label:'WRITTEN',progress:100});
          successes.push(target.id);
          setGlobalProgress('UPLOAD',((index+1)/targets.length)*100);
        }catch(error){
          failures.push({file:item.file,error});
          memory.setOperation(target.id,{status:'failed',label:'FAILED',progress:0});
          logTechnical('UPLOAD '+item.file.name,error);
          const createdId=Number(item.createdId)||0;
          if(createdId&&isConnected()&&!deviceUnsafe){
            try{
              await deleteFile(createdId);
              await assertSlotsDeleted([createdId]);
              memory.clearSlot(createdId);
            }catch(rollbackError){
              logTechnical('UPLOAD ROLLBACK SLOT '+createdId,rollbackError);
            }
          }
          if(deviceUnsafe)break;
        }
      }
      renderDeviceStats(soundsMetadata,memory.countOccupied());
      if(successes.length)memory.selectSlots(successes,{activeId:successes[0],preview:false,navigate:true});
      if(failures.length){
        const names=failures.map(item=>'• '+item.file.name).join('\n');
        showError?.('COULD NOT UPLOAD:\n'+names);
      }
    }finally{
      setTimeout(()=>{for(const item of targets)memory.clearOperation(item.slot.id);},900);
      hideGlobalProgress();
      setMutating(false);
    }
  }

  const readDevice=async()=>{
    synchronized=false;
    updateMutationAvailability();
    closeProperties();
    setGlobalProgress('SYNC',0);
    try{
      memory.setTabs(DEFAULT_SAMPLE_TABS);
      memory.setSlots(createSampleSlots([]));
      renderDeviceStats({},0);
      soundsParentId=0;
      soundFormats=[];
      soundsMetadata={};
      deviceFiles=[];
      const progressiveEntries=[];
      const flushEntries=()=>{
        if(!progressiveEntries.length)return;
        memory.setEntries(progressiveEntries.splice(0,progressiveEntries.length));
        renderDeviceStats(soundsMetadata,memory.countOccupied());
      };
      deviceFiles=await listDeviceFiles((item,total)=>{
        if(/^\/sounds\/[^/]+$/.test(item?.fileName||'')){
          progressiveEntries.push(item);
          if(progressiveEntries.length>=29)flushEntries();
        }
        setGlobalProgress('SYNC',Math.min(8,Math.max(1,(Number(total)||0)/125)));
      });
      flushEntries();
      soundsParentId=getSoundsParentId(deviceFiles);
      if(!soundsParentId)throw new Error('The /sounds library was not found on the device.');
      soundsMetadata=await getFileMetadata(soundsParentId);
      soundFormats=Array.isArray(soundsMetadata?.formats)?soundsMetadata.formats:[];
      memory.setTabs(soundsMetadata?.tabs);
      const occupied=createSampleSlots(deviceFiles).filter(slot=>slot.file);
      renderDeviceStats(soundsMetadata,occupied.length);
      let loaded=0;
      for(const slot of occupied){
        try{memory.setMetadata(slot.id,await getFileMetadata(slot.nodeId));}
        catch(error){logTechnical('METADATA SLOT '+slot.id,error);}
        loaded+=1;
        setGlobalProgress('SYNC',8+(loaded/Math.max(1,occupied.length))*92);
        if(loaded%8===0)await new Promise(resolve=>setTimeout(resolve,0));
      }
      synchronized=true;
      updateMutationAvailability();
      setGlobalProgress('SYNC',100);
      setStatus('SYNCED · '+occupied.length+' SAMPLES');
    }catch(error){
      synchronized=false;
      updateMutationAvailability();
      reportError('COULD NOT READ EP SAMPLE LIBRARY.',error);
    }finally{
      setTimeout(hideGlobalProgress,180);
    }
  };

  const syncMovedFile=async({oldNodeId,parentId,nodeId})=>{
    const oldId=Number(oldNodeId),newId=Number(nodeId),destinationParentId=Number(parentId);
    if(!Number.isInteger(oldId)||!Number.isInteger(newId)||!Number.isInteger(destinationParentId))return;
    const oldItem=deviceFiles.find(item=>Number(item.nodeId)===oldId)||null;
    const oldWasSound=!!oldItem&&/^\/sounds\/[^/]+$/.test(oldItem.fileName||'');
    const oldMeta=oldId>=1&&oldId<=999?memory.getSlot(oldId)?.meta||null:null;
    if(oldId!==newId)deviceFiles=deviceFiles.filter(item=>Number(item.nodeId)!==oldId);
    const info=await getFileInfo(newId);
    const item=fileItemFromInfo(info);
    if(!item)return;
    updateDeviceFile(item);
    if(oldWasSound&&oldId>=1&&oldId<=999&&oldId!==newId)memory.clearSlot(oldId);
    const newIsSound=destinationParentId===Number(soundsParentId)&&/^\/sounds\/[^/]+$/.test(item.fileName||'')&&newId>=1&&newId<=999;
    if(newIsSound){
      memory.setSlot(item);
      try{memory.setMetadata(newId,await getFileMetadata(newId));}
      catch(error){if(oldMeta)memory.setMetadata(newId,oldMeta);else logTechnical('MOVED SAMPLE METADATA '+newId,error);}
    }
    if(oldWasSound||newIsSound)renderDeviceStats(soundsMetadata,memory.countOccupied());
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
          if(currentPropertySlotId===Number(payload.nodeId))renderProperties(memory.getSlot(currentPropertySlotId));
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
          try{memory.setMetadata(item.nodeId,await getFileMetadata(item.nodeId));}
          catch(error){logTechnical('SAMPLE EVENT METADATA '+item.nodeId,error);}
          renderDeviceStats(soundsMetadata,memory.countOccupied());
        }
        return;
      }
      if(event.type===TE_SYSEX_FILE_EVENT_FILE_DELETED){
        const nodeId=Number(payload.nodeId);
        const existing=deviceFiles.find(item=>Number(item.nodeId)===nodeId);
        deviceFiles=deviceFiles.filter(item=>Number(item.nodeId)!==nodeId);
        if(existing&&/^\/sounds\/[^/]+$/.test(existing.fileName)&&nodeId>=1&&nodeId<=999){
          memory.clearSlot(nodeId);
          renderDeviceStats(soundsMetadata,memory.countOccupied());
          if(currentPropertySlotId===nodeId)closeProperties();
        }
        return;
      }
      if(event.type===TE_SYSEX_FILE_EVENT_FILE_MOVED){
        await syncMovedFile(payload);
      }
    }catch(error){
      logTechnical('FILE EVENT',error);
    }
  };
  onFileEvent(event=>{void handleFileEvent(event);});

  const renderConnection=state=>{
    deviceUnsafe=!!state?.unsafe;
    setTitleDevice(state);
    if(deviceUnsafe){
      synchronized=false;
      updateMutationAvailability();
      void stopCurrentPreview();
      closeProperties();
      hideGlobalProgress();
      panel.classList.add('device-disconnected');
      setConnectionOverlay('POWER CYCLE EP · THEN RELOAD');
      setStatus('EP FILE SAFETY LOCK · POWER CYCLE DEVICE AND RELOAD PAGE');
      if(state?.unsafeReason)logTechnical('EP FILE SAFETY LOCK',state.unsafeReason);
      return;
    }
    if(state.connected){
      everConnected=true;
      panel.classList.remove('device-disconnected');
      setConnectionOverlay('');
      setStatus('CONNECTED');
      return;
    }
    synchronized=false;
    updateMutationAvailability();
    void stopCurrentPreview();
    closeProperties();
    hideGlobalProgress();
    panel.classList.add('device-disconnected');
    setConnectionOverlay(everConnected?'DEVICE DISCONNECTED':'CONNECT EP SERIES');
    if(!everConnected){
      renderDeviceStats({},0);
      memory.setSlots(createSampleSlots([]));
    }
    soundsParentId=0;
    soundFormats=[];
    soundsMetadata={};
    deviceFiles=[];
    setStatus(everConnected?'DEVICE DISCONNECTED':'CONNECT EP SERIES');
  };

  const activityTimers={tx:null,rx:null};
  onMidiActivity(({direction})=>{
    const element=direction==='tx'?txIndicator:direction==='rx'?rxIndicator:null;
    if(!element)return;
    element.classList.add('active');
    clearTimeout(activityTimers[direction]);
    activityTimers[direction]=setTimeout(()=>element.classList.remove('active'),direction==='rx'?275:250);
  });

  const isMobileDevice=()=>/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'');
  const closePanel=()=>{
    closeProperties();
    void stopCurrentPreview();
    panel.style.display='none';
    panel.setAttribute('aria-hidden','true');
  };
  open.addEventListener('click',()=>{
    if(isMobileDevice()){
      showError?.('MY EP WORKS ON DESKTOP COMPUTERS ONLY.');
      return;
    }
    panel.style.display='flex';
    panel.setAttribute('aria-hidden','false');
    if(!isConnected())void autoConnect();
  });
  open.addEventListener('keydown',event=>{
    if(event.key!=='Enter'&&event.key!==' ')return;
    event.preventDefault();
    open.click();
  });
  close.addEventListener('click',closePanel);

  const makeDraggable=windowEl=>{
    const bar=windowEl?.querySelector('.title-bar');
    if(!windowEl||!bar||bar.dataset.dragReady)return;
    bar.dataset.dragReady='1';
    let dragging=false,dx=0,dy=0;
    bar.addEventListener('pointerdown',event=>{
      if(event.button!==0||event.target.closest('button'))return;
      const rect=windowEl.getBoundingClientRect();
      windowEl.style.position='fixed';
      windowEl.style.transform='none';
      windowEl.style.left=rect.left+'px';
      windowEl.style.top=rect.top+'px';
      dx=event.clientX-rect.left;
      dy=event.clientY-rect.top;
      dragging=true;
      closeProperties();
      bar.setPointerCapture?.(event.pointerId);
    });
    bar.addEventListener('pointermove',event=>{
      if(!dragging)return;
      const maxX=Math.max(0,window.innerWidth-windowEl.offsetWidth);
      const maxY=Math.max(0,window.innerHeight-windowEl.offsetHeight);
      windowEl.style.left=Math.min(maxX,Math.max(0,event.clientX-dx))+'px';
      windowEl.style.top=Math.min(maxY,Math.max(0,event.clientY-dy))+'px';
    });
    const stop=event=>{
      if(!dragging)return;
      dragging=false;
      if(bar.hasPointerCapture?.(event.pointerId))bar.releasePointerCapture(event.pointerId);
    };
    bar.addEventListener('pointerup',stop);
    bar.addEventListener('pointercancel',stop);
  };
  makeDraggable(panel.querySelector('.ep133-browser-window'));

  let midiPermissionBlocked=false;
  const autoConnect=async()=>{
    if(deviceUnsafe||isConnected()||midiPermissionBlocked)return;
    try{
      await connectEp133();
    }catch(error){
      const message=String(error?.message||error);
      if(error?.name==='NotAllowedError'||/permission|denied/i.test(message)){
        midiPermissionBlocked=true;
        showError?.('MIDI ACCESS DENIED. ALLOW SYSEX AND RELOAD.');
        return;
      }
      if(/not supported/i.test(message)){
        midiPermissionBlocked=true;
        showError?.('WEB MIDI IS NOT SUPPORTED IN THIS BROWSER.');
        return;
      }
      if(!/No MIDI ports|was not found/i.test(message))logTechnical('AUTO CONNECT',error);
    }
  };

  onConnectionChange(state=>{
    renderConnection(state);
    if(state.connected&&!state.unsafe)void readDevice();
  });
  void autoConnect();
  const autoConnectTimer=setInterval(()=>{if(!deviceUnsafe&&!isConnected())void autoConnect();},4000);
  window.addEventListener('beforeunload',()=>clearInterval(autoConnectTimer),{once:true});

  window.addEventListener('paste',event=>{
    if(panel.style.display==='none'||!synchronized||mutating)return;
    const files=getClipboardAudioFiles(event);
    const slot=memory.getSelected();
    if(files.length&&slot)void uploadFilesToSlot(slot,files).catch(error=>reportError('COULD NOT UPLOAD SAMPLE.',error));
  });

  document.addEventListener('pointerdown',event=>{
    if(properties&&!properties.hidden&&!properties.contains(event.target)&&!event.target.closest?.('.ep133-sample-row'))closeProperties();
  });
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||event.defaultPrevented)return;
    if(confirmDialog&&!confirmDialog.hidden){event.preventDefault();resolveConfirm(false);return;}
    if(properties&&!properties.hidden){event.preventDefault();closeProperties();return;}
    if(panel.style.display!=='none'){event.preventDefault();closePanel();}
  });

  renderConnection({connected:false});
}

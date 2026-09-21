import{connectEp133,disconnectEp133,isConnected}from './index.js';
import{listDeviceFiles,getFileMetadata}from './filesystem.js';
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

  const memory=createSampleMemory({
    listEl:list,
    tabsEl:tabs,
    searchEl:search,
    infoEl:info,
    onSelect:slot=>{
      setStatus(slot?'SLOT '+String(slot.id).padStart(3,'0')+' SELECTED':'READY · READ ONLY');
    }
  });

  const closePanel=()=>{
    panel.style.display='none';
    panel.setAttribute('aria-hidden','true');
    if(isConnected())disconnectEp133();
  };

  const isMobileDevice=()=>/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'');
  open.onclick=()=>{
    if(isMobileDevice()){
      showError?.('My EP works on desktop computers only. Connect your EP-133 to a computer to use this feature.');
      return;
    }
    panel.style.display='flex';
    panel.setAttribute('aria-hidden','false');
  };
  open.addEventListener('keydown',e=>{
    if(e.key!=='Enter'&&e.key!==' ')return;
    e.preventDefault();open.click();
  });
  close.onclick=closePanel;

  const readDevice=async()=>{
    setBusy(true);setStatus('READING FILES...');
    try{
      const files=await listDeviceFiles((item,total)=>setStatus('READING FILES... '+total));
      const slots=createSampleSlots(files);
      memory.setSlots(slots);

      const occupied=slots.filter(slot=>slot.file);
      let loaded=0;
      for(const slot of occupied){
        try{
          const meta=await getFileMetadata(slot.nodeId);
          memory.setMetadata(slot.id,meta);
        }catch(e){
          console.warn('EP sample metadata read failed for slot '+slot.id,e);
        }
        loaded+=1;
        setStatus('READING SAMPLE METADATA... '+loaded+'/'+occupied.length);
      }

      setStatus('READY · '+occupied.length+' SAMPLES · 999 SLOTS');
      refresh.disabled=false;
    }catch(e){
      setStatus('READ ERROR');
      showError?.(e?.message||e);
    }finally{
      setBusy(false);
      refresh.disabled=!isConnected();
    }
  };

  connect.onclick=async()=>{
    setBusy(true);setStatus('CONNECTING...');setDevice('NO DEVICE');
    try{
      const device=await connectEp133();
      const meta=device.metadata||{};
      setDevice(meta.product||device.sku||'EP SERIES');
      setStatus('CONNECTED · READ ONLY');
      await readDevice();
    }catch(e){
      setStatus('NOT CONNECTED');
      showError?.(e?.message||e);
      setBusy(false);
      refresh.disabled=true;
    }
  };

  refresh.onclick=readDevice;
  search?.addEventListener('input',()=>memory.refresh());
  panel.addEventListener('click',e=>{if(e.target===panel)closePanel();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.style.display!=='none')closePanel();});
}

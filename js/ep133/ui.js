import{connectEp133,disconnectEp133,isConnected}from './index.js';
import{listDeviceFiles}from './filesystem.js';
import{createEp133Browser}from './browser.js';

export function initEp133Browser({showError}={}){
  const open=document.getElementById('my-ep-icon');
  const panel=document.getElementById('ep133-browser');
  const close=document.getElementById('ep133-close');
  const connect=document.getElementById('ep133-connect');
  const refresh=document.getElementById('ep133-refresh');
  const list=document.getElementById('ep133-file-list');
  const breadcrumbs=document.getElementById('ep133-breadcrumbs');
  const search=document.getElementById('ep133-search');
  const sort=document.getElementById('ep133-sort');
  const info=document.getElementById('ep133-info');
  if(!open||!panel||!connect||!list)return;

  const setStatus=t=>{const el=document.getElementById('ep133-status');if(el)el.textContent=t;};
  const setDevice=t=>{const el=document.getElementById('ep133-device');if(el)el.textContent=t;};
  const setBusy=b=>{connect.disabled=b;refresh.disabled=b;};

  const browser=createEp133Browser({
    listEl:list,breadcrumbEl:breadcrumbs,searchEl:search,sortEl:sort,infoEl:info,
    onFolderChange:path=>{const el=document.getElementById('ep133-path');if(el)el.textContent=path;}
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
    setBusy(true);setStatus('READING...');
    try{
      const files=await listDeviceFiles((item,total)=>setStatus('READING... '+total));
      browser.setEntries(files);
      setStatus('READY · '+files.length+' ENTRIES');
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
  search?.addEventListener('input',()=>browser.refresh());
  sort?.addEventListener('change',()=>browser.refresh());

  panel.addEventListener('click',e=>{if(e.target===panel)closePanel();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.style.display!=='none')closePanel();});
}

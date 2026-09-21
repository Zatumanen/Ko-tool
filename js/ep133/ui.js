import{connectEp133,disconnectEp133,isConnected}from './index.js';
import{listDeviceFiles}from './filesystem.js';

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const $=id=>document.getElementById(id);

function renderFiles(files){
  const list=$('ep133-file-list');if(!list)return;
  list.innerHTML='';
  if(!files.length){list.innerHTML='<div class="ep133-empty">No files reported by the device.</div>';return;}
  for(const f of files){
    const depth=Math.max(0,(f.fileName.match(/\//g)||[]).length-1);
    const row=document.createElement('div');
    row.className='ep133-file-row';
    row.style.paddingLeft=(6+depth*18)+'px';
    row.innerHTML=`<span class="ep133-file-type">${f.fileType==='folder'?'DIR':'FILE'}</span><span class="ep133-file-name" title="${esc(f.fileName)}">${esc(f.fileName)}</span><span class="ep133-file-size">${f.fileType==='file'?f.fileSize.toLocaleString():'-'}</span>`;
    list.appendChild(row);
  }
}

export function initEp133Browser({showError}={}){
  const open=$('my-ep-icon'),panel=$('ep133-browser'),close=$('ep133-close'),connect=$('ep133-connect'),refresh=$('ep133-refresh');
  if(!open||!panel||!connect)return;
  const setStatus=t=>{$('ep133-status').textContent=t};
  const setDevice=t=>{$('ep133-device').textContent=t};
  const setBusy=b=>{connect.disabled=b;refresh.disabled=b};
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
    panel.style.display='flex';panel.setAttribute('aria-hidden','false');
  };
  open.addEventListener('keydown',e=>{
    if(e.key!=='Enter'&&e.key!==' ')return;
    e.preventDefault();open.click();
  });
  close.onclick=closePanel;
  connect.onclick=async()=>{
    setBusy(true);setStatus('CONNECTING...');setDevice('NO DEVICE');
    try{
      const info=await connectEp133();
      const meta=info.metadata||{};
      setDevice(meta.product||info.sku||'EP SERIES');
      setStatus('CONNECTED · READ ONLY');
      refresh.disabled=false;
      const files=await listDeviceFiles((item,total)=>setStatus(`READING... ${total}`));
      renderFiles(files);
      setStatus(`READY · ${files.length} ENTRIES`);
    }catch(e){
      setStatus('NOT CONNECTED');
      showError?.(e?.message||e);
    }finally{setBusy(false);}
  };
  refresh.onclick=async()=>{
    if(!isConnected())return;
    setBusy(true);setStatus('READING...');
    try{
      const files=await listDeviceFiles((item,total)=>setStatus(`READING... ${total}`));
      renderFiles(files);
      setStatus(`READY · ${files.length} ENTRIES`);
    }catch(e){
      setStatus('READ ERROR');
      showError?.(e?.message||e);
    }finally{setBusy(false);}
  };
  panel.addEventListener('click',e=>{if(e.target===panel)closePanel();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.style.display!=='none')closePanel();});
}

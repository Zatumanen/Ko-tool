import{createAudioContext,processAudio,getPreset}from './audio/processor.js?v=20260921-15';
import{createZip}from './zip.js?v=20260921-7';
import{outputFileName}from './output-name.js';
import{initEp133Browser}from './ep133/ui.js?v=20260926-2';
const state={ctx:null,fileResults:[],folderResults:[],folderName:'',cancelled:false,urls:new Set(),startedAt:0,folderZipUrl:null};
window.__speedUpperCutFiles=window.__speedUpperCutFiles||new Map();let openPreviewPromise=null;const loadPreview=()=>openPreviewPromise||(openPreviewPromise=import('./player.js?v=20260921-8').then(m=>m.openPreview));
const $=id=>document.getElementById(id);const selected=g=>document.querySelector(`.win95-list[data-group="${g}"] .list-item.selected`)?.dataset.value||(g==='fidelity'?'cd':'stereo');const selectedPlaymode=()=>document.querySelector('.playmode-control .list-item.selected')?.dataset.value||'oneshot';const status=t=>$('status-bar').textContent=t;const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));const bytes=n=>n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(1)} MB`;
function showError(message){const box=$('error-dialog');if(!box)return;$('error-message').textContent=String(message||'Unknown error');box.style.display='flex';$('error-ok').focus();}function hideError(){$('error-dialog').style.display='none';}async function saveBlob(blob,name){if(window.showSaveFilePicker){try{const h=await window.showSaveFilePicker({suggestedName:name,types:[{description:'WAV audio',accept:{'audio/wav':['.wav']}}]});const w=await h.createWritable();await w.write(blob);await w.close();return true;}catch(e){if(e?.name==='AbortError')return false;throw e;}}const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);return true;}
function progress(v,text,i,total){$('progress-fill').style.width=`${v*100}%`;$('progress-text').textContent=`${Math.round(v*100)}%`;$('current-file').textContent=text;$('file-count').textContent=`File: ${i}/${total}`;$('progress-time').textContent=`Time: ${Math.max(0,Math.round((performance.now()-state.startedAt)/1000))}s`;}
function updateStats(){const all=[...state.fileResults,...state.folderResults];const input=all.reduce((x,r)=>x+r.file.size,0);const output=all.reduce((x,r)=>x+r.result.blob.size,0);const saved=input>0?((1-output/input)*100):0;$('stats-tab').innerHTML=all.length?`<div><i class="fas fa-chart-pie"></i> Processed ${all.length} file(s)</div><div>Before: ${bytes(input)}</div><div>After: ${bytes(output)}</div><div>Space saved: ${saved.toFixed(1)}%</div>`:'<div><i class="fas fa-chart-pie"></i> No statistics yet.</div>';}
function renderFileResult(item){const list=$('results-list');if(list.querySelector('.empty-results'))list.innerHTML='';const row=document.createElement('div');row.className='result-item';row.draggable=true;const dragId=(crypto?.randomUUID?.()||String(Date.now())+Math.random());const outputName=outputFileName(item.file.name);window.__speedUpperCutFiles.set(dragId,{...item,outputName});row.dataset.dragId=dragId;row.addEventListener('dragstart',event=>{event.dataTransfer.setData('application/x-speeduppercut-result',dragId);event.dataTransfer.effectAllowed='copy';row.classList.add('dragging');});row.addEventListener('dragend',()=>row.classList.remove('dragging'));const name=document.createElement('span');name.className='result-name';const ext='.wav';name.textContent=outputFileName(item.file.name);const preview=document.createElement('button');preview.type='button';preview.className='download';preview.textContent='Preview';preview.onclick=async()=>{try{const openPreview=await loadPreview();openPreview(item,{state,saveBlob,esc,createAudioContext});}catch(e){showError(e?.message||e);}};const dl=document.createElement('button');dl.className='download';dl.type='button';dl.textContent='Download';dl.onclick=()=>saveBlob(item.result.blob,name.textContent);row.append(name,preview,dl);list.appendChild(row);}
function resetFolderZip(){if(state.folderZipUrl){URL.revokeObjectURL(state.folderZipUrl);state.folderZipUrl=null;}$('folder-download-area').innerHTML='';}
async function createFolderZip(){if(!state.folderResults.length)return;const files=state.folderResults.map(item=>{const original=item.file.webkitRelativePath||item.file.name;const parts=original.split('/');const ext=/\.mp3$/i.test(item.file.name)?'.mp3':'.wav';parts[parts.length-1]=item.file.name.replace(/\.[^.]+$/,'')+'_x2'+ext;return{path:parts.length>1?parts.slice(1).join('/'):parts[0],blob:item.result.blob};});status('Creating processed folder ZIP...');const blob=await createZip(files);resetFolderZip();state.folderZipUrl=URL.createObjectURL(blob);const a=document.createElement('button');a.className='folder-download';a.type='button';a.textContent=`Download ${state.folderName} (${state.folderResults.length} files)`;a.onclick=()=>saveBlob(blob,`${state.folderName}_x2.zip`);$('folder-download-area').appendChild(a);}
function getFolderName(files){const path=files.find(f=>f.webkitRelativePath)?.webkitRelativePath||'';return path.split('/')[0]||'Processed Folder';}
async function filesFromDropItems(items){
  const out=[];
  const walk=(entry,relative='')=>new Promise((resolve,reject)=>{
    if(!entry)return resolve();
    if(entry.isFile){
      entry.file(f=>{
        const path=relative+f.name;
        try{Object.defineProperty(f,'webkitRelativePath',{value:path,configurable:true});}catch(e){}
        out.push(f);resolve();
      },reject);
      return;
    }
    if(entry.isDirectory){
      const reader=entry.createReader(),nextRelative=relative+entry.name+'/';
      const read=()=>reader.readEntries(async entries=>{
        if(!entries.length){resolve();return;}
        try{for(const child of entries)await walk(child,nextRelative);read();}catch(e){reject(e);}
      },reject);
      read();
      return;
    }
    resolve();
  });
  const entries=[...items].map(item=>item.webkitGetAsEntry?.()).filter(Boolean);
  for(const entry of entries)await walk(entry);
  return out;
}
function addFiles(list,fromFolder=false){const files=[...list].filter(f=>/\.(wav|mp3|aac|ogg|flac|m4a)$/i.test(f.name));if(!files.length){showError('No supported audio files were found.');return;}if($('overlay').style.display==='flex'){showError('Finish or cancel the current processing batch before adding more files.');return;}if(fromFolder){state.folderResults=[];state.folderName=getFolderName(files);resetFolderZip();}state.cancelled=false;$('memory-warning').style.display=files.reduce((n,f)=>n+f.size,0)>150*1024*1024?'block':'none';status(`Files selected: ${files.length}`);$('log-tab').insertAdjacentHTML('beforeend',`<div><i class="fas fa-file-import"></i> Added ${files.length} file(s)${fromFolder?' from folder':''}</div>`);process(files,fromFolder);}
async function process(files,isFolder){if(!files.length||$('overlay').style.display==='flex')return;state.cancelled=false;state.startedAt=performance.now();$('overlay').style.display='flex';try{state.ctx=state.ctx||createAudioContext();const fidelity=selected('fidelity'),channels=selected('channels'),playmode=selectedPlaymode(),p=getPreset(fidelity);const batch=[];for(let i=0;i<files.length;i++){if(state.cancelled)break;const f=files[i];progress(0,f.name,i+1,files.length);const r=await processAudio(await f.arrayBuffer(),{speed:2,fidelity,channels,playmode,autoTrim:$('auto-trim').checked,context:state.ctx},{progress:(v,phase)=>progress(v,`${f.name} · ${phase}`,i+1,files.length),shouldCancel:()=>state.cancelled});const url=URL.createObjectURL(r.blob);state.urls.add(url);const item={file:f,result:r,url,fidelity,channels,playmode};batch.push(item);if(isFolder)state.folderResults.push(item);else{state.fileResults.push(item);renderFileResult(item);}$('log-tab').insertAdjacentHTML('beforeend',`<div><i class="fas fa-check-circle"></i> ${esc(f.name)} → x2 · ${p.sampleRate} Hz · ${p.bitDepth}-bit source · WAV · ${channels} · ${playmode}</div>`);}updateStats();if(isFolder&&batch.length&&!state.cancelled)await createFolderZip();if(!isFolder&&batch.length===1&&!state.cancelled){const openPreview=await loadPreview();openPreview(batch[0],{state,saveBlob,esc,createAudioContext});}status(state.cancelled?'Processing cancelled':`Done: ${batch.length} file(s)`);}catch(e){if(e?.name==='AbortError'){status('Processing cancelled');}else{const message=e?.message||e;$('errors-tab').innerHTML+=`<div><i class="fas fa-times-circle"></i> ${esc(message)}</div>`;showError(message);status(`Error: ${message}`);}}finally{$('overlay').style.display='none';}}
function clearAll(){const p=document.getElementById('preview-window');if(p)p.remove();if(state.ctx){try{state.ctx.close?.()}catch(e){}state.ctx=null}state.fileResults=[];state.folderResults=[];state.folderName='';for(const u of state.urls)URL.revokeObjectURL(u);state.urls.clear();window.__speedUpperCutFiles?.clear();resetFolderZip();$('log-tab').innerHTML='<div><i class="fas fa-info-circle"></i> Drop or select audio files to begin.</div><div><i class="fas fa-tachometer-alt"></i> Files are processed at x2 speed.</div>';$('errors-tab').innerHTML='<div><i class="fas fa-check-circle"></i> No errors yet.</div>';$('stats-tab').innerHTML='<div><i class="fas fa-chart-pie"></i> No statistics yet.</div>';$('results-list').innerHTML='<div class="empty-results">Processed files will appear here with download buttons.</div>';$('memory-warning').style.display='none';status('File list cleared');}
function closeMain(){$('main-window').style.display='none';}function openMain(){$('main-window').style.display='block';}
function makeMainWindowDraggable(){
  const win=$('main-window'),bar=win?.querySelector('.title-bar');
  if(!win||!bar||bar.dataset.dragReady)return;
  bar.dataset.dragReady='1';
  let dragging=false,dx=0,dy=0;
  bar.style.cursor='move';
  bar.style.touchAction='none';
  bar.addEventListener('pointerdown',e=>{
    if(e.button!==0||e.target.closest('button'))return;
    const r=win.getBoundingClientRect();
    win.style.position='fixed';
    win.style.transform='none';
    win.style.left=r.left+'px';
    win.style.top=r.top+'px';
    dx=e.clientX-r.left;
    dy=e.clientY-r.top;
    dragging=true;
    bar.setPointerCapture?.(e.pointerId);
  });
  bar.addEventListener('pointermove',e=>{
    if(!dragging)return;
    const maxX=Math.max(0,window.innerWidth-win.offsetWidth);
    const maxY=Math.max(0,window.innerHeight-win.offsetHeight);
    win.style.left=Math.min(maxX,Math.max(0,e.clientX-dx))+'px';
    win.style.top=Math.min(maxY,Math.max(0,e.clientY-dy))+'px';
  });
  const stop=e=>{
    if(!dragging)return;
    dragging=false;
    if(bar.hasPointerCapture?.(e.pointerId))bar.releasePointerCapture(e.pointerId);
  };
  bar.addEventListener('pointerup',stop);
  bar.addEventListener('pointercancel',stop);
  window.addEventListener('resize',()=>{
    const maxX=Math.max(0,window.innerWidth-win.offsetWidth);
    const maxY=Math.max(0,window.innerHeight-win.offsetHeight);
    win.style.left=Math.min(maxX,Math.max(0,parseFloat(win.style.left)||0))+'px';
    win.style.top=Math.min(maxY,Math.max(0,parseFloat(win.style.top)||0))+'px';
  });
}
window.addEventListener('DOMContentLoaded',()=>{openMain();makeMainWindowDraggable();const drop=$('drop-zone'),fi=$('audio-upload'),folder=$('folder-upload');drop.setAttribute('role','button');drop.setAttribute('tabindex','0');drop.setAttribute('aria-label','Select or drop audio files and folders');drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fi.click();}});drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('dragover')});drop.addEventListener('dragleave',()=>drop.classList.remove('dragover'));drop.addEventListener('drop',async e=>{e.preventDefault();drop.classList.remove('dragover');try{const files=e.dataTransfer.items?.length?await filesFromDropItems(e.dataTransfer.items):[...e.dataTransfer.files];const fromFolder=files.some(f=>f.webkitRelativePath)||[...e.dataTransfer.items||[]].some(i=>i.webkitGetAsEntry?.()?.isDirectory);addFiles(files,fromFolder);}catch(err){showError(err?.message||err);}});drop.addEventListener('click',e=>{if(e.target!==fi)fi.click()});fi.addEventListener('change',e=>{addFiles(e.target.files,false);e.target.value=''});folder.addEventListener('change',e=>{addFiles(e.target.files,true);e.target.value=''});$('select-file-button').onclick=()=>fi.click();$('select-folder-button').onclick=()=>folder.click();$('clear-button').onclick=clearAll;$('cancel-button').onclick=()=>{state.cancelled=true;status('Cancelling…')};$('error-ok').onclick=hideError;$('error-close').onclick=hideError;$('app-icon').onclick=openMain;$('app-icon').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openMain();}});$('main-window').querySelector('.close').onclick=closeMain;$('main-window').querySelector('.minimize').onclick=closeMain;document.querySelectorAll('.win95-list').forEach(g=>{
  const items=[...g.querySelectorAll('.list-item')];
  g.setAttribute('role','listbox');
  items.forEach((item,i)=>{
    item.setAttribute('role','option');
    item.setAttribute('tabindex',item.classList.contains('selected')?'0':'-1');
    item.setAttribute('aria-selected',item.classList.contains('selected')?'true':'false');
    item.addEventListener('keydown',e=>{
      if(!['ArrowDown','ArrowRight','ArrowUp','ArrowLeft','Home','End','Enter',' '].includes(e.key))return;
      e.preventDefault();
      let next=item;
      if(e.key==='Home')next=items[0];
      else if(e.key==='End')next=items[items.length-1];
      else if(e.key==='ArrowDown'||e.key==='ArrowRight')next=items[(items.indexOf(item)+1)%items.length];
      else if(e.key==='ArrowUp'||e.key==='ArrowLeft')next=items[(items.indexOf(item)-1+items.length)%items.length];
      if(next!==item){items.forEach(x=>{x.classList.remove('selected');x.setAttribute('tabindex','-1');x.setAttribute('aria-selected','false')});next.classList.add('selected');next.setAttribute('tabindex','0');next.setAttribute('aria-selected','true');next.focus();}
    });
  });
  g.addEventListener('click',e=>{
    if(!e.target.classList.contains('list-item'))return;
    items.forEach(x=>{x.classList.remove('selected');x.setAttribute('tabindex','-1');x.setAttribute('aria-selected','false')});
    e.target.classList.add('selected');e.target.setAttribute('tabindex','0');e.target.setAttribute('aria-selected','true');e.target.focus();
  });
});document.querySelector('.playmode-control')?.addEventListener('click',e=>{if(!e.target.classList.contains('list-item'))return;const g=e.currentTarget;g.querySelectorAll('.list-item').forEach(x=>x.classList.remove('selected'));e.target.classList.add('selected')});const startButton=document.querySelector('.start-button'),startMenu=$('start-menu');
function closeStartMenu(){startMenu?.classList.remove('open');}
startButton?.addEventListener('click',e=>{e.stopPropagation();startMenu?.classList.toggle('open');});
document.querySelectorAll('.start-menu-item').forEach(item=>{
  item.setAttribute('role','menuitem');item.setAttribute('tabindex','0');
  const activate=()=>{document.querySelectorAll('.start-menu-item').forEach(x=>x.classList.remove('active'));item.classList.add('active');};
  item.addEventListener('click',e=>{e.stopPropagation();activate()});
  item.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();activate();}});
});
document.addEventListener('click',e=>{if(startMenu?.classList.contains('open')&&!startMenu.contains(e.target)&&e.target!==startButton)closeStartMenu();});
window.addEventListener('beforeunload',()=>{try{state.ctx?.close?.()}catch(e){}});initEp133Browser({showError});status('Ready to process files');});

import{inspectBrowserCapabilities}from './platformSupport.js?v=20261008-1';
import{createAudioContext,processAudioInputs,getPreset}from './audio/processor.js?v=20261008-1';
import{selectAudioImportFiles,describeAudioImportFailure}from './audio/importPolicy.js';
import{createZip}from './zip.js?v=20260921-7';
import{outputFileName,uniqueOutputPath}from './output-name.js';
import{pickerTypesForFile}from './save-file.js';
const state={ctx:null,fileResults:[],folderResults:[],folderName:'',cancelled:false,urls:new Set(),startedAt:0,folderZipUrl:null};
window.__speedUpperCutFiles=window.__speedUpperCutFiles||new Map();let openPreviewPromise=null;const loadPreview=()=>openPreviewPromise||(openPreviewPromise=import('./player.js?v=20261001-1').then(m=>m.openPreview));let waveformEditorPromise=null;const loadWaveformEditor=()=>waveformEditorPromise||(waveformEditorPromise=import('./waveform-editor.js?v=20261001-1').then(m=>m.openWaveformEditor));
let ep133BrowserPromise=null;const loadEp133Browser=()=>ep133BrowserPromise||(ep133BrowserPromise=import('./ep133/ui.js?v=20261001-1'));
const $=id=>document.getElementById(id);const selected=g=>document.querySelector(`.win95-list[data-group="${g}"] .list-item.selected`)?.dataset.value||(g==='fidelity'?'hi':'stereo');const selectedPlaymode=()=>document.querySelector('.playmode-control .list-item.selected')?.dataset.value||'oneshot';const status=t=>$('status-bar').textContent=t;const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));const bytes=n=>n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(1)} MB`;
function showError(message){const box=$('error-dialog');if(!box)return;$('error-message').textContent=String(message||'Unknown error');box.style.display='flex';$('error-ok').focus();}function hideError(){$('error-dialog').style.display='none';}async function saveBlob(blob,name){if(window.showSaveFilePicker){try{const h=await window.showSaveFilePicker({suggestedName:name,types:pickerTypesForFile(name,blob?.type)});const w=await h.createWritable();await w.write(blob);await w.close();return true;}catch(e){if(e?.name==='AbortError')return false;if(!['NotAllowedError','SecurityError','InvalidStateError'].includes(e?.name))throw e;}}const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);return true;}
function progress(v,text,i,total){$('progress-fill').style.width=`${v*100}%`;$('progress-text').textContent=`${Math.round(v*100)}%`;$('current-file').textContent=text;$('file-count').textContent=`File: ${i}/${total}`;$('progress-time').textContent=`Time: ${Math.max(0,Math.round((performance.now()-state.startedAt)/1000))}s`;}
function updateStats(){
  const all=[...state.fileResults,...state.folderResults];
  if(!all.length){$('stats-tab').innerHTML='<div><i class="fas fa-chart-pie"></i> No statistics yet.</div>';return;}
  const sourceFiles=all.reduce((sum,item)=>sum+(Number(item.file?.size)||0),0);
  const readyWavs=all.reduce((sum,item)=>sum+(Number(item.result?.blob?.size)||0),0);
  const optimized=all.reduce((sum,item)=>sum+(Number(item.result?.epStorage?.bytes)||0),0);
  const comparable=all.filter(item=>Number.isFinite(Number(item.result?.sourceEpStorage?.bytes)));
  const direct=comparable.reduce((sum,item)=>sum+Number(item.result.sourceEpStorage.bytes),0);
  const complete=comparable.length===all.length;
  const change=complete&&direct>0?(optimized/direct-1)*100:null;
  const directLabel=complete?bytes(direct):`N/A (${all.length-comparable.length} incompatible source${all.length-comparable.length===1?'':'s'})`;
  const changeLabel=change==null?'':change<=0
    ?`<div>Saved: ${Math.abs(change).toFixed(1)}%</div>`
    :`<div>Increased: ${change.toFixed(1)}%</div>`;
  $('stats-tab').innerHTML=
    `<div><i class="fas fa-chart-pie"></i> Processed ${all.length} file(s)</div>`+
    `<div><b>FILE SIZE</b></div><div>Source files: ${bytes(sourceFiles)}</div><div>EP-ready WAVs: ${bytes(readyWavs)}</div>`+
    `<div><b>EP STORAGE</b></div><div>Direct import estimate: ${directLabel}</div><div>SpeedUpperCut: ${bytes(optimized)}</div>`+
    changeLabel;
}
function renderFileResult(item){const list=$('results-list');if(list.querySelector('.empty-results'))list.innerHTML='';const row=document.createElement('div');row.className='result-item';row.draggable=true;const dragId=(crypto?.randomUUID?.()||String(Date.now())+Math.random());const outputName=outputFileName(item.file.name);const syncDragPayload=()=>window.__speedUpperCutFiles.set(dragId,{...item,outputName});syncDragPayload();row.dataset.dragId=dragId;row.addEventListener('dragstart',event=>{syncDragPayload();event.dataTransfer.setData('application/x-speeduppercut-result',dragId);event.dataTransfer.effectAllowed='copy';row.classList.add('dragging');});row.addEventListener('dragend',()=>row.classList.remove('dragging'));const name=document.createElement('span');name.className='result-name';name.textContent=outputName;const edit=document.createElement('button');edit.type='button';edit.className='download edit-waveform';edit.textContent='Edit';edit.onclick=async()=>{try{document.querySelector('#preview-window .preview-close')?.click();const openWaveformEditor=await loadWaveformEditor();openWaveformEditor(item,{state,createAudioContext,showError,onExportChops:async outputs=>{const chopBase=outputName.replace(/\.wav$/i,'');const files=outputs.map((output,index)=>({path:`${chopBase}_${String(index+1).padStart(2,'0')}.wav`,blob:output.blob}));const zip=await createZip(files);await saveBlob(zip,`${chopBase}_chops.zip`);status(`Exported ${outputs.length} chops: ${item.file.name}`);$('log-tab').insertAdjacentHTML('beforeend',`<div><i class="fas fa-cut"></i> Exported ${outputs.length} chops from ${esc(item.file.name)}</div>`);},onApply:async edited=>{const oldUrl=item.url;if(oldUrl){state.urls.delete(oldUrl);URL.revokeObjectURL(oldUrl);}item.result={...item.result,...edited,buffer:edited.buffer,blob:edited.blob,epStorage:edited.epStorage,edit:edited.edit};item.url=URL.createObjectURL(edited.blob);state.urls.add(item.url);row.classList.add('edited');row.dataset.edited='true';syncDragPayload();updateStats();status(`Edited: ${item.file.name} · ${edited.epStorage.duration.toFixed(3)}s`);$('log-tab').insertAdjacentHTML('beforeend',`<div><i class="fas fa-wave-square"></i> Edited ${esc(item.file.name)} · crop ${edited.edit.start.toFixed(3)}s–${edited.edit.end.toFixed(3)}s · gain ${edited.edit.gainDb} dB${edited.edit.normalize?' · normalized':''}</div>`);}});}catch(e){showError(e?.message||e);}};const preview=document.createElement('button');preview.type='button';preview.className='download';preview.textContent='Preview';preview.onclick=async()=>{try{const openPreview=await loadPreview();openPreview(item,{state,saveBlob,esc,createAudioContext});}catch(e){showError(e?.message||e);}};const dl=document.createElement('button');dl.className='download';dl.type='button';dl.textContent='Download';dl.onclick=()=>saveBlob(item.result.blob,name.textContent);row.append(name,edit,preview,dl);list.appendChild(row);}function resetFolderZip(){if(state.folderZipUrl){URL.revokeObjectURL(state.folderZipUrl);state.folderZipUrl=null;}$('folder-download-area').innerHTML='';}
async function createFolderZip(){if(!state.folderResults.length)return;const usedNames=new Set();const files=state.folderResults.map(item=>{const original=item.file.webkitRelativePath||item.file.name;const parts=original.split('/');parts[parts.length-1]=outputFileName(item.file.name);const name=parts.length>1?parts.slice(1).join('/'):parts[0];return{path:uniqueOutputPath(name,usedNames),blob:item.result.blob};});status('Creating processed folder ZIP...');const blob=await createZip(files);resetFolderZip();state.folderZipUrl=URL.createObjectURL(blob);const a=document.createElement('button');a.className='folder-download';a.type='button';a.textContent=`Download ${state.folderName} (${state.folderResults.length} files)`;a.onclick=()=>saveBlob(blob,`${state.folderName}_x2.zip`);$('folder-download-area').appendChild(a);}
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
function addFiles(list,fromFolder=false){
  if($('overlay').style.display==='flex'){
    showError('Finish or cancel the current processing batch before adding more files.');
    return;
  }
  const {accepted:files,ignored}=selectAudioImportFiles(list);
  if(!files.length){
    showError('No usable audio files found. Hidden macOS metadata, empty files and non-audio files are ignored.');
    return;
  }
  if(fromFolder){
    state.folderResults=[];state.folderName=getFolderName(files);resetFolderZip();
  }
  state.cancelled=false;
  $('memory-warning').style.display=files.reduce((n,f)=>n+f.size,0)>150*1024*1024?'block':'none';
  status('Selected '+files.length+' audio file(s)'+(ignored?' · ignored '+ignored+' metadata/unsupported file(s)':''));
  $('log-tab').insertAdjacentHTML('beforeend',
    '<div><i class="fas fa-file-import"></i> Added '+files.length+' audio file(s)'+(fromFolder?' from folder':'')+
    (ignored?' · Ignored '+ignored+' unsupported, empty or macOS metadata file(s)':'')+'</div>');
  void process(files,fromFolder,{ignored});
}
async function process(files,isFolder,{ignored=0}={}){
  if(!files.length||$('overlay').style.display==='flex')return;
  state.cancelled=false;
  state.startedAt=performance.now();
  $('overlay').style.display='flex';
  const failures=[],batch=[];
  try{
    state.ctx=state.ctx||createAudioContext();
    const fidelity=selected('fidelity'),channels=selected('channels');
    const playmode=selectedPlaymode(),p=getPreset(fidelity);
    for await(const {file:f,result:r,index:i} of processAudioInputs(files,{
      fidelity,channels,playmode,autoTrim:$('auto-trim').checked,context:state.ctx
    },{
      onStart:(f,i,total)=>progress(0,f.name,i+1,total),
      progress:(v,phase,i,total,f)=>progress(v,f.name+' · '+phase,i+1,total),
      shouldCancel:()=>state.cancelled,
      onFileError:(error,file,index,total)=>{
        const description=describeAudioImportFailure(error,file);
        failures.push(description);
        $('errors-tab').insertAdjacentHTML('beforeend',
          '<div><i class="fas fa-times-circle"></i> '+esc(description)+'</div>');
        $('log-tab').insertAdjacentHTML('beforeend',
          '<div><i class="fas fa-exclamation-triangle"></i> Skipped '+esc(file.webkitRelativePath||file.name)+
          ' ('+(index+1)+'/'+total+') · See Errors tab</div>');
      }
    })){
      const url=URL.createObjectURL(r.blob);
      state.urls.add(url);
      const item={file:f,result:r,url,fidelity,channels,playmode};
      batch.push(item);
      if(isFolder)state.folderResults.push(item);
      else{state.fileResults.push(item);renderFileResult(item);}
      $('log-tab').insertAdjacentHTML('beforeend',
        '<div><i class="fas fa-check-circle"></i> '+esc(f.name)+' → x2 · '+p.label+' '+p.sampleRate+
        ' Hz · 16-bit PCM · WAV · '+(r.channels===1?'mono':'stereo')+(channels==='original'?' (original)':'')+' · '+playmode+'</div>');
    }
    updateStats();
    // Preserve an exportable ZIP containing only successfully decoded inputs.
    if(isFolder&&batch.length&&!state.cancelled)await createFolderZip();
    if(!isFolder&&batch.length===1&&!state.cancelled&&failures.length===0){
      const openPreview=await loadPreview();
      openPreview(batch[0],{state,saveBlob,esc,createAudioContext});
    }
    const summary='Processed '+batch.length+'/'+files.length+' audio file(s)'+
      (failures.length?' · '+failures.length+' could not be decoded/processed':'')+
      (ignored?' · '+ignored+' non-audio/metadata ignored':'');
    status(summary);
    if(failures.length){
      // Do not silently claim the folder was fully converted. Completed WAVs
      // and the partial ZIP remain available for download.
      showError(summary+'. See Errors tab for the filenames and reasons. '+(batch.length?'The successful files are available.':failures[0]));
    }
  }catch(error){
    if(error?.name==='AbortError')status('Processing cancelled; completed files remain available.');
    else{
      const message=String(error?.message||error);
      $('errors-tab').insertAdjacentHTML('beforeend','<div><i class="fas fa-times-circle"></i> '+esc(message)+'</div>');
      showError(message);
      status('Error: '+message);
    }
  }finally{$('overlay').style.display='none';}
}
function updatePlatformNotice(){
  const support=inspectBrowserCapabilities({navigatorRef:navigator,windowRef:window,documentRef:document});
  const messages=[];
  const notice=$('platform-notice');
  const folderButton=$('select-folder-button');
  if(folderButton){
    folderButton.disabled=!support.folderInput;
    folderButton.title=support.folderInput?'Select a folder of audio files':'Folder selection is unavailable. Use Select Files instead.';
  }
  if(!support.converter.supported)messages.push(support.converter.message);
  if(!support.folderInput)messages.push('Folder selection is unavailable. Use Select Files instead.');
  if(!support.savePicker)messages.push('Saving uses the browser\'s normal download flow; choose a save location in browser settings if needed.');
  if(support.mobile)messages.push('MY EP USB management requires a desktop. Audio conversion may still work here.');
  if(notice){
    notice.hidden=messages.length===0;
    notice.textContent=messages.join(' ');
    notice.style.display=messages.length?'block':'none';
  }
  return support;
}
function clearAll(){document.querySelector('#preview-window .preview-close')?.click();document.querySelector('#waveform-editor [data-waveform-close]')?.click();if(state.ctx){try{state.ctx.close?.()}catch(e){}state.ctx=null}state.fileResults=[];state.folderResults=[];state.folderName='';for(const u of state.urls)URL.revokeObjectURL(u);state.urls.clear();window.__speedUpperCutFiles?.clear();resetFolderZip();$('log-tab').innerHTML='<div><i class="fas fa-info-circle"></i> Drop or select audio files to begin.</div><div><i class="fas fa-tachometer-alt"></i> Files are processed at x2 speed.</div>';$('errors-tab').innerHTML='<div><i class="fas fa-check-circle"></i> No errors yet.</div>';$('stats-tab').innerHTML='<div><i class="fas fa-chart-pie"></i> No statistics yet.</div>';$('results-list').innerHTML='<div class="empty-results">Processed files will appear here with download buttons.</div>';$('memory-warning').style.display='none';status('File list cleared');}
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
window.addEventListener('DOMContentLoaded',()=>{openMain();makeMainWindowDraggable();updatePlatformNotice();const drop=$('drop-zone'),fi=$('audio-upload'),folder=$('folder-upload');drop.setAttribute('role','button');drop.setAttribute('tabindex','0');drop.setAttribute('aria-label','Select or drop audio files and folders');drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fi.click();}});drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('dragover')});drop.addEventListener('dragleave',()=>drop.classList.remove('dragover'));drop.addEventListener('drop',async e=>{e.preventDefault();drop.classList.remove('dragover');try{const traversed=e.dataTransfer.items?.length?await filesFromDropItems(e.dataTransfer.items):[];const files=traversed.length?traversed:[...e.dataTransfer.files];const fromFolder=files.some(f=>f.webkitRelativePath)||[...e.dataTransfer.items||[]].some(i=>i.webkitGetAsEntry?.()?.isDirectory);addFiles(files,fromFolder);}catch(err){showError(err?.message||err);}});drop.addEventListener('click',e=>{if(e.target!==fi)fi.click()});fi.addEventListener('change',e=>{addFiles(e.target.files,false);e.target.value=''});folder.addEventListener('change',e=>{addFiles(e.target.files,true);e.target.value=''});$('select-file-button').onclick=()=>fi.click();$('select-folder-button').onclick=()=>folder.click();$('clear-button').onclick=clearAll;$('cancel-button').onclick=()=>{state.cancelled=true;status('Cancelling…')};$('error-ok').onclick=hideError;$('error-close').onclick=hideError;$('app-icon').onclick=openMain;$('app-icon').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openMain();}});$('main-window').querySelector('.close').onclick=closeMain;$('main-window').querySelector('.minimize').onclick=closeMain;document.querySelectorAll('.win95-list').forEach(g=>{
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
const myEpIcon=$('my-ep-icon');
const lazyMyEpKeydown=event=>{
  if(event.key!=='Enter'&&event.key!==' ')return;
  event.preventDefault();
  myEpIcon?.click();
};
const lazyOpenMyEp=async()=>{
  try{
    const module=await loadEp133Browser();
    module.initEp133Browser({showError});
    myEpIcon?.removeEventListener('keydown',lazyMyEpKeydown);
    myEpIcon?.click();
  }catch(error){showError(error?.message||error);}
};
myEpIcon?.addEventListener('keydown',lazyMyEpKeydown);
myEpIcon?.addEventListener('click',()=>{void lazyOpenMyEp();},{once:true});
window.addEventListener('beforeunload',()=>{try{state.ctx?.close?.()}catch(e){}});status('Ready to process files');});

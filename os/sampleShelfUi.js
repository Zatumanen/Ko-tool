import {createSampleShelf,filterShelfEntries} from './sampleShelf.js';

const formatShelfSize=bytes=>bytes>=1048576?(bytes/1048576).toFixed(1)+' MiB':(bytes/1024).toFixed(1)+' KiB';
const formatDuration=seconds=>Number.isFinite(seconds)&&seconds>0?seconds.toFixed(2)+'s':'DURATION UNKNOWN';

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[ch]);

/** UI for original local files; the existing Samples processor owns preparation. */
export function createSampleShelfUI(){
 let root=null,shelf=null,onPrepare=null,items=[],generation=0,controller=null;
 let audio=null,audioUrl=null,playingId=null,importing=false;
 const $=id=>root?.querySelector('#'+id);
 function stopAudio(){
  if(audio){audio.pause();audio.removeAttribute('src');audio.load();audio=null;}
  if(audioUrl){URL.revokeObjectURL(audioUrl);audioUrl=null;}
  playingId=null;
 }
 function message(text,error=false){
  const node=$('os-shelf-message');
  if(node){node.textContent=text;node.dataset.error=error?'true':'false';}
 }
 function markup(){
  return `<section class="os-shelf-panel" aria-label="Offline Sample Shelf">
   <div class="os-pane-title"><span>OFFLINE SAMPLE SHELF</span><span class="tiny-label" id="os-shelf-count">0 STORED</span></div>
   <div class="os-shelf-actions">
    <label class="button secondary os-shelf-import">ADD FILES<input id="os-shelf-upload" type="file" multiple accept="audio/*,.wav,.mp3,.aif,.aiff,.flac,.ogg,.m4a,.aac"></label>
    <label class="button secondary os-shelf-import">ADD FOLDER<input id="os-shelf-folder" type="file" multiple webkitdirectory directory></label>
    <label class="os-shelf-search-label">SEARCH LIBRARY<input id="os-shelf-search" type="search" placeholder="Sample name or folder…" aria-label="Search local samples"></label>
    <button id="os-shelf-clear" class="button secondary" type="button">CLEAR LIBRARY</button>
   </div>
   <p class="os-shelf-explain">Original audio only · saved locally in this browser · no upload or device access. Browser site data may be cleared or evicted. Prepared WAV files remain in the sample queue.</p>
   <p id="os-shelf-storage" class="os-shelf-storage">Checking browser storage…</p>
   <div id="os-shelf-list" class="os-shelf-list" aria-label="Locally stored samples"><p class="os-empty">Your offline shelf is empty. Add audio or a folder to keep files across visits.</p></div>
   <div class="os-shelf-footer">
    <span id="os-shelf-message" role="status" aria-live="polite">Local browser storage · clearing browser site data also deletes these files.</span>
    <button id="os-shelf-cancel" class="button secondary" type="button" hidden>CANCEL IMPORT</button>
   </div>
  </section>`;
 }
 function render(){
  if(!root)return;
  const result=filterShelfEntries(items,$('os-shelf-search')?.value);
  $('os-shelf-count').textContent=items.length+' STORED';
  $('os-shelf-clear').disabled=importing||items.length===0;
  $('os-shelf-list').innerHTML=result.length?result.map(item=>`
   <div class="os-shelf-entry" data-shelf-id="${item.id}">
    <div class="os-shelf-entry-main"><strong title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</strong>
     <small title="${escapeHtml(item.relativePath)}">${escapeHtml(item.relativePath)} · ${formatShelfSize(item.size)} · ${formatDuration(item.duration)} · ORIGINAL</small></div>
    <div class="os-shelf-entry-actions">
     <button type="button" data-shelf-action="preview" aria-label="Preview ${escapeHtml(item.name)}">${playingId===item.id?'STOP':'PLAY'}</button>
     <button type="button" data-shelf-action="prepare" aria-label="Prepare ${escapeHtml(item.name)}">PREPARE</button>
     <button type="button" data-shelf-action="remove" aria-label="Remove ${escapeHtml(item.name)}">REMOVE</button>
    </div>
   </div>`).join(''):'<p class="os-empty">'+(items.length?'No samples match your search.':'Your offline shelf is empty. Add audio or a folder to keep files across visits.')+'</p>';
 }
 async function reload(){
  const active=generation;
  try{
   const all=await shelf.list();
   if(active!==generation||!root)return;
   items=all;render();
   const bytes=items.reduce((sum,item)=>sum+item.size,0);
   const storage=$('os-shelf-storage');
   if(storage)storage.textContent=formatShelfSize(bytes)+' original audio saved · browser quota not reported';
   try{
    const estimate=await navigator.storage?.estimate?.();
    if(active!==generation||!root||!storage||!estimate?.quota)return;
    storage.textContent=formatShelfSize(bytes)+' original audio saved · site storage '+formatShelfSize(estimate.usage||0)+' / '+formatShelfSize(estimate.quota)+' quota';
   }catch{/* Quota may be unavailable in privacy modes; actual imports still report errors. */}
  }catch(error){if(active===generation)message('Offline library unavailable: '+String(error?.message||error),true);}
 }
 async function importAudio(list){
  if(importing||!shelf)return;
  const files=Array.from(list||[]);
  if(!files.length)return;
  importing=true;controller=new AbortController();
  const run=generation;
  $('os-shelf-cancel').hidden=false;
  $('os-shelf-upload').disabled=true;
  $('os-shelf-folder').disabled=true;
  render();
  message('Importing '+files.length+' file(s)…');
  try{
   const result=await shelf.importFiles(files,{
    signal:controller.signal,
    onProgress:p=>{if(generation===run)message('IMPORT '+p.index+'/'+p.total+' · SAVED '+p.added+' · DUPLICATES '+p.duplicates);}
   });
   if(generation!==run)return;
   await reload();
   const parts=[result.added+' added',result.duplicates+' duplicates',result.rejected+' unsupported',result.failed+' errors'];
   if(result.cancelled)parts.push('cancelled, previously saved files kept');
   message(parts.join(' · ')+(result.errors.length?' · '+result.errors.slice(0,2).join('; '):''),result.failed>0||result.rejected>0);
  }catch(error){if(generation===run)message('Import failed; already stored files remain: '+String(error?.message||error),true);}
  finally{
   if(generation===run&&root){
    importing=false;controller=null;
    $('os-shelf-cancel').hidden=true;
    $('os-shelf-upload').disabled=false;$('os-shelf-folder').disabled=false;
    render();
   }
  }
 }
 async function play(id){
  if(playingId===id){stopAudio();render();return;}
  stopAudio();
  const record=await shelf.get(id);
  if(!root||!record?.blob){message('Sample is missing from the local shelf.',true);return;}
  audioUrl=URL.createObjectURL(record.blob);audio=new Audio(audioUrl);playingId=id;
  audio.addEventListener('loadedmetadata',()=>{
   const seconds=audio?.duration;
   if(!Number.isFinite(seconds)||seconds<=0)return;
   void shelf.setDuration(id,seconds).then(()=>reload()).catch(()=>{});
  });
  audio.addEventListener('ended',()=>{stopAudio();render();});
  audio.addEventListener('error',()=>{stopAudio();message('This audio cannot be previewed in this browser.',true);render();});
  render();
  try{await audio.play();}
  catch(error){stopAudio();message('Preview unavailable: '+String(error?.message||error),true);render();}
 }
 async function act(event){
  const button=event.target.closest('[data-shelf-action]');
  if(!button||!root||importing)return;
  const id=button.closest('[data-shelf-id]')?.dataset.shelfId;
  if(!id)return;
  const action=button.dataset.shelfAction;
  if(action==='preview'){await play(id);return;}
  if(action==='remove'){
   if(playingId===id)stopAudio();
   await shelf.remove(id);await reload();
   message('Removed from this browser only. No EP files were changed.');
   return;
  }
  if(action==='prepare'){
   const record=await shelf.get(id);
   if(!root||!record?.blob){message('Sample is missing from the local shelf.',true);return;}
   const file=new File([record.blob],record.name,{type:record.type});
   message('Preparing '+record.name+' in the existing converter…');
   await onPrepare?.([file]);
  }
 }
 function mount(element,{prepare}={}){
  generation++;root=element;onPrepare=prepare;items=[];importing=false;
  root.innerHTML=markup();
  try{shelf=createSampleShelf();}catch(error){
   message('Offline storage unavailable: '+String(error?.message||error),true);
   $('os-shelf-upload').disabled=true;$('os-shelf-folder').disabled=true;
   return;
  }
  $('os-shelf-upload').addEventListener('change',event=>{
   void importAudio(event.target.files);event.target.value='';
  });
  $('os-shelf-folder').addEventListener('change',event=>{
   void importAudio(event.target.files);event.target.value='';
  });
  $('os-shelf-search').addEventListener('input',render);
  $('os-shelf-list').addEventListener('click',event=>{void act(event).catch(error=>message(String(error?.message||error),true));});
  $('os-shelf-cancel').addEventListener('click',()=>controller?.abort());
  $('os-shelf-clear').addEventListener('click',()=>{
   if(importing||!items.length||!window.confirm('Delete all original samples in this browser library? This cannot be undone.'))return;
   stopAudio();
   void shelf.clear().then(()=>reload()).then(()=>message('Local shelf cleared. No device data was touched.'))
    .catch(error=>message('Cannot clear local shelf: '+String(error?.message||error),true));
  });
  void reload();
 }
 function dispose(){generation++;controller?.abort();controller=null;stopAudio();root=null;onPrepare=null;}
 return Object.freeze({mount,dispose});
}

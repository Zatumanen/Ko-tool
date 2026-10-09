import {processAudioInputs,EP_REPITCH_FACTOR,EP_REPITCH_COMPENSATION} from '../js/audio/processor.js';
import {outputFileName} from '../js/output-name.js';

export function formatBytes(value){
 const n=Number(value);
 if(!Number.isFinite(n)||n<0)return '—';
 if(n<1024)return n+' B';
 if(n<1048576)return (n/1024).toFixed(1)+' KB';
 return (n/1048576).toFixed(2)+' MB';
}
export function storageDelta(source,prepared){
 const a=Number(source?.bytes),b=Number(prepared?.bytes);
 if(!Number.isFinite(a)||a<=0||!Number.isFinite(b)||b<0)return null;
 return Math.round((1-b/a)*100);
}
export function createSampleWorkspaceController(){
 const state={files:[],active:null,busy:false,token:0,root:null,audio:null,audioUrl:null,meter:null};
 const escapeText=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[ch]));
 function html(){
  return `<div class="os-samples">
 <section class="os-workflow-heading"><div><div class="eyebrow">SAMPLES / WORKSPACE 01</div><h2>Sample laboratory</h2><p>Real EP-ready WAV conversion · your files remain on this computer</p></div>
 <button type="button" class="button secondary" data-os-open-device>DEVICE TRANSFER →</button></section>
 <section class="os-space-saver"><div class="os-toggle-mark">×2</div><div><strong>SPACE SAVER</strong><p>Always prepares audio at x2 speed, with −12 semitone pitch metadata. Confirm playback settings on KO II after import.</p></div><span class="os-fixed-badge">ALWAYS ON</span></section>
 <section class="os-sample-layout">
  <div class="os-sample-library">
   <div class="os-pane-title"><span>SAMPLE QUEUE</span><span id="os-sample-count" class="tiny-label">0 FILES</span></div>
   <label class="os-file-drop" id="os-file-drop"> <span class="os-file-drop-icon">＋</span><strong>ADD AUDIO</strong><small>WAV · MP3 · AAC · FLAC · OGG</small>
     <input id="os-audio-upload" type="file" multiple accept=".wav,.mp3,.aac,.ogg,.flac,.m4a,audio/*"></label>
   <div class="os-process-controls">
    <label>OUTPUT QUALITY<select id="os-quality" aria-label="Output quality"><option value="hi">HI · 46,875 Hz</option><option value="mid">MID · 32 kHz</option><option value="lo">LO · 26,250 Hz</option></select></label>
    <label>CHANNELS<select id="os-channels" aria-label="Output channels"><option value="mono">Mono · save memory</option><option value="stereo">Stereo</option></select></label>
    <label class="os-checkbox"><input id="os-trim" type="checkbox" checked> Auto-trim silence</label>
   </div>
   <div id="os-file-list" class="os-file-list" role="listbox" aria-label="Converted audio files"><p class="os-empty">Your converted samples will appear here.<br>Choose a file to get started.</p></div>
   <div class="os-queue-foot" id="os-queue-foot"><span>LOCAL FILES ONLY</span><span>NO DEVICE WRITES</span></div>
  </div>
  <div class="os-sample-editor">
   <div class="os-pane-title"><span>WAVEFORM EDITOR / PREVIEW</span><span class="tiny-label" id="os-sample-mode">READY</span></div>
   <div class="os-editor-head"><div class="eyebrow">SELECTED AUDIO</div><h3 id="os-sample-name">NO SAMPLE SELECTED</h3><p id="os-sample-subtitle">Import a file to generate real waveform data.</p></div>
   <div class="os-wave-panel"><canvas id="os-sample-wave" width="740" height="230" aria-label="Actual prepared audio waveform"></canvas><div class="os-wave-labels"><span>0:00</span><span id="os-wave-mid">—</span><span id="os-wave-end">—</span></div></div>
   <div class="os-audio-stats"><div><span>EP STORAGE</span><strong id="os-storage-after">—</strong></div><div><span>DIRECT IMPORT</span><strong id="os-storage-before">—</strong></div><div><span>MEMORY SAVED</span><strong id="os-storage-saved">—</strong></div><div><span>REPITCH</span><strong>−12 ST</strong></div></div>
   <div class="os-audio-actions"><button id="os-preview-button" class="button secondary" disabled>▶ PREVIEW</button><button id="os-download-button" class="button" disabled>↓ DOWNLOAD WAV</button></div>
   <p class="os-workspace-advisory">WAV contains reference output and pitch metadata. It is not transferred automatically; use My EP to inspect device compatibility, assign slots and authorize writes.</p>
  </div>
 </section>
 <div class="os-progress" id="os-processing-box" hidden role="status" aria-live="polite"><strong id="os-processing-title">PROCESSING</strong><progress id="os-processing-progress" max="100" value="0"></progress><span id="os-processing-step">PREPARING...</span><button id="os-cancel-process" type="button">CANCEL</button></div>
 <div class="os-processing-error" id="os-processing-error" hidden role="alert"></div>
 </div>`;
 }
 function rootElement(id){return state.root?.querySelector('#'+id);}
 function setMessage(message,error=false){const node=rootElement('os-processing-error');if(node){node.textContent=message;node.hidden=!message;node.dataset.error=error?'true':'false';}}
 function redrawList(){
  const count=rootElement('os-sample-count'),list=rootElement('os-file-list');
  if(!list)return;
  count.textContent=state.files.length+' FILE'+(state.files.length===1?'':'S');
  list.innerHTML=state.files.length?state.files.map((x,index)=>{
   const selected=index===state.active?' selected':'';
   return '<button type="button" class="os-file-entry'+selected+'" data-os-file="'+index+'" role="option" aria-selected="'+String(index===state.active)+'"><span class="os-file-idx">'+String(index+1).padStart(2,'0')+'</span><span class="os-file-detail"><strong>'+escapeText(x.file.name)+'</strong><small>'+formatBytes(x.result.epStorage?.bytes)+' · '+x.result.sampleRate+' Hz</small></span><span class="os-file-ready">READY</span></button>';
  }).join(''):'<p class="os-empty">Your converted samples will appear here.<br>Choose a file to get started.</p>';
 }
 function resetPlayback(){
  if(state.audio){state.audio.pause();state.audio.removeAttribute('src');state.audio.load();state.audio=null;}
  if(state.audioUrl){URL.revokeObjectURL(state.audioUrl);state.audioUrl=null;}
  state.meter?.stop?.();
 }
 function drawWave(buffer){
  const canvas=rootElement('os-sample-wave');if(!canvas)return;
  const c=canvas.getContext('2d');if(!c)return;
  const W=canvas.width,H=canvas.height;c.clearRect(0,0,W,H);
  c.strokeStyle='#48545b';c.lineWidth=1;c.beginPath();c.moveTo(0,H/2);c.lineTo(W,H/2);c.stroke();
  if(!buffer)return;
  const data=buffer.getChannelData(0);
  const section=Math.max(1,Math.floor(data.length/W));
  const contrast=getComputedStyle(document.body).getPropertyValue('--signal').trim()||'#fa714b';
  c.strokeStyle=contrast;c.lineWidth=1.35;c.beginPath();
  for(let x=0;x<W;x++){
    const from=x*section,to=Math.min(from+section,data.length);
    let v=0;
    for(let i=from;i<to;i+=Math.max(1,Math.floor(section/38)))v=Math.max(v,Math.abs(data[i]||0));
    const extent=v*H*.44;
    c.moveTo(x,H/2-extent);c.lineTo(x,H/2+extent);
  }
  c.stroke();
 }
 function setActive(index){
  if(index<0||index>=state.files.length)return;
  resetPlayback();
  state.active=index;
  redrawList();
  const {file,result}=state.files[index];
  rootElement('os-sample-name').textContent=outputFileName(file.name);
  rootElement('os-sample-subtitle').textContent=`Prepared from ${file.name} · ${result.epStorage.duration.toFixed(2)} seconds · ${result.channels===1?'MONO':'STEREO'}`;
  rootElement('os-storage-after').textContent=formatBytes(result.epStorage?.bytes);
  rootElement('os-storage-before').textContent=formatBytes(result.sourceEpStorage?.bytes);
  const saving=storageDelta(result.sourceEpStorage,result.epStorage);
  rootElement('os-storage-saved').textContent=saving===null?'NOT COMPARABLE':saving<0?`${-saving}% MORE`:`${saving}% LESS`;
  rootElement('os-wave-mid').textContent=(result.epStorage.duration/2).toFixed(2)+'s';
  rootElement('os-wave-end').textContent=result.epStorage.duration.toFixed(2)+'s';
  rootElement('os-preview-button').disabled=false;
  rootElement('os-download-button').disabled=false;
  rootElement('os-sample-mode').textContent='REAL AUDIO';
  drawWave(result.buffer);
 }
 async function convert(files){
  if(state.busy)return;
  const selected=Array.from(files||[]).filter(f=>f?.arrayBuffer&&f.size>0);
  if(!selected.length)return;
  const quality=rootElement('os-quality')?.value||'hi';
  const channels=rootElement('os-channels')?.value||'mono';
  const autoTrim=rootElement('os-trim')?.checked!==false;
  const token=++state.token;
  state.busy=true;setMessage('');
  const progressBox=rootElement('os-processing-box');
  if(progressBox)progressBox.hidden=false;
  const upload=rootElement('os-audio-upload');if(upload)upload.disabled=true;
  const startPerformance=performance.now();
  try{
   const ctx=new (window.AudioContext||window.webkitAudioContext)();
   try{
    for await(const item of processAudioInputs(selected,{fidelity:quality,channels,playmode:'oneshot',autoTrim,context:ctx},{
      shouldCancel:()=>state.token!==token,
      progress:(ratio,phase,index,total,file)=>{
       const value=rootElement('os-processing-progress'),step=rootElement('os-processing-step'),title=rootElement('os-processing-title');
       if(value)value.value=Math.max(0,Math.min(100,Math.round(ratio*100)));
       if(step)step.textContent=phase+' · '+file.name;
       if(title)title.textContent='PROCESSING '+(index+1)+' / '+total;
      }
    })){
      state.files.push(item);
      if(state.active===null)state.active=0;
      redrawList();setActive(state.files.length-1);
    }
   }finally{await ctx.close().catch(()=>{});}
   const elapsed=((performance.now()-startPerformance)/1000).toFixed(1);
   setMessage('Prepared '+selected.length+' sample'+(selected.length===1?'':'s')+' in '+elapsed+'s. No device writes were performed.');
  }catch(error){
   setMessage(error?.name==='AbortError'?'Processing cancelled. Already completed files remain available.':String(error?.message||error),error?.name!=='AbortError');
  }finally{
   state.busy=false;if(progressBox)progressBox.hidden=true;
   if(upload)upload.disabled=false;
  }
 }
 function download(){
  if(state.active===null)return;
  const {file,result}=state.files[state.active];
  const link=document.createElement('a'),url=URL.createObjectURL(result.blob);
  link.href=url;link.download=outputFileName(file.name);link.style.display='none';
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
 }
 async function preview(){
  if(state.active===null)return;
  if(state.audio&&!state.audio.paused){state.audio.pause();state.meter?.stop?.();rootElement('os-preview-button').textContent='▶ PREVIEW';return;}
  if(!state.audio){
   const {result}=state.files[state.active];
   state.audioUrl=URL.createObjectURL(result.blob);
   state.audio=new Audio(state.audioUrl);
   state.audio.addEventListener('ended',()=>{
    const b=rootElement('os-preview-button');if(b)b.textContent='▶ PREVIEW';
    state.meter?.stop?.();
   });
  }
  try{
   await state.meter?.start?.(state.audio);
   await state.audio.play();
   rootElement('os-preview-button').textContent='Ⅱ PAUSE';
  }catch(err){setMessage('Audio preview failed: '+String(err?.message||err),true);}
 }
 function mount(root,meter){
  state.root=root;state.meter=meter;
  root.innerHTML=html();
  redrawList();
  if(state.active!==null)setActive(state.active);
  const input=rootElement('os-audio-upload');
  input.addEventListener('change',event=>{void convert(event.target.files);event.target.value='';});
  const drop=rootElement('os-file-drop');
  drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('dragover');});
  drop.addEventListener('dragleave',()=>drop.classList.remove('dragover'));
  drop.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();drop.classList.remove('dragover');void convert(e.dataTransfer?.files);});
  rootElement('os-file-list').addEventListener('click',event=>{
   const entry=event.target.closest('[data-os-file]');if(entry)setActive(Number(entry.dataset.osFile));
  });
  rootElement('os-preview-button').addEventListener('click',()=>{void preview();});
  rootElement('os-download-button').addEventListener('click',download);
  rootElement('os-cancel-process').addEventListener('click',()=>{state.token++;});
 }
 function dispose(){resetPlayback();state.root=null;}
 return Object.freeze({mount,dispose,getFileCount:()=>state.files.length});
}

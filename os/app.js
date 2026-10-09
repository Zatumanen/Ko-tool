import {startEpStatusReceiver,describeEpStatus} from '../js/ep133/runtimeStatusTelemetry.js';
import {createSampleWorkspaceController} from './sampleWorkspace.js';
import {createSequencerSketch} from './sequencerSketch.js';
/**
 * Experimental Speeduppercut OS shell. No WebMIDI requests or device writes.
 * This first ZAT-16 slice only owns navigation, theme preference and visual DEMO meters.
 */
export const WORKSPACES=Object.freeze(['samples','projects','device','sequencer','community','visualizers','settings']);
export function normalizeWorkspace(value){
  const target=String(value||'').toLowerCase().replace(/^#os-/,'');
  return WORKSPACES.includes(target)?target:'samples';
}
export function normalizeTheme(value){return value==='classic'?'classic':'studio';}
export const PAGES=Object.freeze({
 samples:{
  title:'Samples',subtitle:'Prepare sounds, reduce memory usage, then move them using the trusted tools.',
  heading:'Less waiting. More sound.',description:'The new Sample Workspace is being integrated. Until then, the existing converter and My EP retain all working operations — including the verified x2 processing path.',
  tiles:[
   {eyebrow:'WORKING NOW / ORIGINAL APP',title:'Converter / Waveform / Chop',copy:'Convert with the tested x2 pipeline. Use the current waveform editor, trim tools and chop export locally in the original app.',action:'OPEN CONVERTER ↗',href:'../index.html'},
   {eyebrow:'WORKING NOW / DEVICE TOOL',title:'Sample Library + Transfer',copy:'View device slots and use the existing guarded transfer, waveform and backup workflows.',action:'OPEN MY EP ↗',href:'../index.html#my-ep'},
   {eyebrow:'DESIGN PREVIEW / UPCOMING',title:'Space Saver on Import',copy:'The new one-switch UI is being designed. No new or unverified pitch settings are applied by this preview.'},
   {eyebrow:'DESIGN PREVIEW / UPCOMING',title:'Unified Sample Pool',copy:'Your sounds, saved collections and community packs will become one searchable workspace. No online service is connected yet.'}
  ]
 },
 projects:{
  title:'Projects',subtitle:'Inspect, archive and prepare your EP projects.',
  heading:'Keep every idea.',description:'Real project operations remain in My EP. The new project cards, banks and sessions will reuse verified project metadata, not demo values.',
  tiles:[
   {eyebrow:'WORKING NOW / ORIGINAL APP',title:'Device Projects',copy:'Open the existing read-only project browser and the hardware-gated editor.',action:'OPEN MY EP ↗',href:'../index.html#my-ep'},
   {eyebrow:'PLANNED',title:'Snapshots + History',copy:'Find backups by project, compare dependencies and restore with explicit confirmation.'},
   {eyebrow:'PLANNED',title:'Project Library',copy:'Preview scene structure, names and dependencies without connecting to the device.'},
   {eyebrow:'PLANNED',title:'Portable Sharing',copy:'Create validated shareable project bundles with sample dependencies and private metadata removed.'}
  ]
 },
 device:{
  title:'Device',subtitle:'See the real KO II status and operate safely.',
  heading:'Real hardware. No guesses.',description:'This shell does not connect or request USB-MIDI access. Live session status arrives read-only from My EP in another tab; transfers remain in the guarded device manager.',
  tiles:[
   {eyebrow:'CONNECT THROUGH ORIGINAL MY EP',title:'KO II Device Manager',copy:'MIDI / SysEx support, firmware-aware capabilities, transfer verification and recovery are all handled by the existing app.',action:'OPEN DEVICE MANAGER ↗',href:'../index.html#my-ep'},
   {eyebrow:'WORKING NOW / MY EP',title:'Storage, Backup / Restore',copy:'Inspect hardware sample memory, create project backups and access the existing guarded recovery workflows.',action:'OPEN DEVICE STORAGE ↗',href:'../index.html#my-ep'},
   {eyebrow:'LIVE / ZAT-17',title:'Persistent Global Status',copy:'This header now listens to authoritative My EP state in another same-origin tab. The status becomes unavailable when the live session stops reporting.'}
  ]
 },
 sequencer:{
  title:'Sequencer',subtitle:'Patterns, steps, scenes and song structure.',
  heading:'See the whole groove.',description:'A multi-lane sequencer UI is next. Only read and write operations supported by the validated device project protocol will be enabled.',
  tiles:[
   {eyebrow:'WORKING NOW / MY EP',title:'Project Sequencer',copy:'Use the existing verified project sequencer from inside My EP where supported.',action:'OPEN MY EP ↗',href:'../index.html#my-ep'},
   {eyebrow:'PLANNED',title:'Step Grid + Scenes',copy:'Readable patterns and song position timeline, with visible device compatibility boundaries.'}
  ]
 },
 community:{
  title:'Community',subtitle:'Discover and share sample banks and project ideas.',
  heading:'Share sounds, not restrictions.',description:'Community is a product proposal, not an active public database. The intended platform will include permissions, licensing, credit, abuse controls and complete import previews.',
  tiles:[
   {eyebrow:'COMING LATER',title:'Shared Sample Pool',copy:'Search packs by sound, genre, device format and license. Preview locally before importing.'},
   {eyebrow:'COMING LATER',title:'Project Exchange',copy:'Upload an approved, dependency-complete bundle that omits private hardware identifiers.'}
  ]
 },
 visualizers:{
  title:'Visualizers',subtitle:'Make your live music look alive.',
  heading:'Made for the camera.',description:'The dock below currently draws a synthetic demo signal, NOT microphone, system or KO II audio. Real signal routing and calibrated loudness need separate implementation.',
  tiles:[
   {eyebrow:'DEMO / SYNTHETIC SIGNAL',title:'Visualizer Dock',copy:'Waveform and spectrum are illustrative. No capture has started, and no output is being recorded.'},
   {eyebrow:'PLANNED',title:'Performance Mode',copy:'Resizable meter-only view with explicit input source, layout presets and readable live capture state.'}
  ]
 },
 settings:{
  title:'Settings',subtitle:'Customize your workspace without hiding essential functions.',
  heading:'Your instrument, your setup.',description:'This preview only saves a local appearance preference. There are no subscription gates and no donation/payment processor configured.',
  tiles:[
   {eyebrow:'WORKING NOW',title:'Studio / Classic',copy:'Switch the full OS design without changing device permissions or audio settings.',action:'SWITCH APPEARANCE',actionName:'toggle-theme'},
   {eyebrow:'WORKING NOW / LEGACY',title:'Diagnostics / Recovery',copy:'View existing processing errors and guarded device recovery using the original application.',action:'OPEN DIAGNOSTICS ↗',href:'../index.html#my-ep'},
   {eyebrow:'FREE CORE / SUPPORT',title:'Support the Project',copy:'Voluntary donations are planned. A recipient and compliant checkout have not yet been configured.',action:'SUPPORT DETAILS',actionName:'support-info'}
  ]
 }
});
export function renderPage(page){
  const safe=normalizeWorkspace(page);
  const model=PAGES[safe];
  const tiles=model.tiles.map(tile=>{
    const btn=tile.href?'<a class="button" href="'+tile.href+'"'+(tile.href.includes('#my-ep')?' target="_blank" rel="noopener"':'')+'>'+tile.action+'</a>':
      tile.actionName?'<button class="button secondary" type="button" data-action="'+tile.actionName+'">'+tile.action+'</button>':'';
    return '<article class="os-tile"><div class="eyebrow">'+tile.eyebrow+'</div><h3>'+tile.title+'</h3><p>'+tile.copy+'</p>'+btn+'</article>';
  }).join('');
  return '<section class="hero-card"><div class="kicker">SPEEDUPPERCUT / '+safe.toUpperCase()+'</div><h2>'+model.heading+'</h2><p>'+model.description+'</p></section><div class="subbar"><span class="eyebrow">WORKSPACE MODULES</span><span class="pill">EARLY ACCESS · SAFE PREVIEW</span></div><section class="cards">'+tiles+'</section>';
}
function init(){
 const $=id=>document.getElementById(id);
 const state={theme:normalizeTheme(readSavedTheme()),page:normalizeWorkspace(location.hash),live:null};
 const sampleWorkspace=createSampleWorkspaceController();
 const sequencerSketch=createSequencerSketch();
 const meters=startDemoMeters();
 const root=document.body,view=$('os-view'),title=$('os-view-title'),desc=$('os-view-description');
 let toastTimer=0;
 function toast(message){const n=$('os-toast');n.textContent=message;n.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.classList.remove('visible'),5500);}
 function updateTheme(value){
  state.theme=normalizeTheme(value);
  root.dataset.osTheme=state.theme;
  const button=$('os-theme');
  button.textContent=state.theme==='studio'?'CLASSIC THEME':'STUDIO THEME';
  button.setAttribute('aria-pressed',String(state.theme==='classic'));
  try{localStorage.setItem('speeduppercut-os-theme',state.theme);}catch{}
 }
 function updatePage(page){
  state.page=normalizeWorkspace(page);
  const model=PAGES[state.page];
  title.textContent=model.title;desc.textContent=model.subtitle;
  sampleWorkspace.dispose();
  sequencerSketch.dispose();
  view.innerHTML=renderPage(state.page);
  if(state.page==='device')view.insertAdjacentHTML('afterbegin',`<section class="os-runtime-diagnostics" id="os-runtime-diagnostics" aria-label="Live device diagnostics"><div class="eyebrow">LIVE SESSION / READ ONLY</div><h2 id="os-diag-heading">Waiting for My EP</h2><div class="os-diagnostic-fields"><div>CONNECTION <strong id="os-diag-connection">UNAVAILABLE</strong></div><div>MODEL <strong id="os-diag-model">—</strong></div><div>FIRMWARE <strong id="os-diag-firmware">—</strong></div><div>SESSION OWNERSHIP <strong id="os-diag-owner">—</strong></div><div>ACTIVE OPERATION <strong id="os-diag-operation">—</strong></div><div>RECOVERY <strong id="os-diag-recovery">—</strong></div></div><p id="os-diag-reason">Open the legacy My EP interface in another tab to start its device session. No permissions are requested by this view.</p><a href="../index.html#my-ep" target="_blank" rel="noopener" class="button secondary">OPEN LIVE MY EP SESSION ↗</a></section>`);
  if(state.page==='samples')sampleWorkspace.mount(view,meters);
  if(state.page==='sequencer')sequencerSketch.mount(view);
  document.querySelectorAll('#os-navigation [data-view]').forEach(button=>{
   if(button.dataset.view===state.page)button.setAttribute('aria-current','page');
   else button.removeAttribute('aria-current');
  });
  const helper=$('assistant-copy');
  helper.textContent=state.page==='samples'?'The new library is still a preview. Use the existing converter or My EP for safe, working operations.':
   state.page==='device'?'Connection is not claimed here. Open My EP to see the actual device session and capabilities.':
   state.page==='visualizers'?'This dock displays an intentionally synthetic signal. Device audio requires a separate audio input.':
   'This is a visual preview. No EP operations are issued by the new shell.';
  $('assistant-heading').textContent=state.page==='device'?'Connection is delegated':state.page==='visualizers'?'Demo meters are active':'Safe preview mode';
  renderLiveState();
 }
 function renderLiveState(){
  const d=state.live,info=describeEpStatus(d);
  const label=$('os-runtime-label'),subtitle=$('os-runtime-subtitle'),led=$('os-runtime-led'),trigger=$('os-runtime-trigger');
  if(label)label.textContent=d?info.label:'NO DEVICE SESSION';
  if(subtitle)subtitle.textContent=d?info.detail:'OPEN MY EP IN ANOTHER TAB';
  if(led)led.className='led os-led-'+info.tone;
  if(trigger){
   trigger.dataset.state=d?.status||'unavailable';
   trigger.title=d?'Device status: '+info.label+' — open diagnostics':'No live device status — open diagnostics';
   trigger.setAttribute('aria-label',trigger.title);
  }
  const displayState=$('os-ko-display-state'),displayFw=$('os-ko-display-firmware');
  if(displayState)displayState.textContent=d?.status?.toUpperCase()||'NO SESSION';
  if(displayFw)displayFw.textContent=d?.firmware?'FW '+d.firmware:'FW —';
  const inspector=$('os-inspector-status');
  if(inspector)inspector.textContent=d?info.detail:'No live My EP publisher found. Device status is not available; no connection has been inferred.';
  const values={
   'os-diag-heading':d?info.label:'No verified live session',
   'os-diag-connection':d?d.status.toUpperCase():'UNAVAILABLE',
   'os-diag-model':d?.sku||'—',
   'os-diag-firmware':d?.firmware||'—',
   'os-diag-owner':d?.ownership?.toUpperCase()||'—',
   'os-diag-operation':d?.operation||d?.phase?.toUpperCase()||'—',
   'os-diag-recovery':d?(d.status==='recovery-required'?'REQUIRED':d.safety==='unsafe'?'UNSAFE':d.recoveryHydrated?'CHECKED':'NOT YET CHECKED'):'UNKNOWN',
   'os-diag-reason':d?.reason||(!d?'No active My EP status publisher. Open My EP in a second tab and connect explicitly; disconnected or expired status is never treated as safe.':d.status==='ready'?'Identity and ownership verified; recovery scan completed in the active session. Device operations still require explicit action in My EP.':'Read-only status from the active My EP session. See My EP for recovery, errors and safe actions.')
  };
  for(const [id,value]of Object.entries(values)){const el=$(id);if(el)el.textContent=value;}
  if(d&&['unsafe','recovery-required','blocked'].includes(d.status)){
   $('assistant-heading').textContent=d.status==='recovery-required'?'Device recovery needed':'Device access restricted';
   $('assistant-copy').textContent=d.reason||'Device is not ready for write operations. Inspect live My EP diagnostics before proceeding.';
  }
  if(!d&&state.page==='device'){
   $('assistant-heading').textContent='No live session';
   $('assistant-copy').textContent='Open My EP in another tab to connect and keep this interface updated. The OS shell never requests MIDI permissions itself.';
  }
 }
 function navigate(page){
  updatePage(page);
  const hash='#os-'+state.page;
  if(location.hash!==hash)history.replaceState(null,'',hash);
 }
 document.querySelectorAll('#os-navigation [data-view]').forEach(button=>button.addEventListener('click',()=>navigate(button.dataset.view)));
 document.addEventListener('click',event=>{
  const action=event.target.closest('[data-action]')?.dataset.action;
  if(action==='toggle-theme')updateTheme(state.theme==='studio'?'classic':'studio');
  if(action==='support-info')toast('Support is planned, but payment links are not configured. Essential tools stay free.');
 });
 $('os-runtime-trigger').addEventListener('click',()=>{navigate('device');$('os-runtime-diagnostics')?.scrollIntoView?.({behavior:'smooth',block:'start'});});
 $('os-open-diagnostics').addEventListener('click',()=>navigate('device'));
 $('os-theme').addEventListener('click',()=>updateTheme(state.theme==='studio'?'classic':'studio'));
 $('support-info').addEventListener('click',()=>toast('Support and donation links will be added only after the recipient is verified.'));
 window.addEventListener('hashchange',()=>updatePage(location.hash));
 updateTheme(state.theme);updatePage(state.page);
 const statusReceiver=startEpStatusReceiver({onChange:live=>{state.live=live;renderLiveState();}});
 window.addEventListener('pagehide',()=>statusReceiver.dispose(),{once:true});
}
function readSavedTheme(){try{return localStorage.getItem('speeduppercut-os-theme');}catch{return null;}}
function startDemoMeters(){
 const wave=document.getElementById('os-waveform'),spectrum=document.getElementById('os-spectrum');
 const w=wave?.getContext('2d'),s=spectrum?.getContext('2d');
 if(!w||!s)return Object.freeze({start:async()=>{},stop:()=>{},reset:()=>{}});
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
 const label=document.getElementById('meter-source');
 let ctx=null,analyser=null,audio=null,active=false;
 let frame=0;
 async function start(element){
  if(audio!==element){
   if(ctx){await ctx.close().catch(()=>{});}
   const AC=window.AudioContext||window.webkitAudioContext;
   if(!AC)throw Error('Web Audio API is unavailable');
   ctx=new AC();analyser=ctx.createAnalyser();analyser.fftSize=2048;
   const source=ctx.createMediaElementSource(element);
   source.connect(analyser);analyser.connect(ctx.destination);
   audio=element;
  }
  await ctx.resume();
  active=true;
  if(label)label.textContent='LOCAL WAV PLAYBACK / LIVE AUDIO LEVELS';
 }
 function stop(){active=false;if(label)label.textContent='DEMO SIGNAL / NOT DEVICE AUDIO';}
 function reset(){stop();audio=null;analyser=null;const prev=ctx;ctx=null;prev?.close().catch(()=>{});}
 function draw(){
  if(!document.hidden){
   const W=wave.width,H=wave.height;
   w.clearRect(0,0,W,H);w.strokeStyle='#39474d';w.lineWidth=1;
   w.beginPath();w.moveTo(0,H/2);w.lineTo(W,H/2);w.stroke();
   const live=active&&analyser&&audio&&!audio.paused;
   if(live){
    const timeData=new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(timeData);
    w.strokeStyle='#ff7953';w.lineWidth=1.4;w.beginPath();
    for(let x=0;x<W;x++){const n=timeData[Math.min(timeData.length-1,Math.floor(x/W*timeData.length))]/255-.5;const y=H/2-n*(H*.84);x===0?w.moveTo(x,y):w.lineTo(x,y);}
    w.stroke();
    const data=new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    s.clearRect(0,0,spectrum.width,spectrum.height);
    const n=44,bw=spectrum.width/n;
    for(let i=0;i<n;i++){
     const f=Math.floor((Math.exp(i/n*Math.log(data.length+1))-1));
     const a=data[Math.min(data.length-1,f)]/255;
     const h=Math.max(2,Math.pow(a,1.2)*spectrum.height*.91);
     s.fillStyle=i<25?'#ff7953':'#adbabe';
     s.fillRect(i*bw+1,spectrum.height-h,Math.max(1,bw-2),h);
    }
   }else{
    for(let x=0;x<W;x+=3){const v=(Math.sin(x*.08+frame*.051)*Math.sin(x*.012-frame*.013))*(H*.3);w.fillStyle=x<W*.45?'#ff7953':'#9ba8ab';w.fillRect(x,H/2-Math.abs(v),2,2*Math.abs(v)||1);}
    const n=44,bw=spectrum.width/n;s.clearRect(0,0,spectrum.width,spectrum.height);
    for(let i=0;i<n;i++){const f=(Math.sin(i*.51+frame*.052)**2*.7+Math.sin(i*.19)**2*.3);const h=7+f*spectrum.height*.65;s.fillStyle=i<24?'#ff7953':'#9ba8ab';s.fillRect(i*bw+1,spectrum.height-h,Math.max(1,bw-2),h);}
   }
  }
  frame++;
  if(!reduced)requestAnimationFrame(draw);
 }
 draw();
 return Object.freeze({start,stop,reset});
}
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',init);

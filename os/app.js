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
  heading:'Real hardware. No guesses.',description:'This shell does not connect or request USB-MIDI access. For live memory, diagnostics and transfer use My EP; all safety guards remain in the original tool.',
  tiles:[
   {eyebrow:'CONNECT THROUGH ORIGINAL MY EP',title:'KO II Device Manager',copy:'MIDI / SysEx support, firmware-aware capabilities, transfer verification and recovery are all handled by the existing app.',action:'OPEN DEVICE MANAGER ↗',href:'../index.html#my-ep'},
   {eyebrow:'WORKING NOW / MY EP',title:'Storage, Backup / Restore',copy:'Inspect hardware sample memory, create project backups and access the existing guarded recovery workflows.',action:'OPEN DEVICE STORAGE ↗',href:'../index.html#my-ep'},
   {eyebrow:'ROADMAP / ZAT-17',title:'Persistent Global Status',copy:'The OS top bar will later subscribe to authoritative runtime events. Disconnected, connected, working and recovery-needed must never be confused.'}
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
    const btn=tile.href?'<a class="button" href="'+tile.href+'">'+tile.action+'</a>':
      tile.actionName?'<button class="button secondary" type="button" data-action="'+tile.actionName+'">'+tile.action+'</button>':'';
    return '<article class="os-tile"><div class="eyebrow">'+tile.eyebrow+'</div><h3>'+tile.title+'</h3><p>'+tile.copy+'</p>'+btn+'</article>';
  }).join('');
  return '<section class="hero-card"><div class="kicker">SPEEDUPPERCUT / '+safe.toUpperCase()+'</div><h2>'+model.heading+'</h2><p>'+model.description+'</p></section><div class="subbar"><span class="eyebrow">WORKSPACE MODULES</span><span class="pill">EARLY ACCESS · SAFE PREVIEW</span></div><section class="cards">'+tiles+'</section>';
}
function init(){
 const $=id=>document.getElementById(id);
 const state={theme:normalizeTheme(readSavedTheme()),page:normalizeWorkspace(location.hash)};
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
  view.innerHTML=renderPage(state.page);
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
 $('os-theme').addEventListener('click',()=>updateTheme(state.theme==='studio'?'classic':'studio'));
 $('support-info').addEventListener('click',()=>toast('Support and donation links will be added only after the recipient is verified.'));
 window.addEventListener('hashchange',()=>updatePage(location.hash));
 updateTheme(state.theme);updatePage(state.page);
 startDemoMeters();
}
function readSavedTheme(){try{return localStorage.getItem('speeduppercut-os-theme');}catch{return null;}}
function startDemoMeters(){
 const wave=document.getElementById('os-waveform'),spectrum=document.getElementById('os-spectrum');
 if(!wave||!spectrum)return;
 const w=wave.getContext('2d'),s=spectrum.getContext('2d');if(!w||!s)return;
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
 let frame=0;
 function draw(){
  if(document.hidden){if(!reduced)requestAnimationFrame(draw);return;}
  const activeColor='#fa714b',minor='#9ba6ab';
  const wx=wave.width,wy=wave.height;w.clearRect(0,0,wx,wy);w.strokeStyle='#293139';w.beginPath();w.moveTo(0,wy/2);w.lineTo(wx,wy/2);w.stroke();
  for(let i=0;i<wx;i+=3){const n=(Math.sin(i*.082+frame*.054)*Math.sin(i*.014-frame*.012)+Math.sin(i*.21)*.14)*29*(.5+.5*Math.sin(i*.006+1));w.fillStyle=i<wx*.42?activeColor:minor;const v=Math.abs(n);w.fillRect(i,wy/2-v,2,2*v||1);}
  const sx=spectrum.width,sy=spectrum.height;s.clearRect(0,0,sx,sy);
  for(let i=0;i<44;i++){const n=(Math.sin(i*.48+frame*.057)**2*.65+Math.sin(i*.18+2.5)**2*.35),h=9+Math.max(0,n)*sy*.77;s.fillStyle=i<23?activeColor:minor;s.fillRect(i*(sx/44)+2,sy-h,sx/44-3,h);}
  frame++;
  if(!reduced)requestAnimationFrame(draw);
 }
 draw();
}
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',init);

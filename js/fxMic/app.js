import{makeDraggableWindow}from '../ep133/ui/windowShell.js?v=20261001-1';
import{createPackStore,validatePack,writePack,configText,packWithConfig}from './pack.js';
import{defaultConfig,validateConfig,moveEffect,removeEffect}from './config.js';
import{EFFECTS,PLAYMODES,SHAPES,STOCK_PROFILE,newEffect}from './profile.js';
import{inspectWav,prepareWav}from './wav.js';
import{createEmulation,previewCoverage}from './emulation.js';
import{createLocalPacks}from './storage.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const option=(value,label,selected)=>`<option value="${esc(value)}" ${String(selected)===String(value)?'selected':''}>${esc(label)}</option>`;
const number=(label,value,attrs='')=>`<label>${esc(label)}<input aria-label="${esc(label)}" type="number" value="${esc(value)}" ${attrs}></label>`;

export function initFxMicApp({documentRef=document,windowRef=window}={}){
 const doc=documentRef,win=windowRef,icon=doc.getElementById('fx-mic-icon');if(!icon)return;
 const root=doc.createElement('section');root.id='fx-mic-window';root.className='window fx-mic-window';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-label','FX-MIC Studio');doc.body.append(root);
 const store=createPackStore(),local=createLocalPacks(),history=[];
 let selected=0,mode='emulation',opened=false,lifecycle=0,error='',status='Offline · your files stay in this browser',localNames=[],selectedLocal='',route='mic',previewSlot=0;
 let controls={handle:0,shake:0};
 const audio=createEmulation({onEnd:()=>{status='Stopped';updateStatus();}});
 const q=selector=>root.querySelector(selector);
 const currentPreset=()=>{
  const c=store.snapshot().config;return c.presets?.find((p,i)=>(p.pos??i)===selected)||{pos:selected,name:'PRESET '+(selected+1),list:[{effect:'SAMPLE'}]};
 };
 const sampleFor=(p,slot)=>p.config.samples?.find((s,i)=>(s.pos??i)===slot);
 function updateStatus(){if(!opened)return;if(q('[data-fx-error]'))q('[data-fx-error]').textContent=error;if(q('[data-fx-status]'))q('[data-fx-status]').textContent=status;}
 function changed(next,expected=store.revision){
  const before=store.snapshot();store.replace(next,expected);history.push(before);if(history.length>10)history.shift();error='';
  const p=currentPreset();if(previewCoverage(p).playable)audio.update(p);else audio.stop();render();
 }
 function editConfig(edit){const next=store.snapshot();edit(next.config);changed(next);}
 function editPreset(edit){editConfig(c=>{
  c.presets??=[];let i=c.presets.findIndex((p,j)=>(p.pos??j)===selected);
  if(i<0){c.presets.push(currentPreset());i=c.presets.length-1;}
  const replacement=edit(c.presets[i]);if(replacement)c.presets[i]=replacement;
 });}
 async function run(action){const token=lifecycle;try{error='';await action(token);if(token===lifecycle)updateStatus();}catch(e){if(token===lifecycle){error=e.message||String(e);updateStatus();}}}
 const ensureActive=token=>{if(!opened||token!==lifecycle)throw Error('Window closed during operation');};
 function download(blob,name){const url=URL.createObjectURL(blob),a=doc.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function modEditor(kind,p){
  const title=kind[0].toUpperCase()+kind.slice(1),m=p[kind],target=m?.target==='lfo'?'lfo:'+m.param:m?m.row+':'+m.param:'';
  let options=option('','Off',target);
  p.list.forEach((e,row)=>Object.keys(EFFECTS[e.effect]).forEach(param=>{options+=option(row+':'+param,`${row}: ${e.effect} · ${param}`,target);}));
  if(kind==='handle'&&p.lfo)for(const param of ['speed','depth','phase'])options+=option('lfo:'+param,'LFO · '+param,target);
  const range=m?.row!==undefined?EFFECTS[p.list[m.row]?.effect]?.[m.param]:null,base=range?(p.list[m.row][m.param]??range[2]):0,end=base+(m?.depth||0),start=kind==='lfo'?base-(m?.depth||0):base;
  return`<fieldset><legend>${title}</legend><label>Target<select aria-label="${title} target" data-mod-target="${kind}">${options}</select></label>${m?number(title+' depth',m.depth??0,`step="0.01" data-mod="${kind}" data-key="depth"`):''}${range?`<div class="fx-range">${Math.min(start,end).toFixed(2)} → ${Math.max(start,end).toFixed(2)}<meter min="${range[0]}" max="${range[1]}" value="${Math.max(range[0],Math.min(range[1],end))}"></meter></div>`:''}${kind==='lfo'&&m?`<label>Shape<select aria-label="LFO shape" data-mod="lfo" data-key="shape">${SHAPES.map(s=>option(s,s,m.shape??'sine')).join('')}</select></label>${number('LFO speed',m.speed??1,'min="0" step="0.1" data-mod="lfo" data-key="speed"')}${number('LFO phase',m.phase??0,'step="0.1" data-mod="lfo" data-key="phase"')}`:''}</fieldset>`;
 }
 function render(){
  if(!opened)return;
  const pack=store.snapshot(),p=currentPreset(),stats=validatePack(pack),validation=validateConfig(pack.config),coverage=previewCoverage(p);
  const position={left:root.style.left,top:root.style.top,transform:root.style.transform};
  root.innerHTML=`<div class="title-bar"><span>FX-MIC STUDIO · EP-2350</span><button type="button" aria-label="Close FX-MIC Studio" data-action="close">×</button></div>
   <div class="fx-body"><nav class="fx-toolbar" aria-label="FX-MIC modes"><button data-action="emulation" aria-pressed="${mode==='emulation'}">Emulation</button><button data-action="live" aria-pressed="${mode==='live'}">Live</button><button data-action="undo" ${history.length?'':'disabled'}>Undo edit</button><span data-fx-status role="status">${esc(status)}</span></nav>
   <p data-fx-error role="alert">${esc(error)}</p>
   <section data-fx-live ${mode==='live'?'':'hidden'}><h2>LIVE · physical EP-2350</h2><p>No exact-firmware hardware acceptance is registered. Connection and writes are unavailable until the approved USB scenario establishes safe identity, readback and session exit.</p><button disabled>Connect EP-2350</button><p>Listen to the physical analog output through an audio interface. Browser Emulation is not that signal.</p></section>
   <div ${mode==='emulation'?'':'hidden'} data-fx-offline>
   <div class="fx-toolbar"><label>Pack name<input aria-label="Pack name" data-pack-name maxlength="128" value="${esc(pack.config.name||'')}"></label><label>Import ZIP / config.json<input aria-label="Import ZIP or config" data-import type="file" accept=".zip,.json"></label><button data-action="export">Export ZIP</button><button data-action="json">Export config</button></div>
   <p class="fx-budget">${esc(STOCK_PROFILE.label)}<br><strong>${stats.bytes.toLocaleString()} bytes</strong> WAV + config · ${(STOCK_PROFILE.budgetBytes-stats.bytes).toLocaleString()} bytes budget remaining${stats.nearLimit?' · Near authoring limit':''}. ZIP compression does not increase device capacity.</p>
   <div class="fx-toolbar"><button data-action="save">Save local pack</button><select aria-label="Local packs" data-local>${option('','Choose saved pack',selectedLocal)}${localNames.map(n=>option(n,n,selectedLocal)).join('')}</select><button data-action="load" ${selectedLocal?'':'disabled'}>Load local pack</button></div>
   <h2>Sample Pack Builder</h2><div class="fx-samples">${Array.from({length:4},(_,slot)=>{
    const s=sampleFor(pack,slot),bytes=s&&pack.files.get(s.file),info=bytes&&inspectWav(bytes);
    return`<fieldset data-fx-slot="${slot}"><legend>WAV ${slot+1}</legend><label>Choose WAV<input aria-label="WAV slot ${slot+1}" data-sample="${slot}" type="file" accept=".wav"></label><p>${info?`${esc(s.file)} · ${info.duration.toFixed(3)} s<br>${info.sampleRate} Hz · ${info.channels} ch · ${info.bits}-bit · ${info.bytes} bytes`:'Factory sample · audio not bundled'}</p>${info?`<label>Playmode<select aria-label="Playmode ${slot+1}" data-playmode="${slot}">${PLAYMODES.map(v=>option(v,v,s.playmode??'oneshot')).join('')}</select></label><div class="fx-crop">${number('Crop start '+(slot+1),0,'min="0" step="0.001" data-start')}${number('Crop end '+(slot+1),info.duration.toFixed(6),'min="0" step="0.001" data-end')}</div><label>Output Hz<select aria-label="Output rate ${slot+1}" data-rate>${[22050,32000,44100,48000,96000].map(v=>option(v,v,22050)).join('')}</select></label><label>Channels<select aria-label="Output channels ${slot+1}" data-channels>${option(1,'Mono',info.channels)}${option(2,'Stereo',info.channels)}</select></label><button data-prepare="${slot}" aria-label="Prepare slot ${slot+1}">Crop / prepare s16</button><button data-play-slot="${slot}" aria-label="Play slot ${slot+1}">Preview WAV</button><button data-download="${slot}">Download WAV</button>`:''}</fieldset>`;
   }).join('')}</div>
   <div class="fx-toolbar"><h2>FX Chain Editor</h2><select aria-label="FX preset" data-preset>${Array.from({length:4},(_,i)=>option(i,'Preset '+(i+1),selected)).join('')}</select><label>Preset name<input aria-label="Preset name" data-preset-name value="${esc(p.name||'')}"></label><select aria-label="Add effect type" data-new-effect>${Object.keys(EFFECTS).map(v=>option(v,v,'LOWPASS')).join('')}</select><button data-action="add">Add effect</button></div>
   <ol class="fx-chain">${p.list.map((e,row)=>`<li><div class="fx-toolbar"><strong>${row} · ${e.effect}</strong><button data-up="${row}" aria-label="Move row ${row} up" ${row?'':'disabled'}>↑</button><button data-down="${row}" aria-label="Move row ${row} down" ${row<p.list.length-1?'':'disabled'}>↓</button><button data-remove="${row}" ${p.list.length>1?'':'disabled'}>Remove</button><label>Routing<select aria-label="Routing row ${row}" data-bus="${row}">${option('','Main',e.BUS??'')}${option(1,'BUS 1',e.BUS)}${option(2,'BUS 2',e.BUS)}</select></label></div><div class="fx-parameters">${Object.entries(EFFECTS[e.effect]).map(([key,[min,max,initial]])=>`<label>${key}<input type="range" aria-label="Row ${row} ${key}" min="${min}" max="${max}" step="${max-min>100?1:.01}" value="${e[key]??initial}" data-param="${esc(key)}" data-row="${row}"><output>${e[key]??initial}</output></label>`).join('')}</div></li>`).join('')}</ol>
   <h2>Modulation Designer</h2><div class="fx-mods">${['handle','shake','lfo'].map(k=>modEditor(k,p)).join('')}<fieldset><legend>Trigger</legend><label>SAMPLE row<select aria-label="Trigger row" data-trigger>${option('','None',p.trigger?.row??'')}${p.list.flatMap((e,i)=>e.effect==='SAMPLE'?[option(i,i,p.trigger?.row)]:[]).join('')}</select></label><p>Other trigger targets are outside this stock-guide profile.</p></fieldset></div>
   <h2>EMULATION · approximate browser audio</h2><p data-fx-preview-note>${coverage.notes.map(esc).join(' ')}</p><p>Filters, balance, DIST, RING, delay and reverb controls use browser approximations. Reverb time/spring change the approximation, not a hardware model. Handle and shake are continuous 0–1 preview inputs.</p>
   <div class="fx-toolbar"><select aria-label="Preview WAV slot" data-preview-slot>${Array.from({length:4},(_,i)=>option(i,'WAV '+(i+1),previewSlot)).join('')}</select><select aria-label="Preview route" data-route>${option('mic','Mic route (WAV as voice)',route)}${option('sample','Sample route',route)}</select><button data-action="audition" ${coverage.playable&&sampleFor(pack,previewSlot)?'':'disabled'}>Audition sample through FX</button><button data-action="stop">Stop audio</button><label>Handle<input aria-label="Handle preview" type="range" min="0" max="1" step="0.01" value="${controls.handle}" data-control="handle"></label><label>Shake<input aria-label="Shake preview" type="range" min="0" max="1" step="0.01" value="${controls.shake}" data-control="shake"></label></div>
   ${validation.warnings.length?`<details><summary>Profile limitations (${validation.warnings.length})</summary><ul>${validation.warnings.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></details>`:''}
   <details><summary>config.json</summary><textarea aria-label="Config JSON" data-config spellcheck="false">${esc(configText(pack.config))}</textarea><button data-action="apply-json">Apply config</button></details></div></div>`;
  Object.assign(root.style,position);makeDraggableWindow(root,{windowRef:win});
 }
 async function open(){if(opened){root.focus();return;}opened=true;lifecycle++;root.hidden=false;render();await run(async token=>{localNames=await local.list();ensureActive(token);render();});}
 function close(){opened=false;lifecycle++;audio.stop();root.hidden=true;mode='emulation';status='Stopped · offline work retained';}
 root.addEventListener('click',event=>{const b=event.target.closest('button');if(!b||b.disabled)return;void run(async token=>{
  const action=b.dataset.action;
  if(action==='close'){close();return;}
  if(action==='emulation'||action==='live'){audio.stop();mode=action;status=action==='live'?'Live unavailable · HIL required':'Offline';render();return;}
  if(action==='stop'){audio.stop();status='Stopped';return;}
  if(action==='undo'){audio.stop();if(history.length)store.replace(history.pop());render();return;}
  if(action==='export'){const blob=await writePack(store.snapshot());ensureActive(token);download(blob,'fx-mic-pack.zip');status='Exported ZIP';return;}
  if(action==='json'){download(new Blob([configText(store.snapshot().config)],{type:'application/json'}),'config.json');return;}
  if(action==='save'){
   const pack=store.snapshot(),name=pack.config.name||'MY FX-MIC PACK';
   try{await local.save(name,pack);}
   catch(error){
    if(error.name!=='ConstraintError')throw error;
    ensureActive(token);
    if(!win.confirm('Replace the locally saved pack "'+name+'"?')){status='Local save cancelled';return;}
    await local.save(name,pack,{overwrite:true});
   }
   localNames=await local.list();ensureActive(token);selectedLocal=name;status='Saved locally: '+name;render();return;
  }
  if(action==='load'){const rev=store.revision,p=await local.load(selectedLocal);ensureActive(token);audio.stop();changed(p,rev);status='Loaded local pack';return;}
  if(action==='add'){const type=q('[data-new-effect]').value;audio.stop();editPreset(p=>{p.list.push(newEffect(type));});return;}
  if(action==='apply-json'){const next=packWithConfig(store.snapshot(),JSON.parse(q('[data-config]').value));validatePack(next);audio.stop();changed(next);return;}
  if(action==='audition'){
   const p=store.snapshot(),s=sampleFor(p,previewSlot);if(!s)throw Error('Choose a custom WAV for browser audition');
   if(await audio.play(p.files.get(s.file),currentPreset(),{route})){ensureActive(token);status='Playing · approximate Emulation';}return;
  }
  for(const key of ['up','down','remove'])if(b.dataset[key]!==undefined){const row=Number(b.dataset[key]);audio.stop();editPreset(p=>key==='remove'?removeEffect(p,row):moveEffect(p,row,row+(key==='up'?-1:1)));return;}
  for(const key of ['prepare','playSlot','download'])if(b.dataset[key]!==undefined){
   const slot=Number(b.dataset[key]),p=store.snapshot(),s=sampleFor(p,slot);if(!s)return;const bytes=p.files.get(s.file);
   if(key==='download'){download(new Blob([bytes],{type:'audio/wav'}),s.file);return;}
   if(key==='playSlot'){if(await audio.play(bytes,{list:[{effect:'SAMPLE'}]},{route:'sample',loop:false})){ensureActive(token);status='Playing WAV';}return;}
   if(p.config.samples.filter(x=>x.file===s.file).length>1)throw Error('WAV is shared by multiple slots; give this slot a separate file before preparing it');
   const el=b.closest('[data-fx-slot]'),rev=store.revision,start=Number(el.querySelector('[data-start]').value),end=Number(el.querySelector('[data-end]').value),info=inspectWav(bytes);
   if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>info.duration+.000001)throw Error('Crop must be a non-empty range inside the WAV');
   const prepared=await prepareWav(bytes,{start,end:Math.min(end,info.duration),sampleRate:Number(el.querySelector('[data-rate]').value),channels:Number(el.querySelector('[data-channels]').value)});
   ensureActive(token);p.files.set(s.file,prepared);audio.stop();changed(p,rev);status='Prepared s16 WAV · speed unchanged';return;
  }
 });});
 root.addEventListener('input',event=>{
  const el=event.target;if(el.dataset.control){controls[el.dataset.control]=Number(el.value);audio.setControls(controls);}
  if(el.dataset.param){el.nextElementSibling.textContent=el.value;const p=currentPreset();p.list[Number(el.dataset.row)][el.dataset.param]=Number(el.value);audio.update(p);}
 });
 root.addEventListener('change',event=>{const el=event.target;void run(async token=>{
  if(el.matches('[data-pack-name]')){editConfig(c=>{c.name=el.value;});return;}
  if(el.matches('[data-preset-name]')){editPreset(p=>{p.name=el.value;});return;}
  if(el.matches('[data-preset]')){audio.stop();selected=Number(el.value);render();return;}
  if(el.matches('[data-local]')){selectedLocal=el.value;render();return;}
  if(el.matches('[data-preview-slot]')){audio.stop();previewSlot=Number(el.value);render();return;}
  if(el.matches('[data-route]')){audio.stop();route=el.value;return;}
  if(el.matches('[data-import]')){
   const file=el.files[0];if(!file)return;const rev=store.revision;
   if(file.size>1100000)throw Error('Import exceeds pack size limit');
   if(/\.json$/i.test(file.name)){const config=JSON.parse(await file.text());ensureActive(token);const next=packWithConfig(store.snapshot(),config);validatePack(next);audio.stop();changed(next,rev);}
   else{const before=store.snapshot(),bytes=await file.arrayBuffer();ensureActive(token);if(store.revision!==rev)throw Error('Working pack changed during import');await store.importZip(bytes,()=>opened&&token===lifecycle);history.push(before);if(history.length>10)history.shift();audio.stop();render();}
   error='';status='Imported and validated';return;
  }
  if(el.dataset.sample!==undefined){
   const file=el.files[0];if(!file)return;if(file.size>1000000)throw Error('WAV exceeds pack budget');
   const rev=store.revision,slot=Number(el.dataset.sample),bytes=new Uint8Array(await file.arrayBuffer());inspectWav(bytes);ensureActive(token);
   const p=store.snapshot();p.config.samples??=[];let s=sampleFor(p,slot);
   if(!s){s={pos:slot,file:`${slot+1}.wav`,playmode:'oneshot'};if(p.config.samples.some(x=>x.file===s.file))throw Error('Numbered filename is already assigned to another slot; rename it in config first');p.config.samples.push(s);}
   if(p.config.samples.filter(x=>x.file===s.file).length>1)throw Error('WAV is shared by multiple slots; give this slot a separate file first');
   p.files.set(s.file,bytes);audio.stop();changed(p,rev);return;
  }
  if(el.dataset.playmode!==undefined){editConfig(c=>{sampleFor({config:c},Number(el.dataset.playmode)).playmode=el.value;});return;}
  if(el.dataset.param){editPreset(p=>{p.list[Number(el.dataset.row)][el.dataset.param]=Number(el.value);});return;}
  if(el.dataset.bus!==undefined){audio.stop();editPreset(p=>{const e=p.list[Number(el.dataset.bus)];if(el.value)e.BUS=Number(el.value);else delete e.BUS;});return;}
  if(el.dataset.modTarget){editPreset(p=>{
   const k=el.dataset.modTarget;if(!el.value){delete p[k];if(k==='lfo'&&p.handle?.target==='lfo')delete p.handle;return;}
   const [row,param]=el.value.split(':');p[k]={...(row==='lfo'?{target:'lfo'}:{row:Number(row)}),param,depth:.1,...(k==='lfo'?{shape:'sine',speed:1,phase:0}:{})};
  });return;}
  if(el.dataset.mod){editPreset(p=>{p[el.dataset.mod][el.dataset.key]=el.dataset.key==='shape'?el.value:Number(el.value);});return;}
  if(el.matches('[data-trigger]')){editPreset(p=>{if(el.value==='')delete p.trigger;else p.trigger={row:Number(el.value)};});}
 });});
 icon.addEventListener('click',()=>void open());icon.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();void open();}});
 win.addEventListener('pagehide',close);return{open,close};
}
if(typeof document!=='undefined')initFxMicApp();

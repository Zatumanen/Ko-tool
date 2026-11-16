import{createHardwareTrial}from './hardwareTrial.js';
import{makeDraggableWindow}from '../ep133/ui/windowShell.js?v=20261001-1';
import{createPackStore,validatePack,writePack,configText,packWithConfig}from './pack.js';
import{defaultConfig,validateConfig,moveEffect,removeEffect}from './config.js';
import{EFFECTS,PLAYMODES,SHAPES,STOCK_PROFILE,newEffect}from './profile.js';
import{inspectWav,prepareWav}from './wav.js';
import{createEmulation,previewCoverage}from './emulation.js';
import{createLocalPacks}from './storage.js';
import{createOfflineDraftFromSavedConfig}from './studioDraft.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const option=(value,label,selected)=>`<option value="${esc(value)}" ${String(selected)===String(value)?'selected':''}>${esc(label)}</option>`;
const number=(label,value,attrs='')=>`<label>${esc(label)}<input aria-label="${esc(label)}" type="number" value="${esc(value)}" ${attrs}></label>`;

export function initFxMicApp({documentRef=document,windowRef=window}={}){
 const doc=documentRef,win=windowRef,icon=doc.getElementById('fx-mic-icon');if(!icon)return;
 const root=doc.createElement('section');root.id='fx-mic-window';root.className='window fx-mic-window';root.hidden=true;root.tabIndex=-1;root.setAttribute('role','dialog');root.setAttribute('aria-label','FX-MIC Studio');doc.body.append(root);
 const store=createPackStore(),local=createLocalPacks(),history=[];
 let selected=0,workspace='presets',mode='emulation',opened=false,lifecycle=0,error='',status='Offline · your files stay in this browser',localNames=[],selectedLocal='',route='mic',previewSlot=0;
 let draggedRow=-1,controls={handle:0,shake:0},liveFirmware='',liveConfirmed=false,liveReplConsent=false,inspectSlot=0;
 const trial=createHardwareTrial({onChange:renderLive});
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

 function deviceConfigPanel(current){
  const selected=current.presets[inspectSlot];
  const mod=selected?.modulationValues||{};
  return `<div data-fx-device-config>
    <p>Read only: saved /fat/config.json, not the running DSP chain. No device parameters or files were changed.</p>
    <p>Pack: ${esc(current.packName||'(unnamed)')} · ${current.presets.filter(p=>p.present).length} saved FX presets · ${current.sampleCount} sample references</p>
    <ul>${current.presets.map(p=>`<li>Slot ${p.slot+1}: ${esc(p.present?(p.name||'(unnamed)'):'(empty)')} · ${p.rowCount} rows · ${esc(p.effects.join(', ')||'no effects')}${p.modulation.length?' · '+esc(p.modulation.join(', ')):''}</li>`).join('')}</ul>
    <label>Saved FX preset to inspect<select aria-label="Saved FX preset to inspect" data-fx-inspect-slot>${current.presets.map(p=>option(p.slot,'Slot '+(p.slot+1)+(p.name?' · '+p.name:''),inspectSlot)).join('')}</select></label>
    <ul data-fx-saved-rows>${selected?.rows.map((fx,row)=>`<li>Row ${row}: ${esc(fx.effect)} ${Object.entries(fx).filter(([k])=>k!=='effect').map(([k,v])=>esc(k)+': '+esc(v)).join(' · ')}</li>`).join('')||'<li>No saved effects in this slot</li>'}</ul>
    <ul data-fx-modulation>${Object.entries(mod).map(([key,value])=>`<li>${esc(key)}: ${Object.entries(value).map(([k,v])=>esc(k)+': '+esc(v)).join(' · ')||'no supported values'}</li>`).join('')||'<li>No saved modulation</li>'}</ul>
    <ul data-fx-samples>${(current.samples||[]).map(item=>`<li>WAV ${item.slot+1}: ${esc(item.file||'(unnamed)')} ${esc(item.playmode||'')}</li>`).join('')||'<li>No custom WAV references</li>'}</ul>
    ${current.unknownFields?'<p>'+current.unknownFields+' unfamiliar fields were excluded from this read-only summary; nothing was written.</p>':''}
   </div>`;
 }
 function livePanel(){
  const {state,identity,current,phase,original,target,restorePending,busy,hasSession}=trial.snapshot();
  const canConnect=Boolean(win.navigator?.serial?.requestPort&&liveFirmware&&!restorePending&&!busy&&!hasSession&&state==='disconnected'&&phase==='idle');
  const active=Boolean(current&&['ready','verified'].includes(state));
  const canApply=active&&phase==='read'&&original!==null&&liveConfirmed&&!busy;
  const canRestore=active&&phase==='changed'&&!busy;
  return `<h2>LIVE · EP-2350 hardware trial</h2>
   <p>Without Ctrl+C consent, connection waits for a passively observed clean REPL prompt and sends no bytes if one is not received. Ctrl+C preparation interrupts the running program and may stop audio until reboot; it never writes device files.
   Listen to the physical analog output through an audio interface.</p>
   <div class="fx-toolbar">
    <label>Stock firmware<select aria-label="Stock firmware" data-live-firmware ${active||busy||restorePending?'disabled':''}>
     ${option('','Select exact version',liveFirmware)}${option('1.0.8','1.0.8 · cutoff trial',liveFirmware)}${option('1.1.2','1.1.2 · read only',liveFirmware)}
    </select></label>
    <button data-action="live-connect" ${canConnect?'':'disabled'}>Connect EP-2350</button>
    <button data-action="live-disconnect" ${hasSession?'':'disabled'}>Disconnect</button>
   </div>
   <label><input type="checkbox" data-live-repl-consent ${liveReplConsent?'checked':''} ${busy||hasSession?'disabled':''}> Prepare REPL with Ctrl+C (interrupts the running program; no automatic reset)</label>
   <p data-live-state role="status">${esc(state)}${identity?' · '+esc(identity.model)+' · '+esc(identity.firmware)+(identity.firmwareVerified?' · firmware verified':' · version selected, not verified'):''}${current?' · '+(current.source==='stored-config'?(current.slot<0?'no active FX slot':'stored config · selected slot '+(current.slot+1)):'preset '+(current.slot+1)):''}</p>
   ${current?.source==='stored-config'?deviceConfigPanel(current):''}
   ${active&&current?.source==='stored-config'?'<div class="fx-live-offline"><p>Make a local editable draft of these saved presets. This disconnects Web Serial and never writes to your mic. Custom device WAVs cannot be copied through this read-only link.</p><button type="button" data-action="device-export">Download saved config.json</button> <button type="button" data-action="device-to-draft">Open as offline draft</button></div>':''}
   ${!win.navigator?.serial?.requestPort?'<p>Web Serial is unavailable. Use Chrome on a desktop and open the site directly.</p>':''}
   ${current?.source!=='stored-config'&&current?`<ul>${current.list.map(({effect,...params})=>`<li>${esc(effect)} ${Object.entries(params).map(([name,value])=>esc(name)+': '+esc(value)).join(' · ')}</li>`).join('')}</ul>`:''}
   ${active&&original===null?'<p>Read only. The write trial requires stock 1.0.8 and a preset containing one unmodulated LOWPASS effect.</p>':''}
   ${original!==null?`<p>LOWPASS cutoff: original <strong>${esc(original)}</strong> · test value <strong>${esc(target)}</strong></p>`:''}
   ${active&&phase==='read'&&original!==null?`<label><input type="checkbox" data-live-confirm ${liveConfirmed?'checked':''}> I backed up the mic and selected an expendable preset.</label>
    <button data-action="live-apply" ${canApply?'':'disabled'}>Apply one test change</button>`:''}
   ${phase==='changed'?'<p>Readback matched. Check the mic’s analog output, then restore the original cutoff.</p>':''}
   ${canRestore?'<button data-action="live-restore">Restore original cutoff</button>':''}
   ${phase==='restored'?'<p>Readback matched the original cutoff. Disconnect and check the mic’s buttons and audio.</p>':''}
   ${restorePending&&!canRestore&&!busy?`<p>State uncertain. Disconnect, check the preset on the mic and restore the original cutoff <strong>${esc(original)}</strong> manually.</p>
    <button data-action="live-recovered" ${!hasSession?'':'disabled'}>Confirm manual recovery</button>`:''}`;
 }
 function renderLive(){
  const section=q('[data-fx-live]');
  if(opened&&mode==='live'&&section)section.innerHTML=livePanel();
 }
 function render(){
  if(!opened)return;
  const pack=store.snapshot(),p=currentPreset(),stats=validatePack(pack),validation=validateConfig(pack.config),coverage=previewCoverage(p);
  const position={left:root.style.left,top:root.style.top,transform:root.style.transform};
  root.innerHTML=`<div class="title-bar"><span>FX-MIC STUDIO · EP-2350</span><button type="button" aria-label="Close FX-MIC Studio" data-action="close">×</button></div>
   <div class="fx-body"><nav class="fx-toolbar fx-primary-nav" aria-label="FX-MIC modes"><button data-action="emulation" aria-pressed="${mode==='emulation'}">Emulation</button><button data-action="live" aria-pressed="${mode==='live'}">Live</button><button data-action="undo" ${history.length?'':'disabled'}>Undo edit</button><span data-fx-status role="status">${esc(status)}</span></nav>
   <p data-fx-error role="alert">${esc(error)}</p>
   <section data-fx-live ${mode==='live'?'':'hidden'}>${mode==='live'?livePanel():''}</section>
   <div ${mode==='emulation'?'':'hidden'} data-fx-offline>
   <nav class="fx-workspace-tabs" aria-label="FX-MIC workspace">
    ${[['presets','Presets'],['samples','Samples'],['preview','Audition'],['all','All sections']].map(([key,label])=>`<button type="button" data-workspace="${key}" aria-pressed="${workspace===key}">${esc(label)}</button>`).join('')}
   </nav>
   <div class="fx-toolbar fx-pack-toolbar"><label>Pack name<input aria-label="Pack name" data-pack-name maxlength="128" value="${esc(pack.config.name||'')}"></label><label>Import ZIP / config.json<input aria-label="Import ZIP or config" data-import type="file" accept=".zip,.json"></label><button data-action="export">Export ZIP</button><button data-action="json">Export config</button></div>
   <p class="fx-budget">${esc(STOCK_PROFILE.label)}<br><strong>${stats.bytes.toLocaleString()} bytes</strong> WAV + config · ${(STOCK_PROFILE.budgetBytes-stats.bytes).toLocaleString()} bytes budget remaining${stats.nearLimit?' · Near authoring limit':''}. ZIP compression does not increase device capacity.</p>
   <details class="fx-install-guide"><summary>Install a finished pack on the physical FX-MIC</summary><ol>
    <li>Back up the original device config.json and custom WAV files first.</li>
    <li>Export ZIP, then unpack it. Check the effect routing and WAV names before copying.</li>
    <li>Power the EP-2350 on and connect USB-C. Open its FX-MIC storage disk on your computer.</li>
    <li>Copy the validated config.json and its custom WAV files into the disk root using your computer's file manager. Eject the disk properly so the mic reloads.</li>
    <li>This is a <strong>manual device file write</strong>, outside K.O. TOOL's Live read-only connection. Do not overwrite your real presets without a backup. The FX-MIC's exact firmware/audio result is not yet validated here.</li>
   </ol><p><a href="https://teenage.engineering/guides/ep-2350" target="_blank" rel="noopener noreferrer">Official EP-2350 guide</a></p></details>
   <div class="fx-toolbar"><button data-action="save">Save local pack</button><select aria-label="Local packs" data-local>${option('','Choose saved pack',selectedLocal)}${localNames.map(n=>option(n,n,selectedLocal)).join('')}</select><button data-action="load" ${selectedLocal?'':'disabled'}>Load local pack</button></div>
   <section class="fx-section" data-fx-pane="samples" ${workspace==='samples'||workspace==='all'?'':'hidden'}>
   <div class="fx-section-heading"><h2>Samples</h2><p>Four WAV slots · locally loaded audio or built-in sounds.</p></div>
   <div class="fx-samples">${Array.from({length:4},(_,slot)=>{
    const s=sampleFor(pack,slot),bytes=s&&pack.files.get(s.file),info=bytes&&inspectWav(bytes);
    return`<fieldset data-fx-slot="${slot}"><legend>WAV ${slot+1}</legend><label>Choose WAV<input aria-label="WAV slot ${slot+1}" data-sample="${slot}" type="file" accept=".wav"></label><p>${info?`${esc(s.file)} · ${info.duration.toFixed(3)} s<br>${info.sampleRate} Hz · ${info.channels} ch · ${info.bits}-bit · ${info.bytes} bytes`:'Factory sample · audio not bundled'}</p>${info?`<label>Playmode<select aria-label="Playmode ${slot+1}" data-playmode="${slot}">${PLAYMODES.map(v=>option(v,v,s.playmode??'oneshot')).join('')}</select></label><div class="fx-crop">${number('Crop start '+(slot+1),0,'min="0" step="0.001" data-start')}${number('Crop end '+(slot+1),info.duration.toFixed(6),'min="0" step="0.001" data-end')}</div><label>Output Hz<select aria-label="Output rate ${slot+1}" data-rate>${[22050,32000,44100,48000,96000].map(v=>option(v,v,22050)).join('')}</select></label><label>Channels<select aria-label="Output channels ${slot+1}" data-channels>${option(1,'Mono',info.channels)}${option(2,'Stereo',info.channels)}</select></label><button data-prepare="${slot}" aria-label="Prepare slot ${slot+1}">Crop / prepare s16</button><button data-play-slot="${slot}" aria-label="Play slot ${slot+1}">Preview WAV</button><button data-download="${slot}">Download WAV</button><button data-factory-sample="${slot}" aria-label="Use factory sample in slot ${slot+1}">Use factory sound</button>`:''}</fieldset>`;
   }).join('')}</div></section>
   <section class="fx-section" data-fx-pane="presets" ${workspace==='presets'||workspace==='all'?'':'hidden'}>
   <div class="fx-section-heading"><h2>Preset editor</h2><p>Build a chain, then assign Handle, Shake, LFO and the sample trigger.</p></div>
   <div class="fx-preset-cards" role="group" aria-label="Choose an FX preset">
    ${Array.from({length:4},(_,i)=>{const slot=pack.config.presets?.find((item,index)=>(item.pos??index)===i);return `<button type="button" data-select-preset="${i}" aria-pressed="${selected===i}" aria-label="Edit FX preset ${i+1}"><span class="fx-preset-index">0${i+1}</span><strong>${esc(slot?.name||'Empty preset')}</strong><small>${slot?.list?.length??0} FX rows</small></button>`;}).join('')}
   </div>
   <div class="fx-toolbar"><h2>FX Chain Editor</h2><select aria-label="FX preset" data-preset>${Array.from({length:4},(_,i)=>option(i,'Preset '+(i+1),selected)).join('')}</select><label>Preset name<input aria-label="Preset name" data-preset-name maxlength="128" value="${esc(p.name||'')}"></label><label class="fx-preset-note">Preset notes<textarea aria-label="Preset notes" data-preset-comment maxlength="2048" rows="2" placeholder="Describe this sound">${esc(p.comment||'')}</textarea></label><select aria-label="Add effect type" data-new-effect>${Object.keys(EFFECTS).map(v=>option(v,v,'LOWPASS')).join('')}</select><button data-action="add">Add effect</button></div>
   <div class="fx-toolbar fx-preset-actions"><label>Copy to<select aria-label="Copy preset destination" data-copy-destination>${Array.from({length:4},(_,i)=>i!==selected?option(i,'Preset '+(i+1),selected===3?0:selected+1):'').join('')}</select></label><button data-action="duplicate-preset">Copy selected preset</button><button data-action="reset-preset">Reset selected preset</button></div>
   <ol class="fx-chain">${p.list.map((e,row)=>`<li data-fx-row="${row}"><div class="fx-toolbar"><span class="fx-drag-handle" data-fx-drag-handle="${row}" draggable="true" role="img" aria-label="Drag effect row ${row}" title="Drag to reorder effects, or use arrow buttons">⋮⋮</span><strong>${row} · ${e.effect}</strong><button data-up="${row}" aria-label="Move row ${row} up" ${row?'':'disabled'}>↑</button><button data-down="${row}" aria-label="Move row ${row} down" ${row<p.list.length-1?'':'disabled'}>↓</button><button data-remove="${row}" ${p.list.length>1?'':'disabled'}>Remove</button><label>Routing<select aria-label="Routing row ${row}" data-bus="${row}">${option('','Main',e.BUS??'')}${option(1,'BUS 1',e.BUS)}${option(2,'BUS 2',e.BUS)}</select></label></div><div class="fx-parameters">${Object.entries(EFFECTS[e.effect]).map(([key,[min,max,initial]])=>`<label>${key}<span class="fx-param-control"><input type="range" aria-label="Row ${row} ${key}" min="${min}" max="${max}" step="${max-min>100?1:.01}" value="${e[key]??initial}" data-param="${esc(key)}" data-row="${row}"><input type="number" aria-label="Precise ${key} value for effect ${row}" min="${min}" max="${max}" step="any" value="${e[key]??initial}" data-number-param="${esc(key)}" data-row="${row}"><output>${e[key]??initial}</output></span></label>`).join('')}</div></li>`).join('')}</ol>
   <h2>Modulation Designer</h2><div class="fx-mods">${['handle','shake','lfo'].map(k=>modEditor(k,p)).join('')}<fieldset><legend>Trigger</legend><label>SAMPLE row<select aria-label="Trigger row" data-trigger>${option('','None',p.trigger?.row??'')}${p.list.flatMap((e,i)=>e.effect==='SAMPLE'?[option(i,i,p.trigger?.row)]:[]).join('')}</select></label><p>Other trigger targets are outside this stock-guide profile.</p></fieldset></div></section>
   <section class="fx-section" data-fx-pane="preview" ${workspace==='preview'||workspace==='all'?'':'hidden'}>
   <div class="fx-section-heading"><h2>EMULATION · approximate browser audio</h2></div><p data-fx-preview-note>${coverage.notes.map(esc).join(' ')}</p><p>Filters, balance, DIST, RING, delay and reverb use browser approximations, not the real EP-2350 DSP. Handle and shake are continuous 0–1 preview inputs. Browser microphone monitoring requests permission only when you click Monitor. Use headphones and reduce output volume to avoid feedback; Web Serial does not carry audio.</p>
   <div class="fx-toolbar"><select aria-label="Preview WAV slot" data-preview-slot>${Array.from({length:4},(_,i)=>option(i,'WAV '+(i+1),previewSlot)).join('')}</select><select aria-label="Preview route" data-route>${option('mic','Mic route (WAV as voice)',route)}${option('sample','Sample route',route)}</select><button data-action="audition" ${coverage.playable&&sampleFor(pack,previewSlot)?'':'disabled'}>Audition sample through FX</button><button data-action="monitor-mic" ${coverage.playable&&win.navigator?.mediaDevices?.getUserMedia?'':'disabled'}>Monitor browser microphone</button><button data-action="stop">Stop audio</button><label>Handle<input aria-label="Handle preview" type="range" min="0" max="1" step="0.01" value="${controls.handle}" data-control="handle"></label><label>Shake<input aria-label="Shake preview" type="range" min="0" max="1" step="0.01" value="${controls.shake}" data-control="shake"></label></div><p class="fx-shortcuts">Shortcuts in this panel: Space = play/stop WAV · H = handle on/off · hold S = shake. Arrow buttons or the drag handle reorder effects.</p></section>
   ${validation.warnings.length?`<details><summary>Profile limitations (${validation.warnings.length})</summary><ul>${validation.warnings.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></details>`:''}
   <details><summary>config.json</summary><textarea aria-label="Config JSON" data-config spellcheck="false">${esc(configText(pack.config))}</textarea><button data-action="apply-json">Apply config</button></details></div></div>`;
  Object.assign(root.style,position);makeDraggableWindow(root,{windowRef:win});
 }
 async function open(){if(opened){root.focus();return;}opened=true;lifecycle++;root.hidden=false;render();root.focus();await run(async token=>{localNames=await local.list();ensureActive(token);render();});}
 function close(){opened=false;lifecycle++;draggedRow=-1;audio.stop();void trial.disconnect();liveConfirmed=false;liveReplConsent=false;root.hidden=true;mode='emulation';status='Stopped · offline work retained';}
 root.addEventListener('click',event=>{const b=event.target.closest('button');if(!b||b.disabled)return;void run(async token=>{
  const action=b.dataset.action;
  if(action==='close'){close();return;}
  if(b.dataset.workspace){workspace=b.dataset.workspace;render();return;}
  if(b.dataset.selectPreset!==undefined){audio.stop();selected=Number(b.dataset.selectPreset);render();return;}
  if(action==='emulation'||action==='live'){
   if(mode==='live'&&action==='emulation'){await trial.disconnect();ensureActive(token);liveConfirmed=false;}
   liveReplConsent=false;audio.stop();mode=action;status=action==='live'?'Hardware trial · not yet accepted':'Offline';render();return;
  }
  if(['live-connect','live-disconnect','live-apply','live-restore','live-recovered'].includes(action)){
   if(action==='live-connect'||action==='live-disconnect')liveConfirmed=false;
   const consent=liveReplConsent; // Single-use explicit authorization, never sticky.
   if(action==='live-connect'||action==='live-disconnect')liveReplConsent=false;
   try{
    const operation=action==='live-connect'?trial.connect(liveFirmware,{allowReplInterrupt:consent})
      :action==='live-disconnect'?trial.disconnect()
      :action==='live-apply'?trial.apply(liveConfirmed)
      :action==='live-restore'?trial.restore():trial.acknowledgeRecovery();
    renderLive();
    await operation;
    if(action==='live-connect'){
      const selected=trial.snapshot().current?.slot;
      inspectSlot=Number.isInteger(selected)&&selected>=0?selected:0;
    }
   }finally{renderLive();}
   return;
  }
  if(action==='device-export'){
   const state=trial.snapshot().current;
   if(state?.source!=='stored-config'||typeof state.rawConfigText!=='string')throw Error('Saved device JSON is unavailable');
   download(new Blob([state.rawConfigText+'\n'],{type:'application/json'}),'config.json');
   status='Downloaded read-only device config.json · WAV files are not included';return;
  }
  if(action==='device-to-draft'){
   const state=trial.snapshot().current;
   const draft=createOfflineDraftFromSavedConfig(state);
   if(!win.confirm('Open saved device presets in the offline editor? Your current pack stays in Undo history. No changes will be sent to the mic.'))return;
   await trial.disconnect();ensureActive(token);
   mode='emulation';workspace='presets';audio.stop();changed(draft);
   status='Local draft created · device not modified · original config stays on the mic';return;
  }
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
  if(action==='duplicate-preset'){
   const destination=Number(q('[data-copy-destination]').value);
   if(!Number.isInteger(destination)||destination<0||destination>3||destination===selected)throw Error('Choose a different destination preset');
   if(!win.confirm('Replace preset '+(destination+1)+' with a local copy of preset '+(selected+1)+'? This can be undone.'))return;
   const source=structuredClone(currentPreset());
   audio.stop();editConfig(config=>{
    const copy={...source,pos:destination,name:((source.name||'PRESET')+' COPY').slice(0,128)};
    const i=config.presets.findIndex((item,index)=>(item.pos??index)===destination);
    if(i>=0)config.presets[i]=copy;else config.presets.push(copy);
   });
   selected=destination;status='Preset copied locally · no device write';render();return;
  }
  if(action==='reset-preset'){
   if(!win.confirm('Reset preset '+(selected+1)+' to LOWPASS and SAMPLE? This can be undone.'))return;
   audio.stop();editPreset(()=>({pos:selected,name:'PRESET '+(selected+1),
    list:[{effect:'LOWPASS',cutoff:1},{effect:'SAMPLE'}],trigger:{row:1}}));
   status='Preset reset locally · no device write';return;
  }
  if(action==='apply-json'){const next=packWithConfig(store.snapshot(),JSON.parse(q('[data-config]').value));validatePack(next);audio.stop();changed(next);return;}
  if(action==='monitor-mic'){
   if(!win.confirm('Monitor the browser microphone through the approximate FX chain? This requests microphone permission and can cause loud audio feedback. Use headphones and lower your output volume.'))return;
   if(await audio.monitorMicrophone(currentPreset())){ensureActive(token);status='Browser microphone monitoring · stop before using speakers';}return;
  }
  if(action==='audition'){
   const p=store.snapshot(),s=sampleFor(p,previewSlot);if(!s)throw Error('Choose a custom WAV for browser audition');
   if(await audio.play(p.files.get(s.file),currentPreset(),{route})){ensureActive(token);status='Playing · approximate Emulation';}return;
  }
  for(const key of ['up','down','remove'])if(b.dataset[key]!==undefined){
   const row=Number(b.dataset[key]);audio.stop();
   if(key==='remove'){
    const original=currentPreset();const assigned=['handle','shake','lfo','trigger'].filter(k=>original[k]?.row===row);
    if(assigned.length&&!win.confirm('This effect is used by '+assigned.join(', ')+'. Remove those assignments as well? This can be undone.'))return;
    editPreset(p=>removeEffect(p,row,{removeAssignments:assigned.length>0}));return;
   }
   editPreset(p=>moveEffect(p,row,row+(key==='up'?-1:1)));return;
  }
  if(b.dataset.factorySample!==undefined){
   const slot=Number(b.dataset.factorySample),before=store.snapshot(),sample=sampleFor(before,slot);
   if(!sample)return;
   if(!win.confirm('Use the built-in sound for WAV slot '+(slot+1)+'? This removes the custom WAV from the local pack; Undo remains available.'))return;
   before.config.samples=before.config.samples.filter((item,index)=>(item.pos??index)!==slot);
   if(!before.config.samples.some(item=>item.file===sample.file))before.files.delete(sample.file);
   audio.stop();changed(before);status='Factory sound selected locally · no device write';return;
  }
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
 root.addEventListener('dragstart',event=>{
  const handle=event.target.closest?.('[data-fx-drag-handle]');
  if(!handle||!opened||mode!=='emulation')return;
  draggedRow=Number(handle.dataset.fxDragHandle);
  event.dataTransfer?.setData('text/plain',String(draggedRow));
  if(event.dataTransfer)event.dataTransfer.effectAllowed='move';
 });
 root.addEventListener('dragover',event=>{
  if(draggedRow<0||mode!=='emulation'||!event.target.closest?.('[data-fx-row]'))return;
  event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';
 });
 root.addEventListener('drop',event=>{
  const item=event.target.closest?.('[data-fx-row]');
  if(!item||draggedRow<0||mode!=='emulation')return;
  event.preventDefault();const from=draggedRow,to=Number(item.dataset.fxRow);draggedRow=-1;
  if(from===to)return;
  void run(async()=>{audio.stop();editPreset(p=>moveEffect(p,from,to));status='Effect reordered locally · modulation assignments followed the row';updateStatus();});
 });
 root.addEventListener('dragend',()=>{draggedRow=-1;});
 root.addEventListener('keydown',event=>{
  if(!opened||mode!=='emulation'||!['preview','all'].includes(workspace))return;
  if(event.target.closest?.('button,input,select,textarea,[contenteditable="true"]'))return;
  const key=event.key.toLowerCase();
  if(key==='h'&&!event.repeat){
   event.preventDefault();controls.handle=controls.handle>=.5?0:1;
   const slider=q('[data-control="handle"]');if(slider)slider.value=controls.handle;
   audio.setControls(controls);return;
  }
  if(key==='s'){
   event.preventDefault();controls.shake=1;const slider=q('[data-control="shake"]');
   if(slider)slider.value=1;audio.setControls(controls);return;
  }
  if(event.code==='Space'&&!event.repeat){
   event.preventDefault();if(audio.active){audio.stop();status='Stopped';updateStatus();return;}
   void run(async token=>{
    const pack=store.snapshot(),sample=sampleFor(pack,previewSlot);
    if(!sample)throw Error('Choose a WAV in Samples to preview with Space');
    if(await audio.play(pack.files.get(sample.file),currentPreset(),{route})){
     ensureActive(token);status='Playing · approximate browser preview';
    }
   });
  }
 });
 root.addEventListener('keyup',event=>{
  if(event.key.toLowerCase()==='s'&&controls.shake!==0){
   controls.shake=0;const slider=q('[data-control="shake"]');
   if(slider)slider.value=0;audio.setControls(controls);
  }
 });
 win.addEventListener('blur',()=>{
  if(controls.shake!==0){controls.shake=0;audio.setControls(controls);}
 });
 root.addEventListener('input',event=>{
  const el=event.target;if(el.dataset.control){controls[el.dataset.control]=Number(el.value);audio.setControls(controls);}
  if(el.dataset.param||el.dataset.numberParam){
   if(el.value==='')return;
   const field=el.dataset.param??el.dataset.numberParam,value=Number(el.value);
   if(!Number.isFinite(value))return;
   const label=el.closest('label'),output=label?.querySelector('output');
   if(output)output.textContent=el.value;
   const sibling=label?.querySelector(el.dataset.param?'[data-number-param]':'[data-param]');
   if(sibling)sibling.value=el.value;
   const p=currentPreset();p.list[Number(el.dataset.row)][field]=value;audio.update(p);
  }
 });
 root.addEventListener('change',event=>{const el=event.target;void run(async token=>{
  if(el.matches('[data-fx-inspect-slot]')){inspectSlot=Number(el.value);renderLive();return;}
   if(el.matches('[data-live-firmware]')){liveFirmware=el.value;liveConfirmed=false;liveReplConsent=false;renderLive();return;}
   if(el.matches('[data-live-repl-consent]')){liveReplConsent=el.checked;return;}
  if(el.matches('[data-live-confirm]')){liveConfirmed=el.checked;q('[data-action="live-apply"]').disabled=!liveConfirmed;return;}
  if(el.matches('[data-pack-name]')){editConfig(c=>{c.name=el.value;});return;}
  if(el.matches('[data-preset-name]')){editPreset(p=>{p.name=el.value;});return;}
  if(el.matches('[data-preset-comment]')){editPreset(p=>{p.comment=el.value;});return;}
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
  if(el.dataset.param||el.dataset.numberParam){
   const field=el.dataset.param??el.dataset.numberParam;
   if(el.value===''||!Number.isFinite(Number(el.value)))throw Error('Enter a valid effect parameter');
   editPreset(p=>{p.list[Number(el.dataset.row)][field]=Number(el.value);});return;
  }
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

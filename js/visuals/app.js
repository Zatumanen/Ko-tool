import{createRenderClock,rectVisible}from './renderClock.js';
import{xyPoints,createPhosphorHistory}from './xy.js';
import{stereoAnalysis,createPlasmaDensity,createSpectralPlasma,plasmaRaster}from './stereo.js';
import{peakDb}from './outputMeters.js';
import{createRecorderUi}from './recorderUi.js';
import{MODULES,IDS,PRESET_NAMES,makePreset,validLayout,setVisible,moveModule,allocateWidths,resizePair,clampHeight,readWorking,saveWorking,readPresets,savePresets,resolvedPalette}from './layout.js';
import{createVisualsAudio}from './audio.js';
import{waveformEnvelope}from './transientTrigger.js';
import{spectrumCurve,createSpectrumSmoother}from './spectrum.js';
import{createSpectrogramHistory}from './spectrogram.js';

const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names=Object.fromEntries(MODULES.map(x=>[x.id,x.name]));
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
const bound=(x,a,b)=>Math.min(b,Math.max(a,x));
const colorRgb=value=>{let hex=value.trim().replace('#','');if(hex.length===3)hex=[...hex].map(c=>c+c).join('');return[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)||0);};
export function initVisualsApp({documentRef=document,windowRef=window,storage=(()=>{try{return window.localStorage}catch{return null}})()}={}){
  const doc=documentRef,win=windowRef,icon=doc.getElementById('visuals-icon'),root=doc.getElementById('visuals-root');
  if(!icon||!root)return null;
  let opened=false,layout=makePreset(),named=[],activePreset='Balanced',height=150;
  let monoTone='dark',mode='device',autoTheme=true,sku='',autoHide=false,collapsed=false,picker=false,unsaved=false;
  let status='Источник не выбран',sources=[],drawingFrame=0,audio,draggingId=null,drag=null;
  let captureArmed=false,captureRequest=null,permissionRequest=null,inputRefresh=0;
  let lastData=null,analysisCount=0,paintCount=0;
  const ownsAudio=current=>opened&&audio===current;
  function disarmCapture(){
    captureArmed=false;
    captureRequest=null;
  }
  const renderClock=createRenderClock();
  let xyMode='stereo';const xyHistory=createPhosphorHistory();
  const plasma=createPlasmaDensity(),spectralPlasma=createSpectralPlasma();let plasmaBuffer=null;
  const recorderUi=createRecorderUi({root,windowRef:win,canRecord:()=>!!audio?.active}),recorder=recorderUi.recorder;
  let panelObserver=null,panelResizeObserver=null,observerRevision=0,visiblePanels=new Set();
  let triggerSettings={threshold:.1,timeMs:200,holdMs:200},waveAmplitude=1;
  const spectrumSmoother=createSpectrumSmoother();
  const spectrogram=createSpectrogramHistory(),spectrogramCanvases=new WeakMap();
  let identityAttached=false;
  async function attachVerifiedIdentity(){
    if(identityAttached)return;
    identityAttached=true;
    try{
      // Read the same versioned device singleton as My EP without bootstrapping its workspace.
      const{onConnectionChange,getConnectedDeviceInfo}=await import('../ep133/device.js?v=20261001-1');
      onConnectionChange(state=>{
        const info=state?.connected&&!state.unsafe?getConnectedDeviceInfo():null;
        sku=info?.sku==='TE032AS002'&&info?.baseSku==='TE032AS001'?'TE032AS001':info?.sku||'';
        refreshTheme();
      });
    }catch(error){identityAttached=false;sku='';refreshTheme()}
  }
  function currentTheme(){return resolvedPalette(autoTheme?'device':mode,sku)}
  function refreshTheme(){
    if(!opened)return;
    root.classList.remove('vis-theme-app','vis-theme-ep133','vis-theme-ep40','vis-theme-mono','vis-mono-light');
    root.classList.add('vis-theme-'+currentTheme());
    root.classList.toggle('vis-mono-light',currentTheme()==='mono'&&monoTone==='light');
    const tone=root.querySelector('[data-mono-tone]');if(tone){tone.hidden=currentTheme()!=='mono';tone.value=monoTone;}
    const label=root.querySelector('[data-theme-state]');
    if(label)label.textContent=(sku?({'TE032AS001':'EP-133','TE032AS006':'EP-40','TE032AS005':'EP-1320'}[sku]||'Неизвестный EP'):'Устройство не подтверждено')+' · '+(autoTheme?'AUTO':'MANUAL');
    if(!audio?.active)drawAll(null);
  }
  function persist(){
    unsaved=!saveWorking(storage,layout);
    const notice=root.querySelector('.vis-unsaved');
    if(notice)notice.hidden=!unsaved;
  }
  function working(next){
    const normalized=validLayout(next);if(!normalized)return;
    layout=normalized;activePreset='Custom';
    if(!layout.visible.length){collapsed=true;autoHide=false;disarmCapture();audio?.stop('Захват остановлен: все модули скрыты');stopAnimation()}
    persist();render();
  }
  function usePreset(name){
    const selected=PRESET_NAMES.includes(name)?makePreset(name):named.find(p=>p.name===name)?.layout;
    if(!selected)return;
    layout=validLayout(selected);
    activePreset=name;
    if(!layout.visible.length){collapsed=true;autoHide=false;disarmCapture();audio.stop();stopAnimation()}
    else collapsed=false;
    persist();render();
  }
  function audioState(next){
    if(next.reason==='channel-format')disarmCapture();
    recorderUi.update();
    status=next.message||'Аудиовход не выбран';
    const element=root.querySelector('[data-audio-status]');
    if(element){element.textContent=status;element.title=status}
    const start=root.querySelector('[data-action="start"]');
    const stop=root.querySelector('[data-action="stop"]');
    if(start)start.hidden=!!next.active;
    if(stop)stop.hidden=!next.active;
    const capture=root.querySelector('.vis-capture-indicator');
    if(capture){capture.hidden=!(next.active&&(root.classList.contains('vis-hidden')));capture.querySelector('span').textContent='● LIVE · '+(status.slice(0,50))}
    if(next.active)kick();
    else{lastData=null;renderClock.reset();xyHistory.reset();plasma.reset();spectrumSmoother.reset();spectrogram.reset();stopAnimation();drawAll(null)}
    updateActivity();
  }
  function canRender(){return opened&&audio?.active&&!doc.hidden&&!collapsed&&!root.classList.contains('vis-hidden')&&visiblePanels.size>0;}
  function stopAnimation(){if(drawingFrame){win.cancelAnimationFrame(drawingFrame);drawingFrame=0;}}
  function updateActivity(){
    const active=canRender();root.dataset.renderState=!audio?.active?'stopped':active?'active':'suspended';
    if(active)kick();else{stopAnimation();renderClock.suspend();}
  }
  function refreshVisibility(){
    const area=root.querySelector('.vis-meters');visiblePanels=new Set();
    if(area){
      const areaRect=area.getBoundingClientRect();
      for(const panel of area.querySelectorAll('[data-meter]')){
        const r=panel.getBoundingClientRect(),clip={left:Math.max(areaRect.left,r.left),right:Math.min(areaRect.right,r.right),top:Math.max(areaRect.top,r.top),bottom:Math.min(areaRect.bottom,r.bottom)};
        if(rectVisible(panel.querySelector('canvas').getBoundingClientRect(),clip,win.innerWidth,win.innerHeight))visiblePanels.add(panel);
      }
    }
    updateActivity();
  }
  function observePanels(){
    const revision=++observerRevision;panelObserver?.disconnect();panelResizeObserver?.disconnect();panelObserver=null;panelResizeObserver=null;refreshVisibility();
    const area=root.querySelector('.vis-meters');if(!area)return;
    area.addEventListener('scroll',refreshVisibility,{passive:true});
    area.addEventListener('toggle',refreshVisibility,true);
    if(win.IntersectionObserver){
      panelObserver=new win.IntersectionObserver(()=>{
        if(revision!==observerRevision||!opened)return;
        // Re-read current geometry: queued observer entries may precede a resize.
        refreshVisibility();
      });
      for(const panel of area.querySelectorAll('[data-meter]'))panelObserver.observe(panel.querySelector('canvas'));
    }
    if(win.ResizeObserver){
      panelResizeObserver=new win.ResizeObserver(()=>{if(revision===observerRevision&&opened)refreshVisibility();});
      for(const canvas of area.querySelectorAll('canvas'))panelResizeObserver.observe(canvas);
    }
  }
  function kick(){if(!drawingFrame&&canRender())drawingFrame=win.requestAnimationFrame(tick);}
  function tick(time){
    drawingFrame=0;
    if(!panelObserver)refreshVisibility();
    if(!canRender()){updateActivity();return;}
    const due=renderClock.step(time);
    root.dataset.renderFps=String(due.fps);
    const indicator=root.querySelector('[data-render-target]');if(indicator)indicator.textContent='AUTO '+due.fps+' FPS';
    if(due.sample){
      lastData=audio.sample();
      if(lastData){spectrogram.push(lastData.frequency,lastData.sampleRate,time);root.dataset.visAnalysisCount=String(++analysisCount);}
    }
    if(due.paint&&lastData){
      const start=win.performance.now();drawAll(lastData);renderClock.recordPaint(win.performance.now()-start);root.dataset.visPaintCount=String(++paintCount);
    }
    kick();
  }
  function stop(message){
    disarmCapture();
    if(['recording','paused'].includes(recorder.snapshot().state))void audio.finishAndStop(message);
    else audio.stop(message);
    stopAnimation();
  }
  function open(){
    if(opened){root.querySelector('.vis-dock')?.focus();return}
    opened=true;disarmCapture();permissionRequest=null;sources=[];monoTone='dark';renderClock.reset();lastData=null;analysisCount=0;paintCount=0;root.dataset.visAnalysisCount='0';root.dataset.visPaintCount='0';root.dataset.renderFps='60';
    layout=readWorking(storage)||makePreset();named=readPresets(storage);
    activePreset='Custom';height=150;autoTheme=true;mode='device';autoHide=false;collapsed=layout.visible.length===0;picker=false;unsaved=false;status='Выберите аудиовход и нажмите START';
    audio=createVisualsAudio({onState:audioState,recorder});
    audio.configureTrigger(triggerSettings);
    render();
    void attachVerifiedIdentity();
    void refreshInputs();
  }
  function close(){
    if(!opened||!recorderUi.canClose())return;
    recorderUi.clear();
    opened=false;observerRevision++;panelObserver?.disconnect();panelResizeObserver?.disconnect();panelObserver=null;panelResizeObserver=null;visiblePanels.clear();stop('Захват остановлен');audio=null;picker=false;unsaved=false;autoHide=false;collapsed=false;
    root.innerHTML='';root.className='';
  }
  async function startCapture(current,{refresh=false}={}){
    if(!ownsAudio(current)||captureRequest||permissionRequest?.audio===current||current.active)return;
    const request={};
    captureRequest=request;
    const relevant=()=>ownsAudio(current)&&captureRequest===request;
    try{
      const ok=await current.start();
      if(!relevant())return;
      captureArmed=ok;
      if(refresh&&ok)void refreshInputs();
    }catch(error){
      if(!relevant())return;
      captureArmed=false;
      status=error?.message||String(error);
      render();
    }finally{
      if(relevant())captureRequest=null;
    }
  }
  async function refreshInputs({requestPermission=false,preserveStatus=false}={}){
    const current=audio;
    if(!current||!ownsAudio(current))return;
    if(permissionRequest?.audio===current){
      if(!requestPermission)permissionRequest.refreshPending=true;
      return;
    }
    if(requestPermission&&(captureRequest||current.active))return;
    const request=++inputRefresh;
    const relevant=()=>ownsAudio(current)&&request===inputRefresh;
    const access=requestPermission?{audio:current,refreshPending:false}:null;
    if(access){
      permissionRequest=access;
      status='Запрос разрешения для списка аудиовходов…';
      root.querySelector('[data-audio-status]').textContent=status;
    }
    let result=null,error;
    try{result=await(access?current.unlockInputs():current.inputs());}
    catch(reason){error=reason;}
    finally{if(access&&permissionRequest===access)permissionRequest=null;}
    if(!relevant())return;
    if(!result){
      if(!access)sources=[];
      if(!preserveStatus&&!current.active)status=error?.name==='NotAllowedError'?'Доступ к аудиоустройствам запрещён':(error?.message||'Нет доступа к аудиоустройствам');
    }else{
      sources=result;
      const selected=sources.find(item=>item.id===current.selectedId);
      if(current.active&&!selected){
        current.stop('Выбранный аудиовход отключён');stopAnimation();
      }else if(current.active){
        status='LIVE · '+(selected.label||'Аудиовход');
      }else if(!preserveStatus&&!access?.refreshPending&&captureArmed&&selected&&!collapsed&&!captureRequest){
        // Only resume the SAME source after an earlier explicit START in this open session.
        await startCapture(current);
      }else if(!preserveStatus&&!captureRequest)status=sources.length?'Выберите аудиовход и нажмите START':'Доступных аудиовходов нет';
    }
    if(!relevant())return;
    render();
    if(access?.refreshPending)void refreshInputs({preserveStatus:!result});
  }
  function labelId(id){return names[id]||id}
  function render(){
    if(!opened)return;
    const presets=[...PRESET_NAMES,...named.map(p=>p.name)];
    const current=audio?.selectedId||'';
    const sourceHtml='<option value="">— АУДИОВХОД —</option>'+
      (current&&!sources.some(s=>s.id===current)?'<option value="'+escapeHtml(current)+'">Выбранный вход отключён</option>':'')+
      sources.map(s=>'<option value="'+escapeHtml(s.id)+'">'+escapeHtml(s.label)+'</option>').join('');
    root.innerHTML='<div class="vis-dock" role="region" aria-label="Visuals: аудиовизуализация" tabindex="-1">'+
      '<div class="vis-top-resize" data-height-resize tabindex="0" role="separator" aria-orientation="horizontal" title="Потяните или используйте стрелки для изменения высоты" aria-label="Изменить высоту Visuals"></div>'+
      '<div class="vis-toolbar">'+
      '<strong class="vis-title">VISUALS</strong>'+
      '<select class="vis-source" data-source aria-label="Выберите аудиовход">'+sourceHtml+'</select>'+
      '<button data-action="unlock" title="Запросить разрешение на список аудиовходов. Системный вход откроется на мгновение и сразу остановится.">ACCESS</button>'+ 
      '<button data-action="refresh" title="Обновить список аудиовходов">↻</button>'+
      '<button data-action="start">▶ START</button><button data-action="stop">■ STOP</button><button data-action="recorder" aria-label="WAV Recorder">REC</button>'+
      '<span class="vis-status" data-audio-status role="status" aria-live="polite">'+escapeHtml(status)+'</span>'+
      '<select class="vis-preset" data-preset aria-label="Компоновка"><option value="Custom">Компоновка</option>'+
      presets.map(n=>'<option value="'+escapeHtml(n)+'">'+escapeHtml(n)+'</option>').join('')+'</select>'+
      '<button data-action="save" title="Сохранить текущую компоновку">SAVE</button>'+
      '<button data-action="delete" title="Удалить выбранный пользовательский пресет">DEL</button>'+
      '<button data-action="modules" aria-expanded="'+String(picker)+'">MODULES</button>'+
      '<output data-render-target title="Целевая частота Canvas, не измеренный FPS экрана" aria-label="Целевая частота отрисовки">AUTO '+renderClock.fps+' FPS</output>'+
      '<select class="vis-theme" data-theme aria-label="Цветовая тема"><option value="device">Под устройство</option><option value="app">Под приложение</option><option value="mono">Ч/Б</option></select>'+
      '<select data-mono-tone aria-label="Black & White variant" hidden><option value="dark">Dark Mono</option><option value="light">Light Mono</option></select>'+
      '<label><input type="checkbox" data-auto-theme '+(autoTheme?'checked':'')+'> AUTO THEME</label>'+
      '<span data-theme-state title="Статус распознавания EP"></span>'+
      '<label><input type="checkbox" data-autohide '+(autoHide?'checked':'')+'> HIDE</label>'+
      '<button data-action="collapse" title="Свернуть полоску">▁</button>'+
      '<button data-action="close" title="Закрыть Visuals">×</button></div>'+
      '<div class="vis-meters" tabindex="0" aria-label="Модули Visuals; горизонтальная прокрутка"></div></div>'+
      '<button class="vis-tab" data-action="restore" title="Развернуть Visuals" aria-label="Восстановить Visuals">▲ VISUALS</button>'+
      '<div class="vis-picker" data-module-picker role="group" aria-label="Выбор модулей Visuals">'+
      '<strong>МОДУЛИ</strong>'+MODULES.map(m=>'<button data-module="'+m.id+'" aria-pressed="'+String(layout.visible.includes(m.id))+'">'+escapeHtml(m.name)+(layout.visible.includes(m.id)?' ✓':' +')+'</button>').join('')+
      '<button data-action="dismiss">ЗАКРЫТЬ СПИСОК</button></div>'+
      '<div class="vis-unsaved" role="status" aria-live="polite" '+(unsaved?'':'hidden')+'>⚠ Изменения не сохранены</div>'+
      '<div class="vis-capture-indicator" '+(audio.active&&autoHide?'':'hidden')+' role="status"><span>● LIVE</span><button data-action="stop">STOP</button></div>';
    root.className=(collapsed?'vis-collapsed ':'')+(autoHide&&root.dataset.hidden==='1'?'vis-hidden ':'');
    root.querySelector('.vis-tab').hidden=!collapsed;
    root.querySelector('[data-module-picker]').hidden=!picker;
    root.querySelector('[data-action="start"]').hidden=audio.active;
    root.querySelector('[data-action="stop"]').hidden=!audio.active;
    root.querySelector('[data-preset]').value=presets.includes(activePreset)?activePreset:'Custom';
    root.querySelector('[data-theme]').value=mode;
    root.querySelector('[data-source]').value=current;
    root.querySelector('.vis-dock').style.height=clampHeight(height,win.innerHeight)+'px';
    const meters=root.querySelector('.vis-meters'),visible=layout.order.filter(id=>layout.visible.includes(id));
    for(const [index,id]of visible.entries()){
      const meter=el('section','vis-meter');meter.dataset.meter=id;
      const title=el('div','vis-meter-title');
      title.innerHTML='<strong>'+escapeHtml(labelId(id))+'</strong>'+
        '<button data-step="-1" data-for="'+id+'" title="Переместить влево" aria-label="'+escapeHtml(labelId(id))+' влево">◀</button>'+
        '<button class="vis-drag" draggable="true" data-drag="'+id+'" title="Перетащить модуль" aria-label="Перетащить '+escapeHtml(labelId(id))+'">☷</button>'+
        '<button data-step="1" data-for="'+id+'" title="Переместить вправо" aria-label="'+escapeHtml(labelId(id))+' вправо">▶</button>'+
        '<button data-action="hide" data-for="'+id+'" title="Скрыть модуль" aria-label="Скрыть '+escapeHtml(labelId(id))+'">×</button>';
      meter.append(title);
      if(id==='output'){const reset=el('button','vis-output-reset','↺');reset.dataset.action='reset-output';reset.setAttribute('aria-label','Reset Output Peak Hold and CLIP');reset.title='Reset Peak Hold / CLIP';title.append(reset);}
      if(id==='loudness'){
        const reset=el('button','','RESET LUFS');reset.dataset.action='reset-loudness';reset.setAttribute('aria-label','Reset LUFS measurement');meter.append(reset);
        const error=el('div','vis-lufs-error');error.dataset.lufsError='1';error.setAttribute('role','alert');error.hidden=true;meter.append(error);
      }
      if(id==='oscilloscope'){
        const choice=el('select');choice.dataset.xyMode='1';choice.setAttribute('aria-label','Oscilloscope XY mode');
        choice.innerHTML='<option value="stereo">Stereo XY</option><option value="artistic">Artistic XY · derived</option>';choice.value=xyMode;meter.append(choice);
      }
      if(id==='waveform'){
        const controls=el('details','vis-trigger-controls');
        controls.innerHTML='<summary>Trigger settings</summary>'+[
          ['Sensitivity threshold','threshold',triggerSettings.threshold,.001,1,.001],
          ['Time ms','timeMs',triggerSettings.timeMs,10,1000,10],
          ['Amplitude','amplitude',waveAmplitude,.1,10,.1],
          ['Hold ms','holdMs',triggerSettings.holdMs,0,3000,10]
        ].map(([label,key,value,min,max,step])=>'<label>'+label+'<input type="number" aria-label="Waveform '+label+'" data-trigger-setting="'+key+'" value="'+value+'" min="'+min+'" max="'+max+'" step="'+step+'"></label>').join('');
        meter.append(controls);
      }
      if(index){const divider=el('div','vis-divider');divider.dataset.divider='1';divider.dataset.left=visible[index-1];divider.dataset.right=id;divider.title='Перетащить границу модулей';divider.setAttribute('role','separator');divider.setAttribute('aria-orientation','vertical');divider.setAttribute('tabindex','0');divider.setAttribute('aria-label','Изменить ширину '+labelId(visible[index-1])+' и '+labelId(id));meter.append(divider)}
      const canvas=el('canvas');canvas.setAttribute('aria-label',labelId(id)+' — визуализация входящего аудио');meter.append(canvas);meters.append(meter);
    }
    recorderUi.mount();updateWidths();observePanels();refreshTheme();drawAll(audio.active?lastData:null);
    const capture=root.querySelector('.vis-capture-indicator');
    if(capture)capture.hidden=!(audio.active&&root.classList.contains('vis-hidden'));
  }
  function updateWidths(){
    const area=root.querySelector('.vis-meters');if(!area)return;
    const panels=[...area.querySelectorAll('.vis-meter')],n=panels.length;
    const usable=Math.max(0,area.clientWidth-8-Math.max(0,n-1)*3-n*2);
    const widths=allocateWidths(layout,usable);
    for(const panel of panels)panel.style.width=(widths[panel.dataset.meter]||96)+'px';
  }
  function drawingContext(canvas){
    const rect=canvas.getBoundingClientRect(),w=Math.max(1,rect.width),h=Math.max(1,rect.height),dpr=Math.min(2,win.devicePixelRatio||1);
    const x=Math.max(1,Math.floor(w*dpr)),y=Math.max(1,Math.floor(h*dpr));
    if(canvas.width!==x||canvas.height!==y){canvas.width=x;canvas.height=y}
    const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)return null;ctx.setTransform(dpr,0,0,dpr,0,0);
    const computed=win.getComputedStyle(root);
    return{ctx,w,h,color:computed.getPropertyValue('--vis-accent').trim()||'#fff',grid:computed.getPropertyValue('--vis-grid').trim()||'#555',bg:computed.getPropertyValue('--vis-panel').trim()||'#000',fg:computed.getPropertyValue('--vis-fg').trim()||'#fff'};
  }
  function grid(g){
    const{ctx,w,h,bg,grid}=g;ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);ctx.strokeStyle=grid;ctx.lineWidth=.6;
    ctx.beginPath();for(let x=0;x<w;x+=32){ctx.moveTo(x,0);ctx.lineTo(x,h)}for(let y=0;y<h;y+=22){ctx.moveTo(0,y);ctx.lineTo(w,y)}ctx.stroke();
  }
  function line(g,values,scale=1){
    const{ctx,w,h,color}=g;ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=1.5;
    const len=values.length,step=Math.max(1,Math.floor(len/(w*1.4)));
    for(let i=0,j=0;i<len;i+=step,j++){const x=j/(Math.ceil(len/step)-1||1)*w,y=h/2-values[i]*(h*.43)*scale;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}
    ctx.stroke();
  }
  function print(g,text,size=11){g.ctx.fillStyle=g.fg;g.ctx.font=size+'px monospace';g.ctx.fillText(text,8,Math.max(13,g.h/2),Math.max(20,g.w-16))}
  function meter(g,value,y,label){
    const {ctx,w,h,color,grid}=g,x=8,width=Math.max(1,w-16),barH=Math.max(9,Math.min(18,h/5));
    ctx.fillStyle=grid;ctx.fillRect(x,y,width,barH);ctx.fillStyle=color;ctx.fillRect(x,y,width*bound(value,0,1),barH);
    ctx.fillStyle=g.fg;ctx.font='11px monospace';ctx.fillText(label,x+3,y+barH-2);
  }
  function paint(id,canvas,data){
    const g=drawingContext(canvas);if(!g)return;
    if(!data&&id==='stereo'){canvas.dataset.stereoState='stopped';delete canvas.dataset.stereoCorrelation;delete canvas.dataset.stereoBalance;canvas.setAttribute('aria-label','Stereo Meter stopped');}
    if(id==='output'){
      for(const key of Object.keys(canvas.dataset))if(key.startsWith('output'))delete canvas.dataset[key];
      if(!data){canvas.dataset.outputState='stopped';canvas.setAttribute('aria-label','Output Meters stopped');}
    }
    if(id==='loudness'){const error=canvas.parentElement.querySelector('[data-lufs-error]');if(error){error.textContent=data?.loudness?.error||'';error.hidden=!data?.loudness?.error;}}
    if(id!=='spectrogram'||!data)grid(g);
    if(!data){grid(g);print(g,'NO LIVE AUDIO');canvas.dataset.visHistory='';if(id==='loudness'){canvas.dataset.lufsState='stopped';delete canvas.dataset.lufsMomentary;delete canvas.dataset.lufsShortTerm;delete canvas.dataset.lufsIntegrated;delete canvas.dataset.lufsSeconds;}return}
    const{ctx,w,h,color}=g;
    if(id==='waveform'){
      grid(g);const frame=data.trigger;
      canvas.dataset.triggerCount=String(frame?.count||0);
      if(frame?.samples){
        const columns=waveformEnvelope(frame.samples,w);ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();
        columns.forEach(([min,max],i)=>{const x=i/(columns.length-1||1)*w;ctx.moveTo(x,h/2-max*h*.43*waveAmplitude);ctx.lineTo(x,h/2-min*h*.43*waveAmplitude+.5);});ctx.stroke();
        ctx.fillStyle=color;ctx.font='10px monospace';ctx.fillText('TRIGGER · '+frame.timeMs+' ms',7,11);
      }
      else print(g,frame?.unsupported?'TRIGGER UNAVAILABLE':frame?.error?'TRIGGER ERROR':'TRIGGER WAITING');
    }else if(id==='oscilloscope'){
      grid(g);const points=xyPoints(data,xyMode),now=win.performance.now();canvas.dataset.xyMode=xyMode;
      canvas.dataset.xyPoints=String(points?.length||0);
      canvas.setAttribute('aria-label',xyMode==='artistic'?'Artistic XY — derived mono delay':points===null?'Stereo XY unavailable — mono input':'Stereo XY — left channel X, right channel Y');
      if(points===null){xyHistory.reset();print(g,'MONO · NO STEREO',9);return;}
      xyHistory.add(points,now);
      const size=Math.max(1,Math.min(w-12,h-24)),cx=w/2,cy=12+(h-16)/2,scale=size*.45;
      ctx.strokeStyle=g.grid;ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(cx-scale,cy);ctx.lineTo(cx+scale,cy);ctx.moveTo(cx,cy-scale);ctx.lineTo(cx,cy+scale);ctx.stroke();
      ctx.strokeStyle=color;ctx.lineWidth=1.2;
      for(const frame of xyHistory.frames(now)){
        ctx.globalAlpha=frame.alpha;ctx.beginPath();let drawing=false;
        for(const p of frame.points){if(!p){drawing=false;continue;}const x=cx+p[0]*scale,y=cy-p[1]*scale;if(drawing)ctx.lineTo(x,y);else{ctx.moveTo(x,y);drawing=true;}}ctx.stroke();
      }
      ctx.globalAlpha=1;ctx.fillStyle=g.fg;ctx.font='9px monospace';ctx.fillText(xyMode==='stereo'?'L → X · R → Y':'ARTISTIC · DERIVED',3,9);
    }else if(id==='spectrum'){
      grid(g);const raw=spectrumCurve(data.spectrumDb,data.sampleRate),points=spectrumSmoother.update(raw,win.performance.now());
      const left=29,right=Math.max(left+1,w-5),top=15,bottom=Math.max(top+1,h-15),upper=points.at(-1).hz;
      const x=hz=>left+Math.log(hz/20)/Math.log(upper/20)*(right-left),y=db=>bottom-(db+100)/100*(bottom-top);
      ctx.fillStyle=g.fg;ctx.font='9px monospace';
      for(const db of [-80,-40,0])ctx.fillText(String(db),1,y(db)+3);
      for(const hz of [20,100,1000,10000])if(hz<=upper)ctx.fillText(hz>=1000?hz/1000+'k':String(hz),Math.min(right-18,x(hz)),h-3);
      ctx.fillText('Hz · dBFS FFT',left,10);
      ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.beginPath();
      points.forEach((p,i)=>{if(i===0)ctx.moveTo(x(p.hz),y(p.db));else ctx.lineTo(x(p.hz),y(p.db));});ctx.stroke();
      const peak=raw.reduce((a,b)=>a.db>b.db?a:b);canvas.dataset.spectrumPeakHz=String(Math.round(peak.hz));canvas.dataset.spectrumScale='log-hz-dbfs';
    }else if(id==='spectrogram'){
      const now=win.performance.now();
      const raster=spectrogram.raster(w,Math.max(1,h-20),now);
      let buffer=spectrogramCanvases.get(canvas);
      if(!buffer){buffer=doc.createElement('canvas');spectrogramCanvases.set(canvas,buffer);}
      buffer.width=raster.width;buffer.height=raster.height;
      const target=buffer.getContext('2d'),pixels=target.createImageData(raster.width,raster.height);
      const rgb=value=>{let hex=value.trim().replace('#','');if(hex.length===3)hex=[...hex].map(c=>c+c).join('');return[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)||0);};
      const bg=rgb(g.bg),fg=rgb(color);
      for(let i=0;i<raster.values.length;i++){
        const v=raster.values[i]/255;for(let c=0;c<3;c++)pixels.data[i*4+c]=Math.round(bg[c]+v*(fg[c]-bg[c]));pixels.data[i*4+3]=255;
      }
      target.putImageData(pixels,0,0);ctx.fillStyle=g.bg;ctx.fillRect(0,0,w,h);ctx.imageSmoothingEnabled=false;
      ctx.drawImage(buffer,0,10,w,Math.max(1,h-20));
      ctx.fillStyle=g.fg;ctx.font='9px monospace';ctx.fillText(Math.round(raster.upperHz/1000)+'k Hz',3,9);ctx.fillText('20 Hz · −'+raster.seconds.toFixed(1)+'s → NOW',3,h-2);
      canvas.dataset.historyFrames=String(spectrogram.size);canvas.dataset.historySeconds=String(raster.seconds);canvas.dataset.historyDirection='right-to-left';
    }else if(id==='loudness'){
      grid(g);const state=data.loudness;
      canvas.dataset.lufsState=state?.error?'unavailable':state?'measuring':'warmup';
      canvas.dataset.lufsMomentary=String(state?.momentary??'pending');canvas.dataset.lufsShortTerm=String(state?.shortTerm??'pending');canvas.dataset.lufsIntegrated=String(state?.integrated??'pending');canvas.dataset.lufsSeconds=String(state?.seconds??0);
      canvas.setAttribute('aria-label',state?.error?'LUFS unavailable: '+state.error:'LUFS Momentary, Short-term and Integrated');
      if(state?.error){print(g,'LUFS UNAVAILABLE',9);return;}
      const display=value=>value==null?'WAIT':value===-Infinity?'−∞':value.toFixed(1);
      canvas.setAttribute('aria-label','LUFS: M '+display(state?.momentary)+', S '+display(state?.shortTerm)+', I '+display(state?.integrated));
      ctx.fillStyle=g.fg;ctx.font='10px monospace';
      for(const [i,[label,key]]of [['M','momentary'],['S','shortTerm'],['I','integrated']].entries())ctx.fillText(label+' '+display(state?.[key])+' LUFS',3,12+i*Math.max(10,(h-14)/3),Math.max(1,w-6));
    }else if(id==='output'){
      const state=data.output||{status:'pending'};canvas.dataset.outputState=state.status;
      if(state.status!=='ready'){
        const text={pending:'WAITING FOR PCM','unknown-format':'CHANNEL FORMAT UNKNOWN',unsupported:'AudioWorklet REQUIRED',invalid:'INVALID INPUT',stale:'AUDIO PAUSED'}[state.status]||'UNAVAILABLE';
        canvas.setAttribute('aria-label','Output Meters: '+text);print(g,text,9);return;
      }
      canvas.dataset.outputChannels=String(state.channelCount);
      const description=[];const dbText=db=>Number.isFinite(db)?db.toFixed(1):'−∞';
      for(let c=0;c<2;c++){
        const compact=h<40,label=c?'R':'L',x=compact?c*w/2+4:8,y=compact?0:c*h/2+1,barY=compact?Math.max(9,h-6):y+12,barH=compact?4:Math.max(3,Math.min(10,h/2-15)),width=Math.max(1,compact?w/2-8:w-16);
        if(c>=state.channelCount){canvas.dataset.outputRightDb='unavailable';description.push('R unavailable');ctx.fillStyle=g.fg;ctx.font='9px monospace';ctx.fillText(compact?'R N/A':'R N/A · MONO',x,y+9,Math.max(1,width));continue;}
        const db=peakDb(state.peak[c]),held=peakDb(state.hold[c]),position=value=>width*bound((value+60)/60,0,1);
        canvas.dataset['output'+(c?'Right':'Left')+'Db']=String(db);canvas.dataset['output'+(c?'Right':'Left')+'HoldDb']=String(held);canvas.dataset['output'+(c?'Right':'Left')+'Clip']=String(state.clip[c]);
        ctx.fillStyle=g.fg;ctx.font=(compact?8:9)+'px monospace';ctx.fillText(label+(state.clip[c]?' CLIP':' '+dbText(db)+(compact?'':' dBFS')),x,y+9,Math.max(1,width));
        ctx.fillStyle=g.grid;ctx.fillRect(x,barY,width,barH);ctx.fillStyle=color;ctx.fillRect(x,barY,position(db),barH);
        if(Number.isFinite(held)){ctx.fillStyle=g.fg;ctx.fillRect(x+Math.min(width-2,position(held)),barY-2,2,barH+4);}
        description.push(label+' '+dbText(db)+' dBFS, hold '+dbText(held)+' dBFS'+(state.clip[c]?', CLIP':''));
      }
      canvas.setAttribute('aria-label','Output Meters '+(state.channelCount===1?'MONO; ':'')+description.join('; '));
    }else if(id==='stereo'){
      grid(g);const state=stereoAnalysis(data.leftTime,data.rightTime,data.channelCount);
      canvas.dataset.stereoState=state.status;canvas.dataset.stereoCorrelation=String(state.correlation??'undefined');canvas.dataset.stereoBalance=String(state.balance??'undefined');
      canvas.setAttribute('aria-label','Stereo Meter: '+state.status+', correlation '+(state.correlation?.toFixed(2)??'undefined')+', balance '+(state.balance?.toFixed(2)??'undefined'));
      if(state.status==='mono'||state.status==='invalid'){plasma.reset();print(g,state.status==='mono'?'MONO · DISABLED':'INVALID INPUT',9);return;}
      const density=plasma.update(state.status==='silence'?[]:spectralPlasma.project(data.leftTime,data.rightTime,data.sampleRate),win.performance.now());
      const side=Math.max(1,Math.min(w-10,h-32)),cx=w/2,cy=side/2+2,scale=side*.48,resolution=side>=64?64:32,levels=plasmaRaster(density,resolution);
      if(!plasmaBuffer)plasmaBuffer=doc.createElement('canvas');plasmaBuffer.width=resolution;plasmaBuffer.height=resolution;
      const target=plasmaBuffer.getContext('2d'),pixels=target.createImageData(resolution,resolution),bg=colorRgb(g.bg),fg=colorRgb(color);
      for(let i=0;i<levels.length;i++){for(let c=0;c<3;c++)pixels.data[i*4+c]=Math.round(bg[c]+levels[i]*(fg[c]-bg[c]));pixels.data[i*4+3]=255;}
      target.putImageData(pixels,0,0);
      ctx.imageSmoothingEnabled=true;ctx.drawImage(plasmaBuffer,cx-scale,cy-scale,scale*2,scale*2);
      ctx.strokeStyle=g.grid;ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(cx,cy-scale);ctx.lineTo(cx+scale,cy);ctx.lineTo(cx,cy+scale);ctx.lineTo(cx-scale,cy);ctx.closePath();ctx.stroke();
      ctx.fillStyle=g.fg;ctx.font='9px monospace';ctx.fillText('L',cx-scale,cy-scale+7);ctx.fillText('R',cx+scale-6,cy-scale+7);
      const rail=(value,y,label)=>{
        ctx.fillStyle=g.fg;ctx.fillText(label+' '+(value===null?'—':value.toFixed(2)),3,y+3);
        const start=Math.min(53,w*.58),length=Math.max(1,w-start-4);ctx.strokeStyle=g.grid;ctx.beginPath();ctx.moveTo(start,y);ctx.lineTo(start+length,y);ctx.stroke();
        if(value!==null){ctx.fillStyle=color;ctx.fillRect(start+(value+1)*length/2-1,y-3,2,6);}
      };
      rail(state.correlation,h-18,'C');rail(state.balance,h-5,'B');
    }
  }
  function drawAll(data){if(!opened)return;for(const panel of(data?visiblePanels:root.querySelectorAll('[data-meter]'))){const canvas=panel.querySelector('canvas');paint(panel.dataset.meter,canvas,data);if(data)canvas.dataset.visPaintCount=String(Number(canvas.dataset.visPaintCount||0)+1);}}
  function collapse(){collapsed=true;picker=false;autoHide=false;root.dataset.hidden='0';stop('Захват остановлен: Visuals свёрнут');render()}
  function restore(){
    if(layout.visible.length){collapsed=false;picker=false;render()}
    else{picker=!picker;render();if(picker)root.querySelector('.vis-picker button')?.focus()}
  }
  function choose(id){
    if(!IDS.includes(id))return;
    const next=setVisible(layout,id,!layout.visible.includes(id));
    if(!next)return;
    if(!layout.visible.includes(id)){collapsed=false;picker=false}
    working(next);
  }
  function step(id,n){
    const vis=layout.order.filter(x=>layout.visible.includes(x)),i=vis.indexOf(id),j=i+n;
    if(i<0||j<0||j>=vis.length)return;
    const order=[...layout.order],ia=order.indexOf(id),ib=order.indexOf(vis[j]);
    [order[ia],order[ib]]=[order[ib],order[ia]];
    working({...layout,order});
  }
  function saveNamed(){
    const initial=PRESET_NAMES.includes(activePreset)?'Мой пресет':activePreset==='Custom'?'Мой пресет':activePreset;
    const name=win.prompt('Имя компоновки (до 40 символов)',initial)?.trim();
    if(!name)return;
    if(name.length>40||PRESET_NAMES.includes(name)){status='Некорректное имя пресета';render();return}
    const newNamed=[...named.filter(x=>x.name!==name),{name,layout:validLayout(layout)}].slice(-30);
    if(savePresets(storage,newNamed)){named=newNamed;activePreset=name;status='Компоновка сохранена'}else status='Не удалось сохранить пресет в браузере';
    render();
  }
  function deleteNamed(){
    if(PRESET_NAMES.includes(activePreset)||activePreset==='Custom')return;
    const newNamed=named.filter(x=>x.name!==activePreset);
    if(savePresets(storage,newNamed)){named=newNamed;activePreset='Custom';status='Пресет удалён'}else status='Ошибка удаления пресета';
    render();
  }
  root.addEventListener('click',e=>{
    const mod=e.target.closest('[data-module]');if(mod){choose(mod.dataset.module);return}
    const stepButton=e.target.closest('[data-step]');if(stepButton){step(stepButton.dataset.for,Number(stepButton.dataset.step));return}
    const button=e.target.closest('[data-action]');if(!button)return;
    const action=button.dataset.action;
    if(action==='start')void startCapture(audio,{refresh:true});
    if(action==='recorder')recorderUi.toggle();
    if(action==='stop'){disarmCapture();void audio.finishAndStop();stopAnimation();}
    if(action==='reset-output'){audio.resetOutputMeters();lastData=audio.active?audio.sample():null;drawAll(lastData);return;}
    if(action==='reset-loudness'){audio.resetLoudness();lastData=audio.active?audio.sample():null;drawAll(lastData);return;}
    if(action==='refresh')void refreshInputs();
    if(action==='unlock')void refreshInputs({requestPermission:true});
    if(action==='collapse')collapse();
    if(action==='restore')restore();
    if(action==='dismiss'){picker=false;render();root.querySelector('[data-action="restore"]')?.focus()}
    if(action==='modules'){picker=!picker;render()}
    if(action==='hide')choose(button.dataset.for);
    if(action==='close')close();
    if(action==='save')saveNamed();
    if(action==='delete')deleteNamed();
  });
  root.addEventListener('change',e=>{
    if(e.target.dataset.xyMode){xyMode=e.target.value==='artistic'?'artistic':'stereo';xyHistory.reset();drawAll(audio.active?lastData:null);return;}
    if(e.target.dataset.triggerSetting){
      const input=e.target,key=input.dataset.triggerSetting,value=Number(input.value);
      if(input.value===''||!input.checkValidity()||!Number.isFinite(value))return;
      if(key==='amplitude')waveAmplitude=value;
      else{triggerSettings={...triggerSettings,[key]:value};audio.configureTrigger(triggerSettings);}
      drawAll(audio.active?lastData:null);return;
    }
    const x=e.target;
    if(x.matches('[data-source]')){
      disarmCapture();
      if(permissionRequest?.audio!==audio)inputRefresh++;
      audio.select(x.value);render();return;
    }
    if(x.matches('[data-preset]')){usePreset(x.value);return}
    if(x.matches('[data-mono-tone]')){monoTone=x.value==='light'?'light':'dark';refreshTheme();return;}
    if(x.matches('[data-theme]')){mode=x.value;autoTheme=false;render();return}
    if(x.matches('[data-auto-theme]')){autoTheme=x.checked;render();return}
    if(x.matches('[data-autohide]')){autoHide=x.checked;root.dataset.hidden='0';render();return}
  });
  root.addEventListener('dragstart',e=>{
    const h=e.target.closest('[data-drag]');if(!h)return;
    draggingId=h.dataset.drag;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',draggingId);
  });
  root.addEventListener('dragover',e=>{if(draggingId&&e.target.closest('[data-meter]'))e.preventDefault()});
  root.addEventListener('drop',e=>{const panel=e.target.closest('[data-meter]');if(!panel||!draggingId)return;e.preventDefault();const id=draggingId;draggingId=null;working(moveModule(layout,id,panel.dataset.meter))});
  root.addEventListener('dragend',()=>{draggingId=null});
  root.addEventListener('keydown',e=>{
    if(!opened||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    const divider=e.target.closest('[data-divider]');
    if(divider&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){
      const left=root.querySelector('[data-meter="'+divider.dataset.left+'"]');
      const right=root.querySelector('[data-meter="'+divider.dataset.right+'"]');
      if(!left||!right)return;
      e.preventDefault();
      const next=resizePair(layout,divider.dataset.left,divider.dataset.right,
        left.getBoundingClientRect().width,right.getBoundingClientRect().width,
        e.key==='ArrowRight'?16:-16);
      if(JSON.stringify(next.weights)!==JSON.stringify(layout.weights))working(next);
    }
    if(e.target.closest('[data-height-resize]')&&(e.key==='ArrowUp'||e.key==='ArrowDown')){
      e.preventDefault();height=clampHeight(height+(e.key==='ArrowUp'?10:-10),win.innerHeight);
      root.querySelector('.vis-dock').style.height=height+'px';
      drawAll(audio.active?lastData:null);
    }
  });
  root.addEventListener('pointerdown',e=>{
    if(!opened||!e.isPrimary)return;
    const divider=e.target.closest('[data-divider]'),heightHandle=e.target.closest('[data-height-resize]');
    if(!divider&&!heightHandle)return;
    e.preventDefault();
    if(heightHandle)drag={type:'height',y:e.clientY,initial:height};
    else{
      const left=root.querySelector('[data-meter="'+divider.dataset.left+'"]'),right=root.querySelector('[data-meter="'+divider.dataset.right+'"]');
      if(!left||!right)return;
      drag={type:'width',left:left.dataset.meter,right:right.dataset.meter,x:e.clientX,leftPx:left.getBoundingClientRect().width,rightPx:right.getBoundingClientRect().width};
    }
    e.target.setPointerCapture?.(e.pointerId);
  });
  root.addEventListener('pointermove',e=>{
    if(!drag)return;
    if(drag.type==='height'){
      height=bound(drag.initial+(drag.y-e.clientY),90,Math.max(90,win.innerHeight*.4));
      root.querySelector('.vis-dock').style.height=clampHeight(height,win.innerHeight)+'px';
    }else{
      const{left,right,leftPx,rightPx,x}=drag;
      const next=resizePair(layout,left,right,leftPx,rightPx,e.clientX-x);
      const pairSum=leftPx+rightPx,ratio=next.weights[left]/(next.weights[left]+next.weights[right]);
      const leftEl=root.querySelector('[data-meter="'+left+'"]'),rightEl=root.querySelector('[data-meter="'+right+'"]');
      leftEl.style.width=(pairSum*ratio)+'px';rightEl.style.width=(pairSum*(1-ratio))+'px';
    }
  });
  root.addEventListener('pointerup',e=>{
    if(!drag)return;
    const current=drag;drag=null;
    if(current.type==='width'){
      const next=resizePair(layout,current.left,current.right,current.leftPx,current.rightPx,e.clientX-current.x);
      if(JSON.stringify(next.weights)!==JSON.stringify(layout.weights))working(next);
      else updateWidths();
    }else drawAll(audio.active?lastData:null);
  });
  root.addEventListener('pointercancel',()=>{if(drag){drag=null;updateWidths()}});
  root.addEventListener('pointerleave',e=>{
    if(!opened||!autoHide||collapsed)return;
    if(e.relatedTarget&&root.contains(e.relatedTarget))return;
    root.dataset.hidden='1';root.classList.add('vis-hidden');
    const activeIndicator=root.querySelector('.vis-capture-indicator');
    if(activeIndicator)activeIndicator.hidden=!audio.active;updateActivity();
  });
  root.addEventListener('pointerenter',()=>{
    if(opened&&autoHide){root.dataset.hidden='0';root.classList.remove('vis-hidden');root.querySelector('.vis-capture-indicator')?.setAttribute('hidden','');refreshVisibility();}
  });
  function resize(){if(!opened)return;const dock=root.querySelector('.vis-dock');if(dock)dock.style.height=clampHeight(height,win.innerHeight)+'px';updateWidths();refreshVisibility();if(!audio.active)drawAll(null)}
  win.addEventListener('resize',resize);
  doc.addEventListener('visibilitychange',()=>{if(opened){renderClock.suspend();refreshVisibility();}});
  const media=win.navigator?.mediaDevices||navigator.mediaDevices;
  media?.addEventListener?.('devicechange',()=>{if(opened)void refreshInputs()});
  win.addEventListener('beforeunload',e=>{const st=recorder.snapshot();if(st.busy||st.frames){e.preventDefault();e.returnValue='';}});
  win.addEventListener('pagehide',()=>{if(opened)stop('Захват остановлен: страница закрыта')});
  icon.addEventListener('click',open);
  icon.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open()}});
  return{open,close,get opened(){return opened}};
}
if(typeof document!=='undefined'&&typeof window!=='undefined')window.addEventListener('DOMContentLoaded',()=>initVisualsApp());

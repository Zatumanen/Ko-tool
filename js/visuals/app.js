import{MODULES,IDS,PRESET_NAMES,makePreset,validLayout,setVisible,moveModule,allocateWidths,resizePair,clampHeight,readWorking,saveWorking,readPresets,savePresets,resolvedPalette}from './layout.js';
import{createVisualsAudio}from './audio.js';
import{onConnectionChange,getConnectedDeviceInfo,isConnected}from '../ep133/device.js';

const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names=Object.fromEntries(MODULES.map(x=>[x.id,x.name]));
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
const bound=(x,a,b)=>Math.min(b,Math.max(a,x));
export function initVisualsApp({documentRef=document,windowRef=window,storage=(()=>{try{return window.localStorage}catch{return null}})()}={}){
  const doc=documentRef,win=windowRef,icon=doc.getElementById('visuals-icon'),root=doc.getElementById('visuals-root');
  if(!icon||!root)return null;
  let opened=false,layout=makePreset(),named=[],activePreset='Balanced',height=150;
  let mode='device',autoTheme=true,sku='',autoHide=false,collapsed=false,picker=false,unsaved=false;
  let status='Источник не выбран',sources=[],drawingFrame=0,audio,draggingId=null,drag=null;
  let captureArmed=false,autoConnecting=false;
  const identity=state=>{
    const info=state?.connected&&!state.unsafe?getConnectedDeviceInfo():null;
    sku=info?.sku==='TE032AS002'&&info?.baseSku==='TE032AS001'?'TE032AS001':info?.sku||'';
    refreshTheme();
  };
  onConnectionChange(identity); // passive subscription; never requests MIDI access
  function currentTheme(){return resolvedPalette(autoTheme?'device':mode,sku)}
  function refreshTheme(){
    if(!opened)return;
    root.classList.remove('vis-theme-app','vis-theme-ep133','vis-theme-ep40','vis-theme-mono');
    root.classList.add('vis-theme-'+currentTheme());
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
    if(!layout.visible.length){collapsed=true;autoHide=false;captureArmed=false;audio?.stop('Захват остановлен: все модули скрыты');stopAnimation()}
    persist();render();
  }
  function usePreset(name){
    const selected=PRESET_NAMES.includes(name)?makePreset(name):named.find(p=>p.name===name)?.layout;
    if(!selected)return;
    layout=validLayout(selected);
    activePreset=name;
    if(!layout.visible.length){collapsed=true;autoHide=false;captureArmed=false;audio.stop();stopAnimation()}
    else collapsed=false;
    persist();render();
  }
  function audioState(next){
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
    else{stopAnimation();drawAll(null)}
  }
  function stopAnimation(){if(drawingFrame){win.cancelAnimationFrame(drawingFrame);drawingFrame=0}}
  function kick(){if(!drawingFrame&&opened&&audio?.active)drawingFrame=win.requestAnimationFrame(tick)}
  function tick(){
    drawingFrame=0;
    if(!opened||!audio.active)return;
    if(!doc.hidden&&!collapsed&&!root.classList.contains('vis-hidden'))drawAll(audio.sample());
    kick();
  }
  function stop(message){captureArmed=false;audio.stop(message);stopAnimation()}
  function open(){
    if(opened){root.querySelector('.vis-dock')?.focus();return}
    opened=true;captureArmed=false;autoConnecting=false;
    layout=readWorking(storage)||makePreset();named=readPresets(storage);
    activePreset='Custom';height=150;autoTheme=true;mode='device';autoHide=false;collapsed=layout.visible.length===0;picker=false;unsaved=false;status='Выберите аудиовход и нажмите START';
    audio=createVisualsAudio({onState:audioState});
    render();
    void refreshInputs();
  }
  function close(){
    if(!opened)return;
    opened=false;stop('Захват остановлен');audio=null;picker=false;unsaved=false;autoHide=false;collapsed=false;
    root.innerHTML='';root.className='';
  }
  async function refreshInputs(){
    if(!opened)return;
    try{
      sources=await audio.inputs();
      const selectedPresent=!!audio.selectedId&&sources.some(item=>item.id===audio.selectedId);
      if(audio.active&&!selectedPresent){
        audio.stop('Выбранный аудиовход отключён');stopAnimation();
      }else if(audio.active){
        status='LIVE · '+(sources.find(item=>item.id===audio.selectedId)?.label||'Аудиовход');
      }else if(captureArmed&&selectedPresent&&!collapsed&&!autoConnecting){
        // Only resume the SAME source after an earlier explicit START in this open session.
        // Browser permission may still require a new user gesture; failure disarms retries.
        autoConnecting=true;
        const ok=await audio.start();autoConnecting=false;
        if(!ok)captureArmed=false;
      }else if(!captureArmed)status=sources.length?'Выберите аудиовход и нажмите START':'Доступных аудиовходов нет';
    }catch(err){sources=[];autoConnecting=false;if(!audio.active)status=err.message||'Нет доступа к аудиоустройствам';}
    if(opened)render();
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
      '<button data-action="refresh" title="Обновить список аудиовходов">↻</button>'+
      '<button data-action="start">▶ START</button><button data-action="stop">■ STOP</button>'+
      '<span class="vis-status" data-audio-status role="status" aria-live="polite">'+escapeHtml(status)+'</span>'+
      '<select class="vis-preset" data-preset aria-label="Компоновка"><option value="Custom">Компоновка</option>'+
      presets.map(n=>'<option value="'+escapeHtml(n)+'">'+escapeHtml(n)+'</option>').join('')+'</select>'+
      '<button data-action="save" title="Сохранить текущую компоновку">SAVE</button>'+
      '<button data-action="delete" title="Удалить выбранный пользовательский пресет">DEL</button>'+
      '<button data-action="modules" aria-expanded="'+String(picker)+'">MODULES</button>'+
      '<select class="vis-theme" data-theme aria-label="Цветовая тема"><option value="device">Под устройство</option><option value="app">Под приложение</option><option value="mono">Ч/Б</option></select>'+
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
      if(index){const divider=el('div','vis-divider');divider.dataset.divider='1';divider.dataset.left=visible[index-1];divider.dataset.right=id;divider.title='Перетащить границу модулей';divider.setAttribute('role','separator');divider.setAttribute('aria-orientation','vertical');divider.setAttribute('tabindex','0');divider.setAttribute('aria-label','Изменить ширину '+labelId(visible[index-1])+' и '+labelId(id));meter.append(divider)}
      const canvas=el('canvas');canvas.setAttribute('aria-label',labelId(id)+' — визуализация входящего аудио');meter.append(canvas);meters.append(meter);
    }
    updateWidths();refreshTheme();drawAll(audio.active?audio.sample():null);
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
    if(id!=='spectrogram'||!data||!canvas.dataset.visHistory)grid(g);
    if(!data){grid(g);print(g,'NO LIVE AUDIO');canvas.dataset.visHistory='';return}
    const{ctx,w,h,color}=g;
    if(id==='waveform'||id==='oscilloscope'){
      grid(g);line(g,data.time,id==='oscilloscope'?1.55:1);
      ctx.fillStyle=color;ctx.font='10px monospace';ctx.fillText(id==='oscilloscope'?'OSC · '+data.sampleRate+' Hz':'TIME · '+data.time.length+' samples',7,11);
    }else if(id==='spectrum'){
      grid(g);const freq=data.frequency, count=Math.max(12,Math.min(64,Math.floor(w/6)));
      ctx.fillStyle=color;
      for(let i=0;i<count;i++){const a=Math.floor(Math.pow(i/count,2)*freq.length),b=Math.max(a+1,Math.floor(Math.pow((i+1)/count,2)*freq.length));let max=0;for(let k=a;k<b;k++)max=Math.max(max,freq[k]);const ht=max/255*(h-18);ctx.fillRect(i*w/count+1,h-ht,w/count-2,ht)}
    }else if(id==='spectrogram'){
      if(!canvas.dataset.visHistory){grid(g);canvas.dataset.visHistory='1'}
      ctx.drawImage(canvas,-2,0,w,h);
      for(let y=0;y<h;y+=2){const p=Math.pow((h-y)/h,2),bin=Math.min(data.frequency.length-1,Math.floor(p*data.frequency.length)),v=data.frequency[bin]/255;ctx.fillStyle=g.bg;ctx.fillRect(w-2,y,2,2);ctx.globalAlpha=v;ctx.fillStyle=color;ctx.fillRect(w-2,y,2,2);ctx.globalAlpha=1}
    }else if(id==='loudness'){
      grid(g);const db=bound(data.db,-90,0);meter(g,(db+60)/60,Math.max(8,h*.47),'RMS '+db.toFixed(1)+' dBFS');
    }else if(id==='output'){
      grid(g);meter(g,data.leftPeak,Math.max(7,h*.2),'L '+Math.round(data.leftPeak*100)+'%');meter(g,data.channelCount===1?data.leftPeak:data.rightPeak,Math.max(30,h*.6),'R '+Math.round(data.rightPeak*100)+'%');
    }else if(id==='stereo'){
      grid(g);if(data.channelCount===1){print(g,'MONO INPUT');return}
      meter(g,data.leftRms*2,Math.max(6,h*.16),'L');meter(g,data.rightRms*2,Math.max(23,h*.48),'R');
      ctx.fillStyle=color;ctx.font='11px monospace';ctx.fillText('CORR '+data.correlation.toFixed(2),8,h-5);
    }
  }
  function drawAll(data){if(!opened)return;for(const panel of root.querySelectorAll('[data-meter]'))paint(panel.dataset.meter,panel.querySelector('canvas'),data)}
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
    if(action==='start'){void audio.start().then(ok=>{captureArmed=!!ok;if(ok)void refreshInputs()}).catch(err=>{captureArmed=false;status=err.message;render()})}
    if(action==='stop')stop();
    if(action==='refresh')void refreshInputs();
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
    const x=e.target;
    if(x.matches('[data-source]')){captureArmed=false;audio.select(x.value);render();return}
    if(x.matches('[data-preset]')){usePreset(x.value);return}
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
      drawAll(audio.active?audio.sample():null);
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
    }else drawAll(audio.active?audio.sample():null);
  });
  root.addEventListener('pointercancel',()=>{if(drag){drag=null;updateWidths()}});
  root.addEventListener('pointerleave',e=>{
    if(!opened||!autoHide||collapsed)return;
    if(e.relatedTarget&&root.contains(e.relatedTarget))return;
    root.dataset.hidden='1';root.classList.add('vis-hidden');
    const activeIndicator=root.querySelector('.vis-capture-indicator');
    if(activeIndicator)activeIndicator.hidden=!audio.active;
  });
  root.addEventListener('pointerenter',()=>{
    if(opened&&autoHide){root.dataset.hidden='0';root.classList.remove('vis-hidden');root.querySelector('.vis-capture-indicator')?.setAttribute('hidden','')}
  });
  function resize(){if(!opened)return;const dock=root.querySelector('.vis-dock');if(dock)dock.style.height=clampHeight(height,win.innerHeight)+'px';updateWidths();if(!audio.active)drawAll(null)}
  win.addEventListener('resize',resize);
  doc.addEventListener('visibilitychange',()=>{if(opened&&audio?.active&&!doc.hidden)kick()});
  const media=win.navigator?.mediaDevices||navigator.mediaDevices;
  media?.addEventListener?.('devicechange',()=>{if(opened)void refreshInputs()});
  win.addEventListener('pagehide',()=>{if(opened)stop('Захват остановлен: страница закрыта')});
  icon.addEventListener('click',open);
  icon.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open()}});
  return{open,close,get opened(){return opened}};
}
if(typeof document!=='undefined'&&typeof window!=='undefined')window.addEventListener('DOMContentLoaded',()=>initVisualsApp());

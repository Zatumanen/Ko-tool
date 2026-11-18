import{createWavRecorder}from './recorder.js';
export function createRecorderUi({root,windowRef=window,canRecord=()=>false}){
  let expanded=false,url=null,depth='16';const win=windowRef;
  const recorder=createWavRecorder({onChange:update});
  const names={idle:'Готов к записи',starting:'Подготовка…',recording:'● ЗАПИСЬ',pausing:'Пауза…',paused:'ПАУЗА',resuming:'Продолжение…',stopping:'Завершение…',done:'ГОТОВО',limited:'ЛИМИТ — запись остановлена',interrupted:'ПРЕРВАНА — только подтверждённый фрагмент'};
  const reasons={'memory-limit':'Достигнут лимит PCM64MiB. Сохраните этот фрагмент перед новой записью.',backpressure:'Приложение не успевало принимать звук. Часть записи не подтверждена.','capture-ended':'Аудиовход остановлен или отключён.','capture-replaced':'Аудиовход заменён.','channel-format':'Формат входа изменился. Перезапустите захват.','invalid-pcm':'Некорректные аудиоданные.','unsupported-format-or-worklet':'Нужны подтверждённый моно/стереовход и браузер с поддержкой аудиозаписи.','module-timeout':'Не удалось подготовить запись.','command-timeout':'Аудиовход не подтвердил команду.','audio-stalled':'Поступление звука остановилось.','chunk-order':'Нарушена последовательность аудиоданных.','final-counters':'Не удалось подтвердить целостность записи.'};
  const timer=seconds=>`${Math.floor(seconds/60)}:${(seconds%60).toFixed(1).padStart(4,'0')}`;
  function revoke(){if(url){win.URL.revokeObjectURL(url);url=null;}}
  function update(){
    const s=recorder.snapshot(),panel=root.querySelector('[data-recorder]'),toggle=root.querySelector('[data-action="recorder"]');
    if(toggle){toggle.textContent=s.busy?'● REC '+timer(s.seconds):'REC';toggle.setAttribute('aria-expanded',String(expanded));}
    if(!panel)return;
    panel.hidden=!expanded;panel.dataset.recState=s.state;panel.dataset.recFrames=String(s.frames);
    panel.dataset.recLeftPeak=String(s.peak[0]??0);
    panel.querySelector('[data-rec-status]').textContent=names[s.state]+(s.reason?' · '+(reasons[s.reason]||'Запись не подтверждена.'):'');
    panel.querySelector('[data-rec-timer]').textContent=timer(s.seconds);
    panel.querySelector('[data-rec-format]').textContent=s.sampleRate?`${s.sampleRate} Hz · ${s.channels===1?'MONO':s.channels===2?'STEREO':'формат неизвестен'} · PCM${s.bits}`:'Один выбранный аудиовход';
    panel.querySelector('[data-rec-limit]').textContent='Лимит PCM64 MiB'+(s.sampleRate&&s.channels?' ≈ '+timer(s.maxBytes/(s.sampleRate*s.channels*s.bits/8)):'')+'. Хранится только в этой вкладке; Blob и предпрослушивание требуют дополнительной памяти.';
    panel.querySelector('[data-rec-level]').textContent=s.peak.length?s.peak.map((p,c)=>(c?'R':'L')+' '+(p>0?(20*Math.log10(p)).toFixed(1):'−∞')+' dBFS'+(s.clip[c]?' CLIP':'')).join(' · '):'INPUT —';
    panel.querySelector('[data-rec-bits]').disabled=s.state!=='idle';
    const enabled={start:canRecord()&&s.state==='idle',pause:s.state==='recording',resume:s.state==='paused',stop:['recording','paused'].includes(s.state),discard:s.state!=='idle',save:['done','limited','interrupted'].includes(s.state)&&s.frames>0};
    for(const [key,value]of Object.entries(enabled))panel.querySelector('[data-rec-command="'+key+'"]').disabled=!value;
    const preview=panel.querySelector('[data-rec-preview]');
    if(s.state==='idle'){preview.pause();preview.removeAttribute('src');preview.hidden=true;revoke();}
    else if(enabled.save){if(!url)url=win.URL.createObjectURL(recorder.result());if(preview.getAttribute('src')!==url)preview.src=url;preview.hidden=false;}
    else preview.hidden=true;
  }
  function mount(){
    const panel=root.ownerDocument.createElement('section');panel.className='vis-recorder';panel.dataset.recorder='';panel.setAttribute('role','region');panel.setAttribute('aria-label','WAV Recorder');
    panel.innerHTML='<header><strong>WAV RECORDER</strong><button data-rec-command="hide" aria-label="Hide WAV Recorder">▁</button></header>'+
      '<label>PCM <select data-rec-bits aria-label="Recording PCM depth"><option value="16">16-bit</option><option value="24">24-bit</option></select></label> '+
      '<output data-rec-timer>0:00.0</output><div data-rec-format></div><div data-rec-level>INPUT —</div>'+
      '<div class="vis-rec-buttons">'+[['start','● RECORD'],['pause','PAUSE'],['resume','RESUME'],['stop','■ STOP'],['save','SAVE WAV'],['discard','DISCARD']].map(([id,label])=>'<button data-rec-command="'+id+'">'+label+'</button>').join('')+'</div>'+
      '<div data-rec-status role="status" aria-live="polite"></div><p data-rec-limit></p><audio data-rec-preview aria-label="Recording preview" controls hidden></audio>';
    root.append(panel);panel.querySelector('[data-rec-bits]').value=depth;update();
  }
  root.addEventListener('change',e=>{if(e.target.matches('[data-rec-bits]'))depth=e.target.value;});
  root.addEventListener('click',e=>{
    const button=e.target.closest('[data-rec-command]');if(!button)return;const command=button.dataset.recCommand;
    if(command==='hide'){expanded=false;update();return;}
    if(command==='save'&&url){const link=root.ownerDocument.createElement('a');link.href=url;link.download='KO-Tool-Recording-'+new Date().toISOString().replace(/[:.]/g,'-')+'.wav';link.click();return;}
    if(command==='discard'){recorder.discard();return;}
    void (command==='start'?recorder.start(Number(depth)):recorder[command]?.()).catch(()=>{update();});
  });
  return{recorder,mount,update,toggle(){expanded=!expanded;update();},
    canClose:()=>{const s=recorder.snapshot();return!s.busy&&!s.frames||win.confirm('Остановить и закрыть Visuals? Запись в этой вкладке будет удалена. Сначала сохраните WAV, если он нужен.');},
    clear(){expanded=false;recorder.discard();revoke();}
  };
}

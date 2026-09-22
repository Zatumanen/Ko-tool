import{outputFileName}from './output-name.js';

export function openPreview(item,{state,saveBlob,esc,createAudioContext}){
  const old=document.getElementById('preview-window');
  if(old) old.remove();

  const w=document.createElement('div');
  w.id='preview-window';
  w.className='preview-window';
  const result=item.result||{};
  const quality={cd:'CD',sp8:'E-mu SP-1200',sk:'Casio SK-1'}[item.fidelity]||'CD';
  const ch=result.channels===1?'MONO':'STEREO';
  const rate=result.sampleRate||44100;
  const bits=result.bitDepth||16;
  const kbps=Math.round(rate*bits*(result.channels||2)/1000);
  const mode=item.playmode==='loop'?'LOOP':'ONE';

  w.innerHTML=`
    <div class="preview-title" title="Drag to move">
      <span class="preview-brand">K.O. Play II</span>
      <div class="window-controls">
        <button type="button" class="preview-minimize" aria-label="Minimize">_</button>
        
        <button type="button" class="preview-close" aria-label="Close">×</button>
      </div>
    </div>
    <div class="preview-menu">
      <button type="button" class="preview-menu-button preview-file-menu">File</button><button type="button" class="preview-menu-button preview-options-menu">Options</button>
    </div>
    <div class="preview-body">
      <div class="preview-file" title="${esc(item.file.name)}">${esc(outputFileName(item.file.name))}</div>
      <div class="preview-main">
        <div class="preview-display">
          <div class="display-stat"><span>TRACK</span><b>1</b></div>
          <div class="display-stat"><span>MIN</span><b class="preview-min">00</b></div>
          <div class="display-stat"><span>SEC</span><b class="preview-sec">00</b></div>
          <div class="display-mode">
            <span>MODE</span>
            <b>${rate/1000}kHz ${kbps}Kbit/s</b>
            <b>${quality} ${ch} ${mode}</b>
          </div>
          <button type="button" class="preview-download display-download" title="Download WAV" aria-label="Download WAV">↓</button>
        </div>
        <div class="preview-progress" role="slider" aria-label="Playback position" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0">
          <div class="preview-progress-fill"></div>
        </div>
        <div class="preview-controls">
          <button type="button" class="preview-rewind" title="Go to beginning">|&lt;&lt;</button>
          <button type="button" class="preview-stop" title="Stop">■</button>
          <button type="button" class="preview-play" title="Play / pause">▶</button>
          <button type="button" class="preview-forward" title="Go to end">&gt;&gt;|</button>
          <button type="button" class="preview-back5" title="Rewind 5 seconds">◀ 5s</button>
          <button type="button" class="preview-forward5" title="Forward 5 seconds">5s ▶</button>
        </div>
        <div class="preview-options-popup" hidden>
        <div class="preview-options-row"><b>PLAYBACK</b><button type="button" data-rate="1">1×</button><button type="button" data-rate="0.5" class="selected">0.5×</button></div>
        <div class="preview-options-row"><b>VOL</b><input type="range" min="0" max="1" step="0.01" value="1" aria-label="Volume"></div>
      </div>
      </div>

    </div>`;
  document.body.appendChild(w);

  const currentMin=w.querySelector('.preview-min');
  const currentSec=w.querySelector('.preview-sec');
  const fill=w.querySelector('.preview-progress-fill');
  const bar=w.querySelector('.preview-progress');
  const play=w.querySelector('.preview-play');
  const volume=w.querySelector('.preview-options-popup input');
  const ctx=state.ctx||createAudioContext();
  state.ctx=ctx;

  let buffer=null;
  let source=null;
  let gain=null;
  let ratePlay=.5;
  let offset=0;
  let startedAt=0;
  let playing=false;
  let raf=0;

  const filename=()=>item.file.name.replace(/\\.[^.]+$/,'')+'_x2.wav';
  const fmt=s=>{
    s=Number.isFinite(s)?Math.max(0,s):0;
    return {m:String(Math.floor(s/60)).padStart(2,'0'),s:String(Math.floor(s%60)).padStart(2,'0')};
  };
  const pos=()=>{
    if(!buffer)return 0;
    return playing?Math.min(buffer.duration,offset+(ctx.currentTime-startedAt)*ratePlay):Math.min(buffer.duration,offset);
  };
  const sync=()=>{
    const p=fmt(pos());
    const d=buffer?.duration||0;
    const ratio=d?Math.min(1,pos()/d):0;
    currentMin.textContent=p.m;
    currentSec.textContent=p.s;
    fill.style.width=(ratio*100)+'%';
    bar.setAttribute('aria-valuenow',String(Math.round(ratio*100)));
    play.textContent=playing?'Ⅱ':'▶';
    play.title=playing?'Pause':'Play';
    if(playing)raf=requestAnimationFrame(sync);
  };
  const stopSource=()=>{
    if(source){
      source.onended=null;
      try{source.stop()}catch(e){}
      source.disconnect();
      source=null;
    }
    if(gain){gain.disconnect();gain=null}
    playing=false;
    cancelAnimationFrame(raf);
  };
  const start=()=>{
    if(!buffer)return;
    if(offset>=buffer.duration)offset=0;
    ctx.resume?.();
    source=ctx.createBufferSource();
    source.buffer=buffer;
    source.playbackRate.value=ratePlay;
    gain=ctx.createGain();
    gain.gain.value=Number(volume.value);
    source.connect(gain).connect(ctx.destination);
    startedAt=ctx.currentTime;
    playing=true;
    source.onended=()=>{
      if(!playing)return;
      if(item.playmode==='loop'){
        offset=0;
        stopSource();
        start();
        return;
      }
      offset=buffer.duration;
      stopSource();
      sync();
    };
    source.start(0,offset);
    sync();
  };
  const seek=p=>{
    if(!buffer)return;
    const was=playing;
    stopSource();
    offset=Math.max(0,Math.min(buffer.duration,p));
    sync();
    if(was)start();
  };
  const barSeek=e=>{
    if(!buffer)return;
    const r=bar.getBoundingClientRect();
    seek((e.clientX-r.left)/r.width*buffer.duration);
  };
  const togglePlay=()=>{
    if(!buffer)return;
    if(playing){
      offset=pos();
      stopSource();
      sync();
    }else start();
  };
  const close=()=>{
    stopSource();
    w.remove();
    window.removeEventListener('keydown',onKey);
  };
  const onKey=e=>{
    if(!document.body.contains(w))return;
    if(e.key==='Escape'){e.preventDefault();close();return}
    if(e.target.matches('input,button'))return;
    if(e.code==='Space'){e.preventDefault();togglePlay();return}
    if(e.key==='ArrowLeft'){e.preventDefault();seek(pos()-5);return}
    if(e.key==='ArrowRight'){e.preventDefault();seek(pos()+5);return}
    if(e.key==='Home'){e.preventDefault();seek(0);return}
    if(e.key==='End'){e.preventDefault();seek(buffer?.duration||0)}
  };

  play.onclick=togglePlay;
  w.querySelector('.preview-stop').onclick=()=>{stopSource();offset=0;sync()};
  w.querySelector('.preview-rewind').onclick=()=>seek(0);
  w.querySelector('.preview-forward').onclick=()=>seek(buffer?.duration||0);
  w.querySelector('.preview-back5').onclick=()=>seek(pos()-5);
  w.querySelector('.preview-forward5').onclick=()=>seek(pos()+5);
  bar.onclick=barSeek;
  bar.onkeydown=e=>{
    if(e.key==='ArrowLeft'){e.preventDefault();seek(pos()-5)}
    if(e.key==='ArrowRight'){e.preventDefault();seek(pos()+5)}
    if(e.key==='Home'){e.preventDefault();seek(0)}
    if(e.key==='End'){e.preventDefault();seek(buffer?.duration||0)}
  };
  w.querySelectorAll('.preview-options-popup [data-rate]').forEach(b=>b.onclick=()=>{
    const p=pos(),was=playing;
    stopSource();
    offset=p;
    ratePlay=Number(b.dataset.rate);
    w.querySelectorAll('[data-rate]').forEach(x=>x.classList.toggle('selected',x===b));
    sync();
    if(was)start();
  });
  volume.oninput=e=>{if(gain)gain.gain.value=Number(e.target.value)};
  w.querySelector('.display-download').onclick=()=>saveBlob(item.result.blob,filename());
  w.querySelector('.preview-close').onclick=close;
  w.querySelector('.preview-minimize').onclick=()=>w.classList.toggle('preview-minimized');
  const optionsPopup=w.querySelector('.preview-options-popup');
  w.querySelector('.preview-options-menu').onclick=()=>{optionsPopup.hidden=!optionsPopup.hidden};

  let drag=false,dx=0,dy=0;
  const title=w.querySelector('.preview-title');
  title.addEventListener('pointerdown',e=>{
    if(e.target.closest('button'))return;
    drag=true;
    const r=w.getBoundingClientRect();
    dx=e.clientX-r.left;dy=e.clientY-r.top;
    w.style.transform='none';
    title.setPointerCapture?.(e.pointerId);
  });
  title.addEventListener('pointermove',e=>{
    if(!drag)return;
    w.style.left=Math.max(0,Math.min(window.innerWidth-w.offsetWidth,e.clientX-dx))+'px';
    w.style.top=Math.max(0,Math.min(window.innerHeight-w.offsetHeight,e.clientY-dy))+'px';
  });
  title.addEventListener('pointerup',()=>drag=false);
  title.addEventListener('pointercancel',()=>drag=false);

  window.addEventListener('keydown',onKey);

  Promise.resolve(item.result?.buffer).then(decoded=>{
    if(!decoded)throw Error('Processed audio buffer is unavailable.');
    buffer=decoded;
    sync();
  }).catch(e=>{
    w.querySelector('.preview-display').setAttribute('data-error','Preview error: '+(e?.message||e));
  });
}

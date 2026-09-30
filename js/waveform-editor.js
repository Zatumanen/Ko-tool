import{
  clampWaveformSelection,buildWaveformPeaks,gainDbToLinear,renderWaveformEdit
}from './audio/waveform-editor.js?v=20260930-5';

const number=value=>Number.isFinite(Number(value))?Number(value):0;
const formatTime=value=>{
  const seconds=Math.max(0,number(value));
  const minutes=Math.floor(seconds/60);
  return String(minutes).padStart(2,'0')+':'+(seconds%60).toFixed(3).padStart(6,'0');
};
const escapeHtml=value=>String(value??'').replace(/[&<>\"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'
}[char]));

export function openWaveformEditor(item,{
  state,
  createAudioContext,
  onApply,
  showError=()=>{}
}={}){
  const old=document.getElementById('waveform-editor');
  if(old)old.remove();
  const sourceBuffer=item?.result?.buffer;
  if(!sourceBuffer?.getChannelData)throw new Error('Processed audio buffer is unavailable.');

  const editor=document.createElement('div');
  editor.id='waveform-editor';
  editor.className='waveform-editor';
  editor.setAttribute('role','dialog');
  editor.setAttribute('aria-modal','true');
  editor.setAttribute('aria-label','Waveform trim editor');
  editor.innerHTML=`
    <div class="waveform-editor-window">
      <div class="title-bar waveform-editor-title">
        <span>WAVEFORM / TRIM EDITOR</span>
        <button type="button" data-waveform-close aria-label="Close">×</button>
      </div>
      <div class="waveform-editor-body">
        <div class="waveform-editor-file">${escapeHtml(item?.file?.name||'AUDIO')}</div>
        <div class="waveform-canvas-wrap">
          <canvas class="waveform-canvas" data-waveform-canvas aria-label="Waveform. Drag to select crop range."></canvas>
          <div class="waveform-help">DRAG = SELECT · CLICK = PLAYHEAD</div>
        </div>
        <div class="waveform-readout">
          <span>PLAYHEAD <b data-waveform-playhead>00:00.000</b></span>
          <span>SELECTION <b data-waveform-duration>00:00.000</b></span>
          <span>OUTPUT <b data-waveform-output>00:00.000</b></span>
        </div>
        <div class="waveform-range-row">
          <label>START <input data-waveform-start type="number" min="0" step="0.001"></label>
          <label>END <input data-waveform-end type="number" min="0" step="0.001"></label>
          <button type="button" data-waveform-trim-start>TRIM START</button>
          <button type="button" data-waveform-trim-end>TRIM END</button>
          <button type="button" data-waveform-full>FULL RANGE</button>
        </div>
        <div class="waveform-tools">
          <label>ZOOM <input data-waveform-zoom type="range" min="1" max="16" step="1" value="1"><b data-waveform-zoom-label>1×</b></label>
          <label>GAIN <input data-waveform-gain type="range" min="-24" max="12" step="0.5" value="0"><b data-waveform-gain-label>0 dB</b></label>
          <label class="waveform-normalize"><input data-waveform-normalize type="checkbox"> NORMALIZE TO PEAK</label>
        </div>
        <div class="waveform-actions">
          <button type="button" data-waveform-play>▶ PLAY SELECTION</button>
          <button type="button" data-waveform-stop>■ STOP</button>
          <button type="button" data-waveform-reset>RESET</button>
          <button type="button" data-waveform-apply>APPLY CROP</button>
          <button type="button" data-waveform-cancel>CANCEL</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(editor);

  const canvas=editor.querySelector('[data-waveform-canvas]');
  const startInput=editor.querySelector('[data-waveform-start]');
  const endInput=editor.querySelector('[data-waveform-end]');
  const playheadEl=editor.querySelector('[data-waveform-playhead]');
  const durationEl=editor.querySelector('[data-waveform-duration]');
  const outputEl=editor.querySelector('[data-waveform-output]');
  const zoomInput=editor.querySelector('[data-waveform-zoom]');
  const zoomLabel=editor.querySelector('[data-waveform-zoom-label]');
  const gainInput=editor.querySelector('[data-waveform-gain]');
  const gainLabel=editor.querySelector('[data-waveform-gain-label]');
  const normalizeInput=editor.querySelector('[data-waveform-normalize]');
  const applyButton=editor.querySelector('[data-waveform-apply]');

  const totalDuration=sourceBuffer.duration||sourceBuffer.length/sourceBuffer.sampleRate;
  let selection={start:0,end:totalDuration,duration:totalDuration,totalDuration};
  let playhead=0;
  let zoom=1;
  let gainDb=0;
  let normalize=false;
  let dragStart=null;
  let dragStartX=0;
  let audioSource=null;
  let gainNode=null;
  let raf=0;
  let playbackStartedAt=0;
  let playbackOffset=0;
  let ctx=state?.ctx||null;
  let resizeObserver=null;

  const viewRange=()=>{
    const width=Math.max(.001,totalDuration/zoom);
    if(width>=totalDuration)return{start:0,end:totalDuration};
    const center=Math.max(0,Math.min(totalDuration,playhead));
    let start=center-width/2;
    start=Math.max(0,Math.min(totalDuration-width,start));
    return{start,end:start+width};
  };
  const timeAtClientX=clientX=>{
    const rect=canvas.getBoundingClientRect();
    const ratio=rect.width?Math.max(0,Math.min(1,(clientX-rect.left)/rect.width)):0;
    const view=viewRange();
    return view.start+(view.end-view.start)*ratio;
  };
  const selectedPeak=()=>{
    const first=Math.max(0,Math.floor(selection.start*sourceBuffer.sampleRate));
    const last=Math.min(sourceBuffer.length,Math.max(first+1,Math.ceil(selection.end*sourceBuffer.sampleRate)));
    let peak=0;
    for(let channel=0;channel<sourceBuffer.numberOfChannels;channel++){
      const data=sourceBuffer.getChannelData(channel);
      for(let frame=first;frame<last;frame++)peak=Math.max(peak,Math.abs(data[frame]||0));
    }
    return peak;
  };
  const previewGain=()=>{
    const manual=gainDbToLinear(gainDb);
    if(!normalize)return manual;
    const peak=selectedPeak()*manual;
    return peak>0?manual/peak:manual;
  };
  const stopPlayback=()=>{
    if(audioSource){
      audioSource.onended=null;
      try{audioSource.stop();}catch{}
      try{audioSource.disconnect();}catch{}
      audioSource=null;
    }
    if(gainNode){try{gainNode.disconnect();}catch{}gainNode=null;}
    cancelAnimationFrame(raf);
  };
  const currentPlaybackTime=()=>{
    if(!audioSource||!ctx)return playhead;
    return Math.min(selection.end,playbackOffset+(ctx.currentTime-playbackStartedAt));
  };
  const playbackTick=()=>{
    if(!audioSource)return;
    playhead=currentPlaybackTime();
    draw();
    if(playhead>=selection.end){stopPlayback();return;}
    raf=requestAnimationFrame(playbackTick);
  };
  const playSelection=()=>{
    stopPlayback();
    ctx=ctx||state?.ctx||createAudioContext?.();
    if(!ctx)throw new Error('Web Audio API is not supported in this browser.');
    if(state)state.ctx=ctx;
    ctx.resume?.();
    if(playhead<selection.start||playhead>=selection.end)playhead=selection.start;
    audioSource=ctx.createBufferSource();
    gainNode=ctx.createGain();
    audioSource.buffer=sourceBuffer;
    gainNode.gain.value=previewGain();
    audioSource.connect(gainNode).connect(ctx.destination);
    playbackOffset=playhead;
    playbackStartedAt=ctx.currentTime;
    audioSource.onended=()=>{audioSource=null;cancelAnimationFrame(raf);playhead=selection.end;draw();};
    audioSource.start(0,playbackOffset,Math.max(0.001,selection.end-playbackOffset));
    raf=requestAnimationFrame(playbackTick);
  };
  const syncInputs=()=>{
    startInput.max=String(totalDuration);
    endInput.max=String(totalDuration);
    startInput.value=selection.start.toFixed(3);
    endInput.value=selection.end.toFixed(3);
    playheadEl.textContent=formatTime(playhead);
    durationEl.textContent=formatTime(selection.duration);
    outputEl.textContent=formatTime(selection.duration);
    zoomLabel.textContent=zoom+'×';
    gainLabel.textContent=(gainDb>0?'+':'')+gainDb.toFixed(gainDb%1?1:0)+' dB';
  };
  const draw=()=>{
    syncInputs();
    const ratio=Math.max(1,window.devicePixelRatio||1);
    const width=Math.max(320,Math.round(canvas.clientWidth||720));
    const height=Math.max(120,Math.round(canvas.clientHeight||180));
    if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){
      canvas.width=Math.round(width*ratio);
      canvas.height=Math.round(height*ratio);
    }
    const context=canvas.getContext('2d');
    context.setTransform(ratio,0,0,ratio,0,0);
    context.clearRect(0,0,width,height);
    context.fillStyle='#fff';
    context.fillRect(0,0,width,height);
    const view=viewRange();
    const peaks=buildWaveformPeaks(sourceBuffer,{start:view.start,end:view.end,bins:width});
    context.strokeStyle='#777';
    context.beginPath();context.moveTo(0,height/2);context.lineTo(width,height/2);context.stroke();
    const xForTime=time=>(time-view.start)/(view.end-view.start)*width;
    const selLeft=Math.max(0,xForTime(selection.start));
    const selRight=Math.min(width,xForTime(selection.end));
    if(selRight>selLeft){
      context.fillStyle='rgba(0,0,128,.13)';
      context.fillRect(selLeft,0,selRight-selLeft,height);
    }
    context.strokeStyle='#111';
    context.beginPath();
    for(let index=0;index<peaks.length;index++){
      const peak=peaks[index],x=index+.5;
      context.moveTo(x,height/2-peak.max*(height*.44));
      context.lineTo(x,height/2-peak.min*(height*.44));
    }
    context.stroke();
    const px=xForTime(playhead);
    if(px>=0&&px<=width){
      context.strokeStyle='#c00';
      context.beginPath();context.moveTo(px,0);context.lineTo(px,height);context.stroke();
    }
    context.strokeStyle='#000080';
    for(const time of [selection.start,selection.end]){
      const x=xForTime(time);
      if(x>=0&&x<=width){context.beginPath();context.moveTo(x,0);context.lineTo(x,height);context.stroke();}
    }
  };
  const setSelection=(start,end)=>{
    selection=clampWaveformSelection(sourceBuffer,start,end);
    playhead=Math.max(selection.start,Math.min(selection.end,playhead));
    draw();
  };
  const applyInputs=()=>{
    setSelection(number(startInput.value),number(endInput.value));
  };
  const close=()=>{
    stopPlayback();
    window.removeEventListener('keydown',onKey);
    resizeObserver?.disconnect?.();
    editor.remove();
  };
  const reset=()=>{
    stopPlayback();
    selection=clampWaveformSelection(sourceBuffer,0,totalDuration);
    playhead=0;zoom=1;gainDb=0;normalize=false;
    zoomInput.value='1';gainInput.value='0';normalizeInput.checked=false;
    draw();
  };
  const onKey=event=>{
    if(!editor.isConnected)return;
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.target.matches('input,button'))return;
    if(event.code==='Space'){event.preventDefault();playSelection();}
  };

  canvas.addEventListener('pointerdown',event=>{
    stopPlayback();
    dragStart=timeAtClientX(event.clientX);
    dragStartX=event.clientX;
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener('pointermove',event=>{
    if(dragStart==null)return;
    const current=timeAtClientX(event.clientX);
    if(Math.abs(event.clientX-dragStartX)<3)return;
    setSelection(dragStart,current);
  });
  canvas.addEventListener('pointerup',event=>{
    if(dragStart==null)return;
    const current=timeAtClientX(event.clientX);
    if(Math.abs(event.clientX-dragStartX)<3){
      playhead=current;
      draw();
    }else setSelection(dragStart,current);
    dragStart=null;
  });
  canvas.addEventListener('pointercancel',()=>{dragStart=null;});

  startInput.addEventListener('change',applyInputs);
  endInput.addEventListener('change',applyInputs);
  editor.querySelector('[data-waveform-trim-start]').onclick=()=>setSelection(playhead,selection.end);
  editor.querySelector('[data-waveform-trim-end]').onclick=()=>setSelection(selection.start,playhead);
  editor.querySelector('[data-waveform-full]').onclick=()=>setSelection(0,totalDuration);
  zoomInput.oninput=()=>{zoom=Math.max(1,Math.round(number(zoomInput.value)||1));draw();};
  gainInput.oninput=()=>{gainDb=number(gainInput.value);draw();};
  normalizeInput.onchange=()=>{normalize=normalizeInput.checked;draw();};
  editor.querySelector('[data-waveform-play]').onclick=()=>{try{playSelection();}catch(error){showError(error?.message||error);}};
  editor.querySelector('[data-waveform-stop]').onclick=()=>{stopPlayback();draw();};
  editor.querySelector('[data-waveform-reset]').onclick=reset;
  editor.querySelector('[data-waveform-cancel]').onclick=close;
  editor.querySelector('[data-waveform-close]').onclick=close;
  applyButton.onclick=async()=>{
    if(applyButton.disabled)return;
    applyButton.disabled=true;
    const originalText=applyButton.textContent;
    applyButton.textContent='APPLYING...';
    stopPlayback();
    try{
      const edit=await renderWaveformEdit(sourceBuffer,{
        start:selection.start,end:selection.end,gainDb,normalize,
        playmode:item?.playmode||'oneshot'
      });
      await onApply?.(edit,{
        selection:{...selection},gainDb,normalize
      });
      close();
    }catch(error){
      showError(error?.message||error);
      applyButton.disabled=false;
      applyButton.textContent=originalText;
    }
  };

  window.addEventListener('keydown',onKey);
  resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(draw):null;
  resizeObserver?.observe(canvas);
  draw();
  return Object.freeze({close,reset,draw});
}

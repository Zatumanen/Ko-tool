import{buildWaveformPeaks,gainDbToLinear,renderWaveformEdit}from './audio/waveform-editor.js?v=20261003-2';
import{renderChopWavs}from './audio/chop.js?v=20261003-2';
import{createWaveformModel}from './audio/waveformModel.js?v=20261003-2';

const number=value=>Number.isFinite(Number(value))?Number(value):0;
const formatTime=value=>{
  const seconds=Math.max(0,number(value));
  const minutes=Math.floor(seconds/60);
  return String(minutes).padStart(2,'0')+':'+(seconds%60).toFixed(3).padStart(6,'0');
};
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[char]));

export function openSharedWaveformEditor(source,{
  state,
  createAudioContext,
  onApply,
  onExportChops,
  onClose=()=>{},
  showError=()=>{},
  title='WAVEFORM / TRIM EDITOR',
  applyLabel='APPLY CROP',
  exportLabel='EXPORT CHOPS',
  allowApply=true,
  allowExportChops=true
}={}){
  const old=document.getElementById('waveform-editor');
  if(old)old.remove();
  const sourceBuffer=source?.buffer;
  if(!sourceBuffer?.getChannelData)throw new Error('Audio buffer is unavailable.');
  const sourceName=source?.name||'AUDIO';
  const sourcePlaymode=source?.playmode||source?.metadata?.['sound.playmode']||'oneshot';
  const sourceMetadata=source?.metadata&&typeof source.metadata==='object'?source.metadata:null;
  const model=createWaveformModel(sourceBuffer);

  const editor=document.createElement('div');
  editor.id='waveform-editor';
  editor.className='waveform-editor';
  editor.setAttribute('role','dialog');
  editor.setAttribute('aria-modal','true');
  editor.setAttribute('aria-label','Waveform trim editor');
  editor.innerHTML=`
    <div class="waveform-editor-window">
      <div class="title-bar waveform-editor-title">
        <span>${escapeHtml(title)}</span>
        <button type="button" data-waveform-close aria-label="Close">×</button>
      </div>
      <div class="waveform-editor-body">
        <div class="waveform-editor-file">${escapeHtml(sourceName)}</div>
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
        <div class="waveform-chop-panel">
          <div class="waveform-chop-head"><b>CHOP</b><span data-chop-status>1 SLICE</span></div>
          <div class="waveform-chop-controls">
            <div class="waveform-chop-modes" role="group" aria-label="Chop mode">
              <button type="button" data-chop-mode="manual" class="active">MANUAL</button>
              <button type="button" data-chop-mode="transients">TRANSIENTS</button>
              <button type="button" data-chop-mode="even">EVEN</button>
            </div>
            <label>SLICES <input data-chop-target type="number" min="1" max="64" step="1" value="8"></label>
            <button type="button" data-chop-add>+ MARKER</button>
            <button type="button" data-chop-remove disabled>- MARKER</button>
            <button type="button" data-chop-clear>CLEAR</button>
            <button type="button" data-chop-export>${escapeHtml(exportLabel)}</button>
          </div>
          <div class="waveform-chop-help">DOUBLE-CLICK = ADD MARKER · DRAG MARKER = MOVE · DELETE = REMOVE</div>
        </div>
        <div class="waveform-actions">
          <button type="button" data-waveform-play>▶ PLAY SELECTION</button>
          <button type="button" data-waveform-stop>■ STOP</button>
          <button type="button" data-waveform-reset>RESET</button>
          <button type="button" data-waveform-apply>${escapeHtml(applyLabel)}</button>
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
  const chopStatus=editor.querySelector('[data-chop-status]');
  const chopTargetInput=editor.querySelector('[data-chop-target]');
  const chopRemoveButton=editor.querySelector('[data-chop-remove]');
  const chopExportButton=editor.querySelector('[data-chop-export]');
  const chopModeButtons=[...editor.querySelectorAll('[data-chop-mode]')];
  if(!allowApply)applyButton.hidden=true;
  if(!allowExportChops)chopExportButton.hidden=true;

  let dragStart=null,dragStartX=0,markerDragIndex=null;
  let audioSource=null,gainNode=null,raf=0,playbackStartedAt=0,playbackOffset=0;
  let ctx=state?.ctx||null,resizeObserver=null,closed=false;
  const current=()=>model.getState();

  const timeAtClientX=clientX=>{
    const rect=canvas.getBoundingClientRect(),ratio=rect.width?Math.max(0,Math.min(1,(clientX-rect.left)/rect.width)):0;
    const view=model.viewRange();
    return view.start+(view.end-view.start)*ratio;
  };
  const closestCutIndex=frame=>{
    const cuts=current().chop.cuts;
    let best=-1,distance=Infinity;
    for(let index=1;index<cuts.length;index++){
      const next=Math.abs(cuts[index]-frame);
      if(next<distance){distance=next;best=index;}
    }
    return best;
  };
  const cutIndexAtClientX=clientX=>{
    const rect=canvas.getBoundingClientRect(),view=model.viewRange(),cuts=current().chop.cuts;
    let best=-1,distance=Infinity;
    for(let index=1;index<cuts.length;index++){
      const time=cuts[index]/sourceBuffer.sampleRate;
      if(time<view.start||time>view.end)continue;
      const x=rect.left+(time-view.start)/(view.end-view.start)*rect.width;
      const next=Math.abs(clientX-x);
      if(next<distance){distance=next;best=index;}
    }
    return distance<=8?best:-1;
  };
  const previewGain=()=>{
    const snapshot=current(),manual=gainDbToLinear(snapshot.gainDb);
    if(!snapshot.normalize)return manual;
    const peak=model.getSelectionPeak()*manual;
    return peak>0?manual/peak:manual;
  };
  const stopPlayback=()=>{
    if(audioSource){audioSource.onended=null;try{audioSource.stop();}catch{}try{audioSource.disconnect();}catch{}audioSource=null;}
    if(gainNode){try{gainNode.disconnect();}catch{}gainNode=null;}
    cancelAnimationFrame(raf);
  };
  const currentPlaybackTime=()=>{
    const snapshot=current();
    if(!audioSource||!ctx)return snapshot.playhead;
    return Math.min(snapshot.selection.end,playbackOffset+(ctx.currentTime-playbackStartedAt));
  };
  const playbackTick=()=>{
    if(!audioSource)return;
    model.setPlayhead(currentPlaybackTime());
    draw();
    if(current().playhead>=current().selection.end){stopPlayback();return;}
    raf=requestAnimationFrame(playbackTick);
  };
  const playSelection=()=>{
    stopPlayback();
    ctx=ctx||state?.ctx||createAudioContext?.();
    if(!ctx)throw new Error('Web Audio API is not supported in this browser.');
    if(state)state.ctx=ctx;
    ctx.resume?.();
    let snapshot=current();
    if(snapshot.playhead<snapshot.selection.start||snapshot.playhead>=snapshot.selection.end){
      model.setPlayhead(snapshot.selection.start);snapshot=current();
    }
    audioSource=ctx.createBufferSource();gainNode=ctx.createGain();
    audioSource.buffer=sourceBuffer;gainNode.gain.value=previewGain();
    audioSource.connect(gainNode).connect(ctx.destination);
    playbackOffset=snapshot.playhead;playbackStartedAt=ctx.currentTime;
    audioSource.onended=()=>{audioSource=null;cancelAnimationFrame(raf);model.setPlayhead(current().selection.end);draw();};
    audioSource.start(0,playbackOffset,Math.max(.001,snapshot.selection.end-playbackOffset));
    raf=requestAnimationFrame(playbackTick);
  };
  const updateChopUi=()=>{
    const snapshot=current(),ranges=model.getChopRanges();
    chopStatus.textContent=ranges.length+' '+(ranges.length===1?'SLICE':'SLICES');
    chopTargetInput.value=String(snapshot.chop.target);
    chopModeButtons.forEach(button=>button.classList.toggle('active',button.dataset.chopMode===snapshot.chop.mode));
    chopRemoveButton.disabled=!(snapshot.chop.focusedCutIndex>0&&snapshot.chop.focusedCutIndex<snapshot.chop.cuts.length);
    chopExportButton.disabled=!allowExportChops||snapshot.chop.cuts.length<2||typeof onExportChops!=='function';
  };
  const syncInputs=()=>{
    const snapshot=current();
    startInput.max=String(snapshot.totalDuration);endInput.max=String(snapshot.totalDuration);
    startInput.value=snapshot.selection.start.toFixed(3);endInput.value=snapshot.selection.end.toFixed(3);
    playheadEl.textContent=formatTime(snapshot.playhead);durationEl.textContent=formatTime(snapshot.selection.duration);outputEl.textContent=formatTime(snapshot.selection.duration);
    zoomInput.value=String(snapshot.zoom);zoomLabel.textContent=snapshot.zoom+'×';
    gainInput.value=String(snapshot.gainDb);gainLabel.textContent=(snapshot.gainDb>0?'+':'')+snapshot.gainDb.toFixed(snapshot.gainDb%1?1:0)+' dB';
    normalizeInput.checked=snapshot.normalize;updateChopUi();
  };
  function draw(){
    if(closed)return;
    syncInputs();
    const snapshot=current(),ratio=Math.max(1,window.devicePixelRatio||1),width=Math.max(320,Math.round(canvas.clientWidth||720)),height=Math.max(120,Math.round(canvas.clientHeight||180));
    if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);}
    const context=canvas.getContext('2d');context.setTransform(ratio,0,0,ratio,0,0);context.clearRect(0,0,width,height);context.fillStyle='#fff';context.fillRect(0,0,width,height);
    const view=model.viewRange(),peaks=buildWaveformPeaks(sourceBuffer,{start:view.start,end:view.end,bins:width}),xForTime=time=>(time-view.start)/(view.end-view.start)*width;
    context.strokeStyle='#777';context.beginPath();context.moveTo(0,height/2);context.lineTo(width,height/2);context.stroke();
    const selLeft=Math.max(0,xForTime(snapshot.selection.start)),selRight=Math.min(width,xForTime(snapshot.selection.end));
    if(selRight>selLeft){context.fillStyle='rgba(0,0,128,.13)';context.fillRect(selLeft,0,selRight-selLeft,height);}
    context.strokeStyle='#111';context.beginPath();
    for(let index=0;index<peaks.length;index++){const peak=peaks[index],x=index+.5;context.moveTo(x,height/2-peak.max*(height*.44));context.lineTo(x,height/2-peak.min*(height*.44));}
    context.stroke();
    const ranges=model.getChopRanges(),activeSlice=ranges.findIndex(range=>snapshot.playhead>=range.start&&snapshot.playhead<range.end);
    for(const range of ranges){
      const left=Math.max(0,xForTime(range.start)),right=Math.min(width,xForTime(range.end));if(right<=left)continue;
      if(range.index===activeSlice){context.fillStyle='rgba(255,217,74,.12)';context.fillRect(left,0,right-left,height);}
      if(right-left>26){context.fillStyle='#9a3b12';context.font='700 9px "Courier New"';context.fillText(String(range.index+1).padStart(2,'0'),left+4,12);}
    }
    for(let index=1;index<snapshot.chop.cuts.length;index++){
      const x=xForTime(snapshot.chop.cuts[index]/sourceBuffer.sampleRate);if(x<0||x>width)continue;
      context.strokeStyle=index===snapshot.chop.focusedCutIndex?'#9a5b00':'#e85a25';context.lineWidth=index===snapshot.chop.focusedCutIndex?2:1;
      context.beginPath();context.moveTo(x,0);context.lineTo(x,height);context.stroke();
    }
    context.lineWidth=1;
    const px=xForTime(snapshot.playhead);if(px>=0&&px<=width){context.strokeStyle='#c00';context.beginPath();context.moveTo(px,0);context.lineTo(px,height);context.stroke();}
    context.strokeStyle='#000080';
    for(const time of [snapshot.selection.start,snapshot.selection.end]){const x=xForTime(time);if(x>=0&&x<=width){context.beginPath();context.moveTo(x,0);context.lineTo(x,height);context.stroke();}}
  }
  const close=()=>{
    if(closed)return;closed=true;stopPlayback();window.removeEventListener('keydown',onKey);resizeObserver?.disconnect?.();editor.remove();
    try{onClose?.();}catch{}
  };
  const reset=()=>{stopPlayback();model.reset();draw();};
  const onKey=event=>{
    if(!editor.isConnected)return;
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.target.matches('input,button'))return;
    const snapshot=current();
    if((event.key==='Delete'||event.key==='Backspace')&&snapshot.chop.focusedCutIndex>0){event.preventDefault();model.removeCut(snapshot.chop.focusedCutIndex);draw();return;}
    if(event.code==='Space'){event.preventDefault();playSelection();}
  };

  canvas.addEventListener('pointerdown',event=>{
    stopPlayback();const marker=cutIndexAtClientX(event.clientX);
    if(marker>0){markerDragIndex=marker;model.setFocusedCut(marker);model.switchToManual();canvas.setPointerCapture?.(event.pointerId);draw();return;}
    dragStart=timeAtClientX(event.clientX);dragStartX=event.clientX;canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener('pointermove',event=>{
    if(markerDragIndex>0){const frame=model.frameAtTime(timeAtClientX(event.clientX));model.moveCut(markerDragIndex,frame);markerDragIndex=current().chop.focusedCutIndex;draw();return;}
    if(dragStart==null)return;const currentTime=timeAtClientX(event.clientX);if(Math.abs(event.clientX-dragStartX)<3)return;model.setSelection(dragStart,currentTime);draw();
  });
  canvas.addEventListener('pointerup',event=>{
    if(markerDragIndex>0){markerDragIndex=null;draw();return;}
    if(dragStart==null)return;
    const currentTime=timeAtClientX(event.clientX);
    if(Math.abs(event.clientX-dragStartX)<3){
      model.setPlayhead(currentTime);const frame=model.frameAtTime(currentTime),index=closestCutIndex(frame),cuts=current().chop.cuts;
      model.setFocusedCut(index>0&&Math.abs(cuts[index]-frame)<=sourceBuffer.sampleRate*.08?index:null);draw();
    }else{model.setSelection(dragStart,currentTime);draw();}
    dragStart=null;
  });
  canvas.addEventListener('pointercancel',()=>{dragStart=null;markerDragIndex=null;});
  canvas.addEventListener('dblclick',event=>{stopPlayback();model.addCut(model.frameAtTime(timeAtClientX(event.clientX)));draw();});

  startInput.addEventListener('change',()=>{model.setSelection(number(startInput.value),number(endInput.value));draw();});
  endInput.addEventListener('change',()=>{model.setSelection(number(startInput.value),number(endInput.value));draw();});
  editor.querySelector('[data-waveform-trim-start]').onclick=()=>{const s=current();model.setSelection(s.playhead,s.selection.end);draw();};
  editor.querySelector('[data-waveform-trim-end]').onclick=()=>{const s=current();model.setSelection(s.selection.start,s.playhead);draw();};
  editor.querySelector('[data-waveform-full]').onclick=()=>{model.setSelection(0,current().totalDuration);draw();};
  zoomInput.oninput=()=>{model.setZoom(zoomInput.value);draw();};
  gainInput.oninput=()=>{model.setGainDb(gainInput.value);draw();};
  normalizeInput.onchange=()=>{model.setNormalize(normalizeInput.checked);draw();};
  chopModeButtons.forEach(button=>button.onclick=()=>{model.setChopMode(button.dataset.chopMode);draw();});
  chopTargetInput.onchange=()=>{model.setChopTarget(chopTargetInput.value);draw();};
  editor.querySelector('[data-chop-add]').onclick=()=>{model.addCut(model.frameAtTime(current().playhead));draw();};
  chopRemoveButton.onclick=()=>{const s=current(),index=s.chop.focusedCutIndex||closestCutIndex(model.frameAtTime(s.playhead));if(index>0)model.removeCut(index);draw();};
  editor.querySelector('[data-chop-clear]').onclick=()=>{model.clearCuts();draw();};
  chopExportButton.onclick=async()=>{
    if(chopExportButton.disabled)return;
    chopExportButton.disabled=true;const previous=chopExportButton.textContent;chopExportButton.textContent='EXPORTING...';
    try{
      const snapshot=current();
      const outputs=await renderChopWavs(sourceBuffer,snapshot.chop.cuts,{gainDb:snapshot.gainDb,normalize:snapshot.normalize,playmode:sourcePlaymode,metadata:sourceMetadata});
      await onExportChops?.(outputs,{mode:snapshot.chop.mode,cuts:[...snapshot.chop.cuts],gainDb:snapshot.gainDb,normalize:snapshot.normalize});
    }catch(error){showError(error?.message||error);}finally{chopExportButton.textContent=previous;updateChopUi();}
  };
  editor.querySelector('[data-waveform-play]').onclick=()=>{try{playSelection();}catch(error){showError(error?.message||error);}};
  editor.querySelector('[data-waveform-stop]').onclick=()=>{stopPlayback();draw();};
  editor.querySelector('[data-waveform-reset]').onclick=reset;
  editor.querySelector('[data-waveform-cancel]').onclick=close;
  editor.querySelector('[data-waveform-close]').onclick=close;
  applyButton.onclick=async()=>{
    if(!allowApply||applyButton.disabled)return;
    applyButton.disabled=true;const originalText=applyButton.textContent;applyButton.textContent='APPLYING...';stopPlayback();
    try{
      const snapshot=current();
      const edit=await renderWaveformEdit(sourceBuffer,{start:snapshot.selection.start,end:snapshot.selection.end,gainDb:snapshot.gainDb,normalize:snapshot.normalize,playmode:sourcePlaymode,metadata:sourceMetadata});
      await onApply?.(edit,{selection:{...snapshot.selection},gainDb:snapshot.gainDb,normalize:snapshot.normalize});close();
    }catch(error){showError(error?.message||error);applyButton.disabled=false;applyButton.textContent=originalText;}
  };

  window.addEventListener('keydown',onKey);
  resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(draw):null;resizeObserver?.observe(canvas);draw();
  return Object.freeze({close,reset,draw,getState:model.getState});
}

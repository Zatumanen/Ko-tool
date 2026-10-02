export function isMobileUserAgent(userAgent=''){
  return /Android|iPhone|iPad|iPod|Mobile/i.test(String(userAgent||''));
}

export function makeDraggableWindow(windowEl,{windowRef=globalThis.window,onDragStart}={}){
  const bar=windowEl?.querySelector?.('.title-bar');
  if(!windowEl||!bar||bar.dataset.dragReady)return false;
  bar.dataset.dragReady='1';
  let dragging=false,dx=0,dy=0;
  bar.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target?.closest?.('button'))return;
    const rect=windowEl.getBoundingClientRect();
    windowEl.style.position='fixed';
    windowEl.style.transform='none';
    windowEl.style.left=rect.left+'px';
    windowEl.style.top=rect.top+'px';
    dx=event.clientX-rect.left;
    dy=event.clientY-rect.top;
    dragging=true;
    onDragStart?.();
    bar.setPointerCapture?.(event.pointerId);
  });
  bar.addEventListener('pointermove',event=>{
    if(!dragging)return;
    const maxX=Math.max(0,(windowRef?.innerWidth||0)-windowEl.offsetWidth);
    const maxY=Math.max(0,(windowRef?.innerHeight||0)-windowEl.offsetHeight);
    windowEl.style.left=Math.min(maxX,Math.max(0,event.clientX-dx))+'px';
    windowEl.style.top=Math.min(maxY,Math.max(0,event.clientY-dy))+'px';
  });
  const stop=event=>{
    if(!dragging)return;
    dragging=false;
    if(bar.hasPointerCapture?.(event.pointerId))bar.releasePointerCapture(event.pointerId);
  };
  bar.addEventListener('pointerup',stop);
  bar.addEventListener('pointercancel',stop);
  return true;
}

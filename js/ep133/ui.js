import{onConnectionChange,onMidiActivity}from './index.js?v=20261001-1';
import{createEpWorkspace}from './ui/createEpWorkspace.js?v=20261005-1';
import{getEpBrowserDom,hasRequiredEpBrowserDom}from './ui/domRegistry.js';
import{isMobileUserAgent,makeDraggableWindow}from './ui/windowShell.js';

export function initEp133Browser({showError}={}){
  const dom=getEpBrowserDom(document);
  if(!hasRequiredEpBrowserDom(dom))return;
  const{open,panel,close}=dom;
  const workspace=createEpWorkspace({dom,showError,documentRef:document,windowRef:window});

  open.addEventListener('click',()=>{
    if(isMobileUserAgent(navigator.userAgent)){
      showError?.('MY EP WORKS ON DESKTOP COMPUTERS ONLY.');
      return;
    }
    workspace.openPanel();
  });
  open.addEventListener('keydown',event=>{
    if(event.key!=='Enter'&&event.key!==' ')return;
    event.preventDefault();
    open.click();
  });
  close.addEventListener('click',workspace.closePanel);

  makeDraggableWindow(panel.querySelector('.ep133-browser-window'),{windowRef:window,onDragStart:workspace.closeProperties});

  onConnectionChange(workspace.handleConnection);
  onMidiActivity(workspace.handleMidiActivity);
  window.addEventListener('paste',workspace.handlePaste);
  document.addEventListener('pointerdown',workspace.handlePointerDown);
  document.addEventListener('keydown',workspace.handleKeyDown);

  return workspace;
}

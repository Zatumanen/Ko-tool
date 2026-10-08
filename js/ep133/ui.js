import{onConnectionChange,onMidiActivity}from './index.js?v=20261001-1';
import{createEpWorkspace}from './ui/createEpWorkspace.js?v=20261001-1';
import{getEpBrowserDom,hasRequiredEpBrowserDom}from './ui/domRegistry.js';
import{makeDraggableWindow}from './ui/windowShell.js';
import{inspectBrowserCapabilities}from '../platformSupport.js?v=20261008-1';

export function initEp133Browser({showError}={}){
  const dom=getEpBrowserDom(document);
  if(!hasRequiredEpBrowserDom(dom))return;
  const{open,panel,close}=dom;
  const workspace=createEpWorkspace({dom,showError,documentRef:document,windowRef:window});

  open.addEventListener('click',()=>{
    const support=inspectBrowserCapabilities({navigatorRef:navigator,windowRef:window,documentRef:document});
    if(!support.myEp.supported){
      showError?.(support.myEp.message);
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

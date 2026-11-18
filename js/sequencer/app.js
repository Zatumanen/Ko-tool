import{getDeviceRuntimeSnapshot,onDeviceRuntimeChange}from '../ep133/deviceRuntime.js';
import{makeDraggableWindow}from '../ep133/ui/windowShell.js?v=20261001-1';
import{getSequencerSessionState}from './session.js';

export function initSequencerApp({documentRef=globalThis.document,windowRef=globalThis.window,
  getSnapshot=getDeviceRuntimeSnapshot,subscribe=onDeviceRuntimeChange}={}){
  const doc=documentRef,icon=doc?.getElementById('sequencer-icon');
  if(!icon||doc.getElementById('sequencer-window'))return null;
  const root=doc.createElement('section');
  root.id='sequencer-window';root.className='window sequencer-window';root.hidden=true;root.tabIndex=-1;
  root.setAttribute('role','dialog');root.setAttribute('aria-label','Sequencer');
  root.innerHTML=`<div class="title-bar"><span>Sequencer</span><div class="window-controls"><button type="button" data-sequencer-close aria-label="Close Sequencer">×</button></div></div>
    <div class="content">
      <div role="status" aria-live="polite"><strong data-sequencer-status></strong><p data-sequencer-identity></p></div>
      <p data-sequencer-help></p>
      <button type="button" data-sequencer-my-ep>Open My EP</button>
      <hr><h2>Saved project</h2>
      <p>Step Sequencer and Piano Roll are not available in this window yet. Use My EP Projects to inspect saved projects.</p>
      <p>Opening Sequencer does not read a project or enable automatic refresh.</p>
      <button type="button" disabled>Live · HIL pending</button>
    </div>`;
  doc.body.append(root);
  const q=selector=>root.querySelector(selector);
  const render=snapshot=>{
    const state=getSequencerSessionState(snapshot);
    root.dataset.session=state.status;
    q('[data-sequencer-status]').textContent=state.label;
    q('[data-sequencer-identity]').textContent=state.identity;
    q('[data-sequencer-help]').textContent=state.status==='ready'
      ?'Using the authorized My EP session. No separate connection is opened.'
      :state.status==='disconnected'?'Connect and authorize your EP in My EP.':'Wait for My EP to finish its operation or resolve its safety lock.';
  };
  const open=()=>{render(getSnapshot());root.hidden=false;root.focus();};
  const close=()=>{root.hidden=true;icon.focus();};
  const keyOpen=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}};
  const keyClose=event=>{if(event.key==='Escape'){event.preventDefault();close();}};
  icon.addEventListener('click',open);icon.addEventListener('keydown',keyOpen);
  root.addEventListener('keydown',keyClose);
  q('[data-sequencer-close]').addEventListener('click',close);
  q('[data-sequencer-my-ep]').addEventListener('click',()=>doc.getElementById('my-ep-icon')?.click());
  makeDraggableWindow(root,{windowRef});
  render(getSnapshot());
  const unsubscribe=subscribe(render);
  const dispose=()=>{unsubscribe?.();icon.removeEventListener('click',open);icon.removeEventListener('keydown',keyOpen);root.remove();};
  windowRef?.addEventListener('beforeunload',dispose,{once:true});
  return{open,close,dispose};
}

if(typeof document!=='undefined')initSequencerApp();

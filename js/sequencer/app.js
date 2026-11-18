import{getDeviceRuntimeSnapshot,onDeviceRuntimeChange}from '../ep133/deviceRuntime.js';
import{makeDraggableWindow}from '../ep133/ui/windowShell.js?v=20261001-1';
import{getSequencerSessionState}from './session.js';
// The aggregate index also boots My EP UI. Observe its services without starting that UI early.
import{getDeviceSessionToken}from '../ep133/device.js?v=20261001-1';
import{listProjectArchivesReadOnly,readProjectArchiveReadOnly}from '../ep133/filesystem.js?v=20261001-1';
import{createSavedSequencer}from './saved.js';
import{renderSavedSteps,escapeHtml}from './stepView.js';

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
      <div data-saved-controls><button type="button" data-saved-list>List projects</button>
      <label>Project <select data-saved-project aria-label="Saved project"></select></label>
      <button type="button" data-saved-read>Read / Refresh</button></div>
      <p data-saved-status role="status" aria-live="polite"></p><div data-saved-view></div>
      <p>Opening Sequencer does not read a project or enable automatic refresh.</p>
      <button type="button" disabled>Live · HIL pending</button>
    </div>`;
  doc.body.append(root);
  const q=selector=>root.querySelector(selector);
  let group='a',patternId='',page=0,mode='step',pad='all',zoom=1,selectedNote=null,previousResult=null,lastRuntimeStatus='';
  const readSession=()=>{
    const s=getSnapshot(),c=s?.connection,token=getDeviceSessionToken();
    return c?.status==='connected'&&c.device?.identityVerified&&s.ownership?.status==='owned'&&
      s.safety?.status==='safe'&&s.recovery?.hydrated&&token?c.epoch+':'+token:null;
  };
  const canRead=()=>!root.hidden&&getSequencerSessionState(getSnapshot()).status==='ready';
  const renderSaved=()=>{
    const state=saved.getState(),enabled=canRead()&&!state.busy;
    q('[data-saved-list]').disabled=!enabled;
    q('[data-saved-read]').disabled=!enabled||!state.selected;
    const select=q('[data-saved-project]');
    select.innerHTML='<option value="">Select project</option>'+state.projects.map(p=>`<option value="${escapeHtml(p.project)}">P${escapeHtml(p.project)}${p.active?' · ACTIVE':''}</option>`).join('');
    select.value=state.selected;select.disabled=!enabled;
    q('[data-saved-status]').textContent=state.message+(state.readAt?' · Last read '+new Date(state.readAt).toLocaleTimeString():'');
    if(state.result!==previousResult){group='a';patternId='';page=0;pad='all';selectedNote=null;previousResult=state.result;}
    q('[data-saved-view]').innerHTML=state.result?renderSavedSteps(state.result,{group,patternId,page,mode,pad,zoom,selectedNote}):'';
  };
  const saved=createSavedSequencer({getSession:readSession,canRead,list:listProjectArchivesReadOnly,read:readProjectArchiveReadOnly,onChange:renderSaved});
  const render=snapshot=>{
    saved.sync();
    if(['mutating','verifying'].includes(snapshot?.status)&&lastRuntimeStatus!==snapshot.status)saved.invalidate();
    lastRuntimeStatus=snapshot?.status;
    const state=getSequencerSessionState(snapshot);
    root.dataset.session=state.status;
    q('[data-sequencer-status]').textContent=state.label;
    q('[data-sequencer-identity]').textContent=state.identity;
    q('[data-sequencer-help]').textContent=state.status==='ready'
      ?'Using the authorized My EP session. No separate connection is opened.'
      :state.status==='disconnected'?'Connect and authorize your EP in My EP.':'Wait for My EP to finish its operation or resolve its safety lock.';
    renderSaved();
  };
  const open=()=>{root.hidden=false;render(getSnapshot());root.focus();};
  const close=()=>{root.hidden=true;saved.close();icon.focus();};
  const keyOpen=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}};
  const keyClose=event=>{if(event.key==='Escape'){event.preventDefault();close();}};
  icon.addEventListener('click',open);icon.addEventListener('keydown',keyOpen);
  root.addEventListener('keydown',keyClose);
  q('[data-sequencer-close]').addEventListener('click',close);
  q('[data-sequencer-my-ep]').addEventListener('click',()=>doc.getElementById('my-ep-icon')?.click());
  q('[data-saved-list]').addEventListener('click',()=>{void saved.loadList();});
  q('[data-saved-read]').addEventListener('click',()=>{void saved.refresh();});
  q('[data-saved-project]').addEventListener('change',event=>saved.select(event.target.value));
  q('[data-saved-view]').addEventListener('change',event=>{
    const attr=['group','pattern','page','mode','pad','zoom'].find(key=>event.target.hasAttribute('data-saved-'+key));
    if(!attr)return;
    const control='[data-saved-'+attr+']';
    if(attr==='group'){group=event.target.value;patternId='';page=0;selectedNote=null;}
    if(attr==='pattern'){patternId=event.target.value;page=0;selectedNote=null;}
    if(event.target.matches('[data-saved-page]'))page=Number(event.target.value);
    if(attr==='mode')mode=event.target.value;
    if(attr==='pad'){pad=event.target.value;selectedNote=null;}
    if(attr==='zoom')zoom=Number(event.target.value);
    renderSaved();
    q(control)?.focus();
  });
  q('[data-saved-view]').addEventListener('click',event=>{
    const button=event.target.closest('[data-saved-note]');if(!button)return;
    selectedNote=Number(button.dataset.savedNote);renderSaved();
    q('[data-saved-note="'+selectedNote+'"]')?.focus();
  });
  makeDraggableWindow(root,{windowRef});
  render(getSnapshot());
  const unsubscribe=subscribe(render);
  const dispose=()=>{saved.close();unsubscribe?.();windowRef?.removeEventListener('beforeunload',dispose);icon.removeEventListener('click',open);icon.removeEventListener('keydown',keyOpen);root.remove();};
  windowRef?.addEventListener('beforeunload',dispose,{once:true});
  return{open,close,dispose};
}

if(typeof document!=='undefined')initSequencerApp();

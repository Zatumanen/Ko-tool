// An explicit, ephemeral consumer of the passive observer; no transport state is inferred.
export function createMidiDiagnostics({subscribe,getSession,canStart,onChange=()=>{},limit=64}){
 limit=Math.max(1,Math.min(128,Math.floor(Number(limit)||64)));
 let binding=getSession(),subscription=null,generation=0,disposed=false;
 let state=Object.freeze({active:false,status:'EVENT OBSERVER OFF',rows:Object.freeze([]),delivered:0,dropped:0,trimmed:0});
 const publish=patch=>{state=Object.freeze({...state,...patch,rows:Object.freeze(patch.rows??state.rows)});onChange(state);};
 const empty={rows:Object.freeze([]),delivered:0,dropped:0,trimmed:0};
 const stop=(status='EVENTS ONLY · STOPPED',clear=false)=>{
  generation++;const previous=subscription;subscription=null;previous?.unsubscribe();
  publish({active:false,status,...(clear?empty:{})});
 };
 const sync=()=>{
  if(disposed)return;
  const next=getSession();
  if(next!==binding){binding=next;if(state.active||state.delivered)stop('SESSION CHANGED · OBSERVER OFF',true);}
 };
 const start=()=>{
  sync();if(disposed||state.active||!binding||!canStart())return false;
  const token=++generation;publish({...empty,active:true,status:'EVENTS ONLY · WAITING FOR INPUT'});
  try{
   const next=subscribe(batch=>{
    sync();if(token!==generation||!state.active)return;
    const combined=[...state.rows,...batch.events];
    publish({status:'EVENTS ONLY',rows:combined.slice(-limit),delivered:state.delivered+batch.events.length,
     dropped:state.dropped+batch.dropped,trimmed:state.trimmed+Math.max(0,combined.length-limit)});
   },{capacity:128,flushMs:100,onReset:({reason})=>{
    if(token!==generation)return;
    if(reason==='cleared')publish({...empty,status:'EVENTS ONLY · WAITING FOR INPUT'});
    else stop('SESSION CHANGED · OBSERVER OFF',true);
   }});
   if(token!==generation||!state.active){next.unsubscribe();return false;}
   subscription=next;return true;
  }catch{stop('OBSERVER UNAVAILABLE',true);return false;}
 };
 return{getState:()=>state,start,stop,sync,
  clear(){if(subscription)subscription.clear();else publish(empty);},
  suspend(){stop('EVENT OBSERVER OFF',true);},
  dispose(){disposed=true;binding=null;stop('EVENT OBSERVER OFF',true);}
 };
}

export function mountMidiDiagnostics({root,documentRef=globalThis.document,subscribe,getSession,canStart}){
 const doc=documentRef,section=doc.createElement('section');section.className='midi-diagnostics';section.setAttribute('aria-label','MIDI event diagnostics');
 section.innerHTML=`<h2>MIDI input · EVENTS ONLY</h2><p>Observe incoming events only. No transport commands or synchronization. HIL PENDING.</p>
 <button type="button" data-events-start>Observe MIDI input</button><button type="button" data-events-stop disabled>Stop observing</button><button type="button" data-events-clear disabled>Clear events</button>
 <p data-events-status role="status" aria-live="polite">EVENT OBSERVER OFF</p><p data-events-count aria-live="off"></p>
 <div class="midi-events-table"><table aria-label="Received MIDI events"><thead><tr><th>Timestamp (ms)</th><th>Event</th><th>Channel</th><th>Value</th><th>MIDI bytes</th><th>Epoch / session</th></tr></thead><tbody data-events-rows></tbody></table></div>
 <p data-events-source></p><p>Recent 64 events. A received SPP is not a verified scene or playhead. Closing or hiding the page clears this diagnostic.</p>`;
 root.querySelector('.content').append(section);
 const q=s=>section.querySelector(s);let paintTimer=null,disposed=false;
 const allowed=()=>!doc.hidden&&canStart();
 const cancelPaint=()=>{if(paintTimer!==null)clearTimeout(paintTimer);paintTimer=null;};
 const paint=()=>{
  if(disposed)return;const state=controller.getState();
  q('[data-events-start]').disabled=state.active||!allowed();q('[data-events-stop]').disabled=!state.active;
  q('[data-events-clear]').disabled=!state.active&&!state.rows.length;
  if(q('[data-events-status]').textContent!==state.status)q('[data-events-status]').textContent=state.status;
  q('[data-events-count]').textContent=`Delivered ${state.delivered} · Observer dropped ${state.dropped} · Older rows hidden ${state.trimmed}`;
  const fragment=doc.createDocumentFragment();
  for(const event of state.rows){
   const tr=doc.createElement('tr');
   const value=event.position!=null?'SPP '+event.position:event.note!=null?`note ${event.note}, velocity ${event.velocity}`:'—';
   for(const text of [event.timestamp,event.type,event.channel??'—',value,event.data.map(n=>n.toString(16).padStart(2,'0')).join(' '),`${event.connectionEpoch} / ${event.session}`]){
    const td=doc.createElement('td');td.textContent=String(text);tr.append(td);
   }fragment.append(tr);
  }
  q('[data-events-rows]').replaceChildren(fragment);
  const last=state.rows.at(-1);q('[data-events-source]').textContent=last?`${last.model} · FW ${last.firmware} · received events only`:'';
 };
 const changed=state=>{
  if(disposed)return;
  if(state.active&&state.status==='EVENTS ONLY'){
   if(paintTimer===null)paintTimer=setTimeout(()=>{paintTimer=null;paint();},250);
  }else{cancelPaint();paint();}
 };
 const controller=createMidiDiagnostics({subscribe,getSession,canStart:allowed,onChange:changed});
 q('[data-events-start]').addEventListener('click',controller.start);
 q('[data-events-stop]').addEventListener('click',()=>controller.stop());
 q('[data-events-clear]').addEventListener('click',controller.clear);
 const hidden=()=>{if(doc.hidden)controller.suspend();else{controller.sync();paint();}};doc.addEventListener('visibilitychange',hidden);
 paint();
 return{sync(){controller.sync();paint();},suspend:()=>controller.suspend(),
  dispose(){disposed=true;cancelPaint();controller.dispose();doc.removeEventListener('visibilitychange',hidden);section.remove();}
 };
}

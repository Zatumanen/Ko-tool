// An explicit, ephemeral consumer of the passive observer; no transport state is inferred.
export function createMidiDiagnostics({subscribe,getSession,canStart,onChange=()=>{},limit=64,captureLimit=8192,now=()=>Date.now()}){
 limit=Math.max(1,Math.min(128,Math.floor(Number(limit)||64)));
 captureLimit=Math.max(1,Math.min(8192,Math.floor(Number(captureLimit)||8192)));
 let binding=getSession(),subscription=null,generation=0,disposed=false;
 let trace=[],startedAt=null,stoppedAt=null,stopReason=null;
 let state=Object.freeze({active:false,status:'EVENT OBSERVER OFF',rows:Object.freeze([]),delivered:0,dropped:0,trimmed:0,captured:0,limitReached:false,notRecorded:0});
 const publish=patch=>{state=Object.freeze({...state,...patch,rows:Object.freeze(patch.rows??state.rows)});onChange(state);};
 const empty={rows:Object.freeze([]),delivered:0,dropped:0,trimmed:0,captured:0,limitReached:false,notRecorded:0};
 const resetTrace=active=>{trace=[];startedAt=active?new Date(now()).toISOString():null;stoppedAt=null;stopReason=null;};
 const stop=(status='EVENTS ONLY · STOPPED',clear=false,reason='manual')=>{
  const token=generation;
  if(!clear&&state.active)subscription?.flush?.();
  if(token!==generation)return;
  generation++;const previous=subscription;subscription=null;previous?.unsubscribe();
  if(clear)resetTrace(false);
  else if(startedAt&&stoppedAt===null){stoppedAt=new Date(now()).toISOString();stopReason=reason;}
  publish({active:false,status,...(clear?empty:{})});
 };
 const sync=()=>{
  if(disposed)return;
  const next=getSession();
  if(next!==binding){binding=next;if(state.active||state.delivered)stop('SESSION CHANGED · OBSERVER OFF',true);}
 };
 const start=()=>{
  sync();if(disposed||state.active||!binding||!canStart())return false;
  resetTrace(true);const token=++generation;publish({...empty,active:true,status:'EVENTS ONLY · WAITING FOR INPUT'});
  try{
   const next=subscribe(batch=>{
    sync();if(token!==generation||!state.active)return;
    const kept=batch.events.slice(0,captureLimit-trace.length);trace.push(...kept);
    const combined=[...state.rows,...kept],full=trace.length===captureLimit;
    publish({status:'EVENTS ONLY',rows:combined.slice(-limit),delivered:state.delivered+batch.events.length,
     dropped:state.dropped+batch.dropped,trimmed:state.trimmed+Math.max(0,combined.length-limit),
     captured:trace.length,limitReached:full,notRecorded:state.notRecorded+batch.events.length-kept.length});
    if(full)stop('TRACE LIMIT REACHED · OBSERVER STOPPED',false,'limit');
   },{capacity:128,flushMs:100,onReset:({reason})=>{
    if(token!==generation)return;
    if(reason==='cleared'){resetTrace(true);publish({...empty,status:'EVENTS ONLY · WAITING FOR INPUT'});}
    else stop('SESSION CHANGED · OBSERVER OFF',true);
   }});
   if(token!==generation||!state.active){next.unsubscribe();return false;}
   subscription=next;return true;
  }catch{stop('OBSERVER UNAVAILABLE',true);return false;}
 };
 return{getState:()=>state,start,stop,sync,
  clear(){if(subscription)subscription.clear();else{resetTrace(false);publish(empty);}},
  exportTrace({buildVersion='source'}={}){
   sync();if(state.active||!trace.length)return null;
   const fields=['type','channel','note','velocity','position','timestamp','connectionEpoch','session','model','firmware'];
   return{format:'ko-tool-passive-midi-events',schemaVersion:1,evidence:'UNVERIFIED',hilStatus:'PENDING',appBuildVersion:String(buildVersion),
    wallClockStartedAt:startedAt,wallClockStoppedAt:stoppedAt,timestampDomain:'Web MIDI event.timeStamp (ms)',stopReason,
    decodedMessageTypes:['note-on','note-off','clock','start','continue','stop','song-position'],
    loss:{observerDropped:state.dropped,captureLimitReached:state.limitReached,deliveredButNotStored:state.notRecorded},
    events:trace.map(event=>({...Object.fromEntries(fields.filter(key=>event[key]!==undefined).map(key=>[key,event[key]])),data:Array.from(event.data||[])}))};
  },
  suspend(){stop('EVENT OBSERVER OFF',true);},
  dispose(){disposed=true;binding=null;stop('EVENT OBSERVER OFF',true);}
 };
}

export function mountMidiDiagnostics({root,documentRef=globalThis.document,subscribe,getSession,canStart}){
 const doc=documentRef,section=doc.createElement('section');section.className='midi-diagnostics';section.setAttribute('aria-label','MIDI event diagnostics');
 section.innerHTML=`<h2>MIDI input · EVENTS ONLY</h2><p>Observe incoming events only. No transport commands or synchronization. HIL PENDING.</p>
 <button type="button" data-events-start>Observe MIDI input</button><button type="button" data-events-stop disabled>Stop observing</button><button type="button" data-events-clear disabled>Clear events</button><button type="button" data-events-export disabled>Download MIDI trace</button>
 <p data-events-status role="status" aria-live="polite">EVENT OBSERVER OFF</p><p data-events-count aria-live="off"></p>
 <p data-events-download-status role="status" aria-live="polite"></p>
 <div class="midi-events-table"><table aria-label="Received MIDI events"><thead><tr><th>Timestamp (ms)</th><th>Event</th><th>Channel</th><th>Value</th><th>MIDI bytes</th><th>Epoch / session</th></tr></thead><tbody data-events-rows></tbody></table></div>
 <p data-events-source></p><p>Recent 64 events; trace holds up to 8192 delivered events, then observation stops. Stop to download JSON locally. Loss counts remain in the file; it is not HIL proof. A received SPP is not a verified scene or playhead. Starting again, Clear, closing or hiding discards the in-memory trace.</p>`;
 root.querySelector('.content').append(section);
 const q=s=>section.querySelector(s),downloads=new Map();let paintTimer=null,disposed=false;
 const allowed=()=>!doc.hidden&&canStart();
 const cancelPaint=()=>{if(paintTimer!==null)clearTimeout(paintTimer);paintTimer=null;};
 const paint=()=>{
  if(disposed)return;const state=controller.getState();
  q('[data-events-start]').disabled=state.active||!allowed();q('[data-events-stop]').disabled=!state.active;
  q('[data-events-clear]').disabled=!state.active&&!state.rows.length;
  q('[data-events-export]').disabled=state.active||!state.captured;
  if(!state.captured)q('[data-events-download-status]').textContent='';
  if(q('[data-events-status]').textContent!==state.status)q('[data-events-status]').textContent=state.status;
  q('[data-events-count]').textContent=`Delivered ${state.delivered} · Observer dropped ${state.dropped} · Older rows hidden ${state.trimmed} · Trace captured ${state.captured}`;
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
 q('[data-events-export]').addEventListener('click',()=>{
  const trace=controller.exportTrace({buildVersion:new URL(import.meta.url).searchParams.get('v')||'source'});if(!trace)return;
  try{
   const url=URL.createObjectURL(new Blob([JSON.stringify(trace,null,2)],{type:'application/json'}));
   downloads.set(url,setTimeout(()=>{URL.revokeObjectURL(url);downloads.delete(url);},1000));
   const a=doc.createElement('a');a.href=url;a.download='ko-tool-midi-events.json';a.click();
   q('[data-events-download-status]').textContent='Download requested · unverified received events only';
  }catch{q('[data-events-download-status]').textContent='TRACE DOWNLOAD FAILED · captured data retained';}
 });
 const hidden=()=>{if(doc.hidden)controller.suspend();else{controller.sync();paint();}};doc.addEventListener('visibilitychange',hidden);
 paint();
 return{sync(){controller.sync();paint();},suspend:()=>controller.suspend(),
  dispose(){disposed=true;cancelPaint();for(const[url,timer]of downloads){clearTimeout(timer);URL.revokeObjectURL(url);}downloads.clear();controller.dispose();doc.removeEventListener('visibilitychange',hidden);section.remove();}
 };
}

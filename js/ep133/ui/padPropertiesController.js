import{renderSampleProperties,getSamplePropertyChange}from '../sampleProperties.js?v=20261001-1';
import{preparePadMetadataPayload,normalizePadMetadata,verifyPadMetadata}from '../padMetadata.js';
import{TE_SYSEX_FILE_EVENT_METADATA_UPDATED}from '../constants.js';

const FIELDS=['sound.pitch','sound.playmode','time.mode','envelope.release'];
const clone=value=>JSON.parse(JSON.stringify(value));
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sameTarget=(a,b)=>a&&b&&['project','group','pad','projectFid','groupFid','padFid','sampleSlot'].every(key=>a[key]===b[key]);

/** One workspace FILE subscription forwards events here; no polling or subscription. */
export function createPadPropertiesController({dom,getAvailability,readTargets,readTarget,applyPadMetadata,
  captureSession,assertSession,reportError,documentRef=globalThis.document,
  setTimeoutFn=(fn,ms)=>setTimeout(fn,ms),clearTimeoutFn=id=>clearTimeout(id)
}={}){
  let opened=false,disposed=false,epoch=0,session=null,sampleSlot=null,source=null,snapshot=null;
  let projects=[],groups=[],targets=[],draft={},queued=null,timer=null,inFlight=false,activeApply=null,stopGesture=null,notice='CHOOSE A PROJECT, GROUP AND PAD.';
  const errors=new Map(),listeners=[];
  const listen=(el,type,fn)=>{el?.addEventListener(type,fn);listeners.push([el,type,fn]);};
  const text=(key,value)=>{if(dom[key])dom[key].textContent=value;};
  const busy=()=>queued||inFlight||stopGesture||Object.keys(draft).length;
  const valid=version=>opened&&!disposed&&version===epoch;
  const permission=()=>getAvailability?.()||{read:false,write:false,reason:'Pad capability unavailable.'};
  const invalidSnapshot=()=>{try{if(!snapshot)throw Error('Select an authoritative pad snapshot.');preparePadMetadataPayload(snapshot.metadata,{});return'';}catch(error){return error.message;}};
  const sourceProblem=()=>{try{if(!source)throw Error('Copy source unavailable; choose a library sample again.');normalizePadMetadata(source);for(const key of FIELDS)if(!Object.hasOwn(source,key))throw Error('Confirmed library source missing '+key);return'';}catch(error){return error.message;}};
  const render=()=>{
    const availability=permission(),problem=invalidSnapshot();
    text('padSource',source?'CONFIRMED SAMPLE LIBRARY '+sampleSlot+' · '+FIELDS.map(key=>key+' = '+String(source[key])).join(' · '):'Copy source cleared / unavailable. Choose a library sample again.');
    const target=snapshot?.target;
    text('padAssignment',target?'PAD PARAMETERS · PROJECT '+target.project+' / '+target.group+' / '+target.pad+' · ASSIGNED SAMPLE '+target.sampleSlot:'PAD PARAMETERS · NO PAD SELECTED');
    text('padReason',[availability.write?'':availability.reason||'Pad writes are not verified.',problem,sourceProblem()].filter(Boolean).join(' '));
    if(dom.padApply)dom.padApply.disabled=!availability.write||!!problem||!!sourceProblem()||!!busy();
    if(dom.padGrid){
      if(snapshot&&!problem){
        dom.padGrid.innerHTML=renderSampleProperties({file:true,meta:{...snapshot.metadata,...draft}},{includeSampleTiming:false,playModes:['oneshot','key','legato'],isPending:key=>Object.hasOwn(draft,key),escapeHtml:escape});
        if(!availability.write||inFlight)dom.padGrid.querySelectorAll?.('button').forEach(el=>{el.disabled=true;});
        const pitch=dom.padGrid.querySelector?.('[data-property-row="sound.pitch"] .ep133-prop-value');
        if(pitch){pitch.dataset.padPitch='true';pitch.style.touchAction='none';pitch.title='Drag vertically; release to save';}
      }else dom.padGrid.textContent=snapshot?'RAW PAD METADATA · '+JSON.stringify(snapshot.metadata):'Choose a pad to read its current values.';
    }
    text('padStatus',errors.size?'NOT SAVED · '+[...errors.values()].join(' · '):notice);
  };
  const cancel=()=>{
    if(timer!=null)clearTimeoutFn(timer);timer=null;queued=null;
    stopGesture?.();stopGesture=null;draft={};
  };
  const fail=(key,error)=>{errors.set(key,String(error?.message||error));render();reportError?.('COULD NOT UPDATE PAD.',error);};
  const perform=async job=>{
    if(!valid(job.version)||!sameTarget(snapshot?.target,job.before.target))return;
    const operation={};
    try{
      assertSession(job.session);
      if(!permission().write)throw Error(permission().reason||'Pad writes are not verified.');
      preparePadMetadataPayload(job.before.metadata,job.changes);
      activeApply=operation;inFlight=true;notice='SAVING TO EP…';render();
      const result=await applyPadMetadata({target:clone(job.before.target),before:clone(job.before),changes:clone(job.changes),sessionToken:job.session});
      assertSession(job.session);
      if(!valid(job.version))return;
      // Runtime owns the authoritative complete readback and transaction journal.
      const candidate=preparePadMetadataPayload(job.before.metadata,job.changes);
      if(result.verification?.ok!==true||!verifyPadMetadata(job.before.metadata,candidate,result.metadata).ok)
        throw Error('EP did not confirm the complete pad readback. Recovery verification may be required.');
      const authoritative=await readTarget(clone(job.before.target));assertSession(job.session);
      if(!valid(job.version))return;
      if(!sameTarget(authoritative.target,job.before.target))throw Error('Authoritative pad target changed after readback.');
      preparePadMetadataPayload(authoritative.metadata,{});snapshot=clone(authoritative);
      draft={};errors.delete(job.key);notice='SAVED ON EP · READBACK VERIFIED';
    }catch(error){if(valid(job.version)){draft={};fail(job.key,error);}}
    finally{if(activeApply===operation){activeApply=null;inFlight=false;if(opened&&!disposed)render();}}
  };
  const flush=()=>{timer=null;const job=queued;queued=null;if(job)return perform(job);};
  const schedule=(changes,key)=>{
    if(!opened||disposed||inFlight||invalidSnapshot()||!permission().write)return;
    try{assertSession(session);preparePadMetadataPayload(snapshot.metadata,changes);}catch(error){fail(key,error);return;}
    if(timer!=null)clearTimeoutFn(timer);
    draft={...draft,...changes};const version=++epoch;
    queued={version,before:clone(snapshot),session,changes:clone(draft),key};notice='PENDING · SAVING ON RELEASE / AFTER EDIT';
    render();timer=setTimeoutFn(flush,120);
  };
  const load=async(selected,version=++epoch)=>{
    try{
      assertSession(session);
      const result=await readTarget(clone(selected));assertSession(session);
      if(!valid(version))return;
      if(!sameTarget(selected,result.target))throw Error('Authoritative pad target changed; choose it again.');
      snapshot=clone(result);notice='READY · AUTHORITATIVE PAD VALUES';render();
    }catch(error){if(valid(version))fail('read',error);}
  };
  const options=(key,values,label)=>{if(dom[key]){dom[key].innerHTML='<option value="">CHOOSE '+label+'</option>'+values.map(value=>'<option value="'+escape(value)+'">'+escape(value)+'</option>').join('');dom[key].value='';}};
  const choose=async(level)=>{
    cancel();epoch++;snapshot=null;render();
    const version=epoch;
    if(level==='pad'){
      const selected=targets.find(item=>item.pad===dom.padSelect.value);
      if(selected)return load(selected,version);
      return;
    }
    targets=[];options('padSelect',[],'PAD');if(level==='project')options('padGroup',[],'GROUP');
    const project=dom.padProject?.value,group=dom.padGroup?.value;
    if(!project||level==='group'&&!group)return;
    try{
      assertSession(session);const result=await readTargets({sampleSlot,project,...(level==='group'?{group}:{})});assertSession(session);
      if(!valid(version))return;
      if(level==='project'){groups=result.groups.map(item=>item.group);options('padGroup',groups,'GROUP');}
      else{targets=clone(result.pads);options('padSelect',targets.map(item=>item.pad),'PAD');}
    }catch(error){if(valid(version))fail('read',error);}
  };
  const close=()=>{opened=false;epoch++;cancel();activeApply=null;inFlight=false;snapshot=null;source=null;errors.clear();if(dom.padDialog)dom.padDialog.hidden=true;};
  const openFromSample=async(slot,{confirmedLibraryMetadata}={})=>{
    if(disposed)return;close();opened=true;sampleSlot=Number(slot?.id??slot);session=null;
    source=confirmedLibraryMetadata?Object.fromEntries(FIELDS.filter(key=>Object.hasOwn(confirmedLibraryMetadata,key)).map(key=>[key,confirmedLibraryMetadata[key]])):null;
    notice='CHOOSE A PROJECT, GROUP AND PAD.';if(dom.padDialog)dom.padDialog.hidden=false;
    options('padProject',[],'PROJECT');options('padGroup',[],'GROUP');options('padSelect',[],'PAD');render();
    const version=++epoch;
    try{session=captureSession();if(!permission().read)throw Error(permission().reason||'Pad reads unavailable.');assertSession(session);const result=await readTargets({sampleSlot});assertSession(session);if(valid(version)){projects=result.projects.map(item=>item.project);options('padProject',projects,'PROJECT');}}
    catch(error){if(valid(version))fail('read',error);}
  };
  listen(dom.padClose,'click',close);
  listen(dom.padProject,'change',()=>choose('project'));listen(dom.padGroup,'change',()=>choose('group'));listen(dom.padSelect,'change',()=>choose('pad'));
  listen(dom.padApply,'click',()=>{
    if(!opened||disposed||busy()||invalidSnapshot()||sourceProblem()||!permission().write)return;
    const job={version:++epoch,before:clone(snapshot),changes:clone(source),session,key:'copy'};return perform(job);
  });
  listen(dom.padGrid,'click',event=>{
    const button=event.target.closest?.('[data-property]');if(!button||!snapshot||busy()&&!queued)return;
    const key=button.dataset.property;if(!['sound.pitch','sound.playmode','time.mode'].includes(key))return;
    const result=getSamplePropertyChange({meta:{...snapshot.metadata,...draft}},key,Number(button.dataset.direction),{playModes:['oneshot','key','legato'],includeSampleTiming:false});
    if(result)schedule({[key]:result.value},key);
  });
  listen(dom.padGrid,'pointerdown',event=>{
    if(!event.target.closest?.('[data-pad-pitch]')||!snapshot||inFlight||invalidSnapshot()||!permission().write)return;
    event.preventDefault();stopGesture?.();
    if(timer!=null)clearTimeoutFn(timer);timer=null;queued=null;
    const version=++epoch,before=clone(snapshot),token=session,startY=event.clientY,start=Number(draft['sound.pitch']??snapshot.metadata['sound.pitch']);
    let value=start;
    const move=e=>{if(!valid(version))return;value=Math.max(-12,Math.min(12,start+Math.round((startY-e.clientY)/3)));draft={...draft,'sound.pitch':value};notice='PENDING · RELEASE TO SAVE';render();};
    const detach=()=>{for(const[type,fn]of [['pointermove',move],['pointerup',release],['pointercancel',abort]])documentRef?.removeEventListener(type,fn);stopGesture=null;};
    const abort=()=>{detach();draft={};notice='GESTURE CANCELLED';if(valid(version))render();};
    const release=()=>{detach();if(!valid(version))return;const changes={...draft,'sound.pitch':value};draft={};return perform({version,before,session:token,changes,key:'sound.pitch'});};
    stopGesture=abort;documentRef?.addEventListener('pointermove',move);documentRef?.addEventListener('pointerup',release);documentRef?.addEventListener('pointercancel',abort);
  });
  const handleFileEvent=event=>{
    if(!opened||event?.type!==TE_SYSEX_FILE_EVENT_METADATA_UPDATED||Number(event?.data?.nodeId)!==snapshot?.target.padFid)return;
    if(busy()){notice='PENDING · HARDWARE UPDATE RECEIVED; DRAFT RETAINED';render();return;}
    return load(snapshot.target);
  };
  const handleActivePad=async selection=>{
    if(!opened||!snapshot||!Number.isInteger(selection?.padId)||!Number.isInteger(selection?.sym))return;
    if(busy()){notice='PENDING · HARDWARE SELECTION CHANGED; TARGET RETAINED';render();return;}
    const previous=snapshot.target,version=++epoch;
    try{
      assertSession(session);
      // Discovery resolves literal names and FIDs; never derive them from pad arithmetic.
      const hinted=selection.target;
      if(hinted&&(hinted.padFid!==selection.padId||hinted.sampleSlot!==selection.sym))throw Error('Hardware target context does not match the selected pad.');
      const result=hinted?{pads:[hinted]}:await readTargets({sampleSlot:selection.sym,project:previous.project,group:previous.group});assertSession(session);
      if(!valid(version))return;
      const selected=result.pads.find(item=>item.padFid===selection.padId);
      if(!selected){notice='HARDWARE TARGET UNRESOLVED · CHOOSE PROJECT / GROUP / PAD';render();return;}
      if(selected.sampleSlot!==sampleSlot){sampleSlot=selected.sampleSlot;source=null;}
      cancel();
      if(selected.project!==previous.project||selected.group!==previous.group){
        if(!projects.includes(selected.project))projects.push(selected.project);
        groups=selected.project===previous.project?[...new Set([...groups,selected.group])]:[selected.group];
        options('padProject',projects,'PROJECT');options('padGroup',groups,'GROUP');
        if(dom.padProject)dom.padProject.value=selected.project;if(dom.padGroup)dom.padGroup.value=selected.group;
      }
      targets=clone(result.pads);options('padSelect',targets.map(item=>item.pad),'PAD');if(dom.padSelect)dom.padSelect.value=selected.pad;
      snapshot=null;notice='READING SELECTED PAD…';render();
      await load(selected,version);
    }catch(error){if(valid(version))fail('read',error);}
  };
  return{openFromSample,close,handleFileEvent,handleActivePad,reset:close,dispose(){close();disposed=true;for(const[el,type,fn]of listeners)el?.removeEventListener(type,fn);listeners.length=0;}};
}

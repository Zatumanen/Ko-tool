const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sameTarget=(a,b)=>['project','group','pad','sampleSlot','projectFid','groupFid','padFid'].every(k=>a?.[k]===b?.[k]);

// Only read capabilities enter this controller. Do not reuse the editable
// sample renderer: even disabled edit controls would retain mutation handlers.
export function createReadOnlyPadPropertiesController({dom,reader,getAvailability,captureSession,assertSession,documentRef=globalThis.document}={}){
  let opened=false,disposed=false,epoch=0,session=null,sampleSlot=null,snapshot=null,targets=[];
  let previousFocus=null;
  const listeners=[];
  const text=(key,value)=>{if(dom[key])dom[key].textContent=value;};
  const options=(key,rows,label)=>{
    if(!dom[key])return;
    dom[key].innerHTML='<option value="">CHOOSE '+label+'</option>'+rows.map(row=>{
      const value=typeof row==='string'?row:row.value,name=typeof row==='string'?row:row.label;
      return'<option value="'+escape(value)+'">'+escape(name)+'</option>';
    }).join('');
    dom[key].value='';dom[key].disabled=rows.length===0;
  };
  const clearSnapshot=()=>{
    snapshot=null;text('padAssignment','PAD PARAMETERS · NO PAD SELECTED');
    if(dom.padGrid)dom.padGrid.innerHTML='';
  };
  const clearTargets=()=>{
    targets=[];clearSnapshot();options('padProject',[],'PROJECT');options('padGroup',[],'GROUP');options('padSelect',[],'PAD');
  };
  const valid=version=>opened&&!disposed&&version===epoch;
  const guard=()=>{
    if(typeof assertSession!=='function'||typeof captureSession!=='function')throw Error('Pad READ requires a current device session.');
    assertSession(session);
    const p=getAvailability?.();if(p?.read!==true)throw Error(p?.reason||'Pad READ unavailable.');
  };
  const context=version=>({sessionToken:session,isCurrent:()=>valid(version)});
  const failure=(version,error)=>{
    if(!valid(version))return;
    clearTargets();text('padStatus','UNVERIFIED · '+String(error?.message||error));
  };
  const renderSnapshot=()=>{
    const{target,metadata,assignment}=snapshot;
    text('padAssignment','PAD PARAMETERS · PROJECT '+target.project+' / GROUP '+target.group+' / PAD '+target.pad+
      (assignment.status==='VERIFIED'?' · ASSIGNED SAMPLE '+String(assignment.sampleSlot).padStart(3,'0'):' · ASSIGNMENT UNVERIFIED'));
    const fields=[['PITCH','sound.pitch',v=>typeof v==='number'&&Number.isFinite(v)&&v>=-12&&v<=12],
      ['PLAY MODE','sound.playmode',v=>['oneshot','key','legato'].includes(v)],
      ['TIME MODE','time.mode',v=>['off','bpm','bar'].includes(v)]];
    if(dom.padGrid)dom.padGrid.innerHTML='<dl>'+fields.map(([label,key,verified])=>
      '<dt>'+label+'</dt><dd data-pad-field="'+key+'">'+(verified(metadata[key])?escape(metadata[key]):'UNVERIFIED')+'</dd>').join('')+
      '</dl><details><summary>RAW PAD GET METADATA</summary><pre>'+escape(JSON.stringify(metadata,null,2))+'</pre></details>';
    text('padStatus','READ ONLY · '+(assignment.status==='VERIFIED'?'AUTHORITATIVE PAD GET':'ASSIGNMENT UNVERIFIED'));
  };
  const choose=async level=>{
    const version=++epoch;clearSnapshot();text('padStatus','READING PAD PARAMETERS…');
    try{
      guard();const project=dom.padProject?.value,group=dom.padGroup?.value;
      if(level==='pad'){
        const selected=targets.find(t=>t.pad===dom.padSelect?.value);
        if(!selected){text('padStatus','CHOOSE A PAD.');return;}
        const result=await reader.readTarget({...selected},context(version));
        if(!valid(version))return;guard();
        if(!sameTarget(selected,result?.target))throw Error('Pad target identity changed.');
        snapshot=result;renderSnapshot();return;
      }
      targets=[];options('padSelect',[],'PAD');if(level==='project')options('padGroup',[],'GROUP');
      if(!project||level==='group'&&!group){text('padStatus','CHOOSE A PROJECT, GROUP AND PAD.');return;}
      const result=await reader.listTargets({sampleSlot,project,...(level==='group'?{group}:{})},context(version));
      if(!valid(version))return;guard();
      if(level==='project')options('padGroup',result.groups.map(g=>g.group),'GROUP');
      else{
        targets=[...result.pads,...result.unverifiedPads];
        options('padSelect',targets.map(t=>({value:t.pad,label:t.pad+(t.assignment?' · UNVERIFIED':'')})),'PAD');
      }
      text('padStatus',level==='group'&&!targets.length?'NO VERIFIED ASSIGNMENTS FOR THIS SAMPLE.':'READ ONLY · CHOOSE A PAD.');
    }catch(error){failure(version,error);}
  };
  const close=()=>{
    opened=false;epoch++;session=null;clearTargets();text('padStatus','');if(dom.padDialog)dom.padDialog.hidden=true;
    const restore=previousFocus;previousFocus=null;restore?.focus?.();
  };
  const openFromSample=async slot=>{
    if(disposed)return;close();previousFocus=documentRef?.activeElement;opened=true;const version=++epoch;
    sampleSlot=Number(slot?.id??slot);text('padSource','SAMPLE LIBRARY '+String(sampleSlot).padStart(3,'0')+' · ASSIGNMENT FILTER ONLY');
    if(dom.padDialog)dom.padDialog.hidden=false;dom.padClose?.focus?.();text('padStatus','READING PAD TARGETS…');
    try{
      session=captureSession?.();guard();
      if(!Number.isInteger(sampleSlot)||sampleSlot<1||sampleSlot>999)throw Error('Select a library sample.');
      const result=await reader.listTargets({sampleSlot},context(version));
      if(!valid(version))return;guard();options('padProject',result.projects.map(p=>p.project),'PROJECT');
      text('padStatus','READ ONLY · CHOOSE A PROJECT, GROUP AND PAD.');
    }catch(error){failure(version,error);}
  };
  for(const[key,type,fn]of [['padClose','click',close],['padProject','change',()=>choose('project')],
    ['padGroup','change',()=>choose('group')],['padSelect','change',()=>choose('pad')]]){
    dom[key]?.addEventListener(type,fn);listeners.push([dom[key],type,fn]);
  }
  const captureKey=event=>{
    if(!opened)return;
    // The library owns document-level Delete/F2/arrows and window paste.
    // Capture before those handlers; native select navigation still works.
    event.stopImmediatePropagation();
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.key==='Tab'){
      event.preventDefault();
      const candidates=dom.padDialog?.querySelectorAll
        ?[...dom.padDialog.querySelectorAll('button,select,summary,[tabindex="0"]')]
        :[dom.padClose,dom.padProject,dom.padGroup,dom.padSelect];
      const controls=candidates.filter(el=>el&&!el.disabled);
      const index=controls.indexOf(documentRef?.activeElement),step=event.shiftKey?-1:1;
      controls[(index+step+controls.length)%controls.length]?.focus?.();
    }
  };
  const captureTransfer=event=>{if(opened){event.stopImmediatePropagation();event.preventDefault();}};
  const captureFocus=event=>{if(opened&&dom.padDialog?.contains&&!dom.padDialog.contains(event.target))dom.padClose?.focus?.();};
  for(const[type,fn]of [['keydown',captureKey],['paste',captureTransfer],['drop',captureTransfer],['focusin',captureFocus]]){
    documentRef?.addEventListener?.(type,fn,true);listeners.push([documentRef,type,fn,true]);
  }
  return Object.freeze({openFromSample,close,
    invalidate(reason='DEVICE SESSION CHANGED'){
      epoch++;session=null;clearTargets();if(opened)text('padStatus','STALE · '+reason+' · REOPEN TO READ AGAIN.');
    },
    dispose(){close();disposed=true;for(const[el,type,fn,capture]of listeners)el?.removeEventListener?.(type,fn,capture);}
  });
}

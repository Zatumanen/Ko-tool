import{
  PROJECT_EDITOR_FADER_PARAMS,PROJECT_EDITOR_FX_TYPES,
  createVerifiedProjectEditorDraft,buildVerifiedProjectEditorCandidate,
  summarizeVerifiedProjectChanges
}from '../projectEditor.js?v=20260930-5';

const GROUPS=['a','b','c','d'];
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[char]));
const number=value=>Number.isFinite(Number(value))?Number(value):0;

const makeProjectFile=(project,data)=>{
  const bytes=data instanceof Uint8Array?data:new Uint8Array(data||[]);
  const name='P'+project+'.tar';
  if(typeof File==='function')return new File([bytes],name,{type:'application/x-tar'});
  return{
    name,size:bytes.byteLength,type:'application/x-tar',
    async arrayBuffer(){return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);}
  };
};

export function getVerifiedProjectEditorAvailability(result){
  if(!result?.model)return{enabled:false,reason:'LOAD A PROJECT FIRST'};
  if(!result.model.profile?.projectAuthoring)
    return{enabled:false,reason:'AUTHORING NOT VERIFIED FOR THIS FIRMWARE'};
  if(result.active)
    return{enabled:false,reason:'ACTIVE PROJECT CANNOT BE EDITED'};
  if(result.dependencies?.allSamplesAvailable===false)
    return{enabled:false,reason:'PROJECT HAS MISSING SAMPLE DEPENDENCIES'};
  return{enabled:true,reason:'HARDWARE-VERIFIED AUTHORING'};
}

export function createVerifiedProjectEditorController({
  dialog,openButton,closeButton,form,summaryEl,saveButton,cancelButton,
  uploadProjectArchive,
  confirmAction=async()=>true,
  setStatus=()=>{},setGlobalProgress=()=>{},hideGlobalProgress=()=>{},
  refreshProjects=async()=>{},
  reportError=()=>{}
}={}){
  if(!dialog||!form||typeof uploadProjectArchive!=='function')
    throw new TypeError('Verified Project Editor dependencies are incomplete.');

  let result=null,draft=null,candidate=null,busy=false,selectedPadIndex=0;

  const setBusy=value=>{
    busy=!!value;
    saveButton.disabled=busy||!candidate?.changed;
    closeButton.disabled=busy;
    cancelButton.disabled=busy;
    form.querySelectorAll('input,select,button').forEach(control=>{
      if(control===saveButton||control===cancelButton)return;
      control.disabled=busy;
    });
  };

  const updateOpenButton=()=>{
    const availability=getVerifiedProjectEditorAvailability(result);
    openButton.disabled=!availability.enabled;
    openButton.title=availability.reason;
    openButton.dataset.verified=String(availability.enabled);
    return availability;
  };

  const padOptions=()=>{
    const pads=draft?.pads||[];
    return pads.map((pad,index)=>{
      const id=pad.group.toUpperCase()+String(pad.pad).padStart(2,'0');
      const source=pad.sampleSlot?(' · SLOT '+String(pad.sampleSlot).padStart(3,'0')):pad.supertone?' · SUPERTONE':' · EMPTY';
      return'<option value="'+index+'">'+id+source+'</option>';
    }).join('');
  };

  const renderPadFields=()=>{
    const pad=draft?.pads?.[selectedPadIndex];
    const target=form.querySelector('[data-editor-pad-fields]');
    if(!target)return;
    if(!pad){target.innerHTML='<div class="ep-project-editor-empty">NO PAD MEMBERS</div>';return;}
    const label=pad.group.toUpperCase()+String(pad.pad).padStart(2,'0');
    target.innerHTML=[
      '<div class="ep-editor-pad-head"><strong>',label,'</strong><span>',
      pad.sampleSlot?'SAMPLE SLOT '+String(pad.sampleSlot).padStart(3,'0'):pad.supertone?'SUPERTONE':'UNASSIGNED',
      '</span></div>',
      '<div class="ep-editor-field-grid">',
      '<label>MIDI CHANNEL<input data-pad-field="midiChannel" type="number" min="0" max="16" step="1" value="',pad.midiChannel,'"></label>',
      '<label>AMPLITUDE<input data-pad-field="amplitude" type="number" min="0" max="200" step="1" value="',pad.amplitude,'"></label>',
      '<label>PITCH<input data-pad-field="pitch" type="number" min="-12" max="12" step="1" value="',pad.pitch,'"></label>',
      '<label>PAN<input data-pad-field="pan" type="number" min="-16" max="16" step="1" value="',pad.pan,'"></label>',
      '<label>ATTACK<input data-pad-field="attack" type="number" min="0" max="255" step="1" value="',pad.attack,'"></label>',
      '<label>RELEASE<input data-pad-field="release" type="number" min="0" max="255" step="1" value="',pad.release,'"></label>',
      '<label>CHOKE GROUP<input data-pad-field="chokeGroup" type="number" min="0" max="255" step="1" value="',pad.chokeGroup,'"></label>',
      '<label>ROOT NOTE<input data-pad-field="rootNote" type="number" min="0" max="127" step="1" value="',pad.rootNote,'"></label>',
      '</div>',
      '<div class="ep-project-editor-note">SAMPLE SLOT / TRIM / PLAY MODE ARE PRESERVED IN THIS EDITOR.</div>'
    ].join('');
  };

  const renderForm=()=>{
    if(!draft)return;
    const groupRows=GROUPS.map(group=>{
      const current=draft.groupFaders[group];
      const options=PROJECT_EDITOR_FADER_PARAMS.map((name,index)=>
        '<option value="'+index+'"'+(index===Number(current.parameter)?' selected':'')+'>'+index+' · '+name+'</option>'
      ).join('');
      return'<div class="ep-editor-fader-row" data-fader-group="'+group+'">'+
        '<strong>'+group.toUpperCase()+'</strong>'+
        '<select data-fader-parameter>'+options+'</select>'+
        '<label>BASE <input data-fader-base type="number" min="-1" max="1" step="0.01" value="'+current.baseValue+'"></label>'+
        '</div>';
    }).join('');
    const fxOptions=PROJECT_EDITOR_FX_TYPES.map((name,index)=>
      '<option value="'+index+'"'+(index===Number(draft.fx.type)?' selected':'')+'>'+index+' · '+name+'</option>'
    ).join('');
    form.innerHTML=[
      '<section class="ep-project-editor-section"><h3>GENERAL</h3>',
      '<div class="ep-editor-field-grid"><label>BPM<input data-editor-bpm type="number" min="40" max="399" step="0.1" value="',
      draft.bpm??120,'"></label></div></section>',
      '<section class="ep-project-editor-section"><h3>GROUP FADERS</h3><div class="ep-editor-faders">',groupRows,'</div></section>',
      '<section class="ep-project-editor-section"><h3>FX</h3>',
      '<div class="ep-editor-field-grid">',
      '<label>TYPE<select data-editor-fx-type>',fxOptions,'</select></label>',
      '<label>PARAMETER X<input data-editor-fx-p1 type="number" min="0" max="1" step="0.01" value="',draft.fx.parameter1,'"></label>',
      '<label>PARAMETER Y<input data-editor-fx-p2 type="number" min="0" max="1" step="0.01" value="',draft.fx.parameter2,'"></label>',
      '<label>COMP DRIVE<input data-editor-comp-drive type="number" min="0" max="1" step="0.01" value="',draft.fx.compressorDrive,'"></label>',
      '<label>COMP SPEED<input data-editor-comp-speed type="number" min="0" max="1" step="0.01" value="',draft.fx.compressorSpeed,'"></label>',
      '</div></section>',
      '<section class="ep-project-editor-section"><h3>PADS · VERIFIED PERFORMANCE FIELDS</h3>',
      '<label class="ep-editor-pad-select">PAD<select data-editor-pad-select>',padOptions(),'</select></label>',
      '<div data-editor-pad-fields></div></section>'
    ].join('');
    const padSelect=form.querySelector('[data-editor-pad-select]');
    if(padSelect)padSelect.value=String(Math.min(selectedPadIndex,Math.max(0,draft.pads.length-1)));
    renderPadFields();
  };

  const syncDraftFromForm=()=>{
    if(!draft)return;
    const bpm=form.querySelector('[data-editor-bpm]');
    if(bpm)draft.bpm=number(bpm.value);
    for(const row of form.querySelectorAll('[data-fader-group]')){
      const group=row.dataset.faderGroup;
      draft.groupFaders[group]={
        parameter:number(row.querySelector('[data-fader-parameter]').value),
        baseValue:number(row.querySelector('[data-fader-base]').value)
      };
    }
    const fxType=form.querySelector('[data-editor-fx-type]');
    if(fxType){
      draft.fx.type=number(fxType.value);
      draft.fx.parameter1=number(form.querySelector('[data-editor-fx-p1]').value);
      draft.fx.parameter2=number(form.querySelector('[data-editor-fx-p2]').value);
      draft.fx.compressorDrive=number(form.querySelector('[data-editor-comp-drive]').value);
      draft.fx.compressorSpeed=number(form.querySelector('[data-editor-comp-speed]').value);
    }
    const pad=draft.pads[selectedPadIndex];
    if(pad)for(const input of form.querySelectorAll('[data-pad-field]'))
      pad[input.dataset.padField]=number(input.value);
  };

  const updateSummary=()=>{
    if(!draft||!result)return;
    try{
      syncDraftFromForm();
      candidate=buildVerifiedProjectEditorCandidate(result,draft);
      const summary=summarizeVerifiedProjectChanges(candidate.changes);
      summaryEl.className='ep-project-editor-summary'+(candidate.changed?' changed':'');
      summaryEl.innerHTML=candidate.changed
        ?'<strong>'+summary.total+' VERIFIED CHANGE'+(summary.total===1?'':'S')+'</strong>'+
          '<span>SETTINGS '+summary.settings+' · FX '+summary.fx+' · PAD '+summary.pads+'</span>'+
          '<em>WRITE WILL CREATE A RECOVERY CHECKPOINT AND REQUIRE READBACK VERIFICATION.</em>'
        :'<strong>NO CHANGES</strong><span>NATIVE PROJECT BYTES ARE UNCHANGED.</span>';
      saveButton.disabled=busy||!candidate.changed;
    }catch(error){
      candidate=null;
      summaryEl.className='ep-project-editor-summary error';
      summaryEl.innerHTML='<strong>INVALID EDIT</strong><span>'+escapeHtml(error?.message||error)+'</span>';
      saveButton.disabled=true;
    }
  };

  const setProject=next=>{
    result=next||null;
    draft=null;candidate=null;selectedPadIndex=0;
    updateOpenButton();
    if(!dialog.hidden&&!getVerifiedProjectEditorAvailability(result).enabled)close();
  };

  const open=()=>{
    const availability=updateOpenButton();
    if(!availability.enabled)throw new Error(availability.reason+'.');
    draft=createVerifiedProjectEditorDraft(result);
    candidate=null;selectedPadIndex=0;
    dialog.dataset.editorProjectNumber=draft.project;
    dialog.querySelector('[data-editor-project]').textContent='P'+draft.project;
    dialog.querySelector('[data-editor-evidence]').textContent=
      String(result.model.profile.id||'EP').toUpperCase()+' '+String(result.model.profile.firmware||'')+' · HARDWARE VERIFIED';
    renderForm();
    dialog.hidden=false;
    updateSummary();
  };
  const close=()=>{
    if(busy)return;
    dialog.hidden=true;
    draft=null;candidate=null;
  };

  form.addEventListener('input',event=>{
    if(event.target.matches('[data-editor-pad-select]'))return;
    updateSummary();
  });
  form.addEventListener('change',event=>{
    if(event.target.matches('[data-editor-pad-select]')){
      syncDraftFromForm();
      selectedPadIndex=number(event.target.value);
      renderPadFields();
      updateSummary();
      return;
    }
    updateSummary();
  });
  openButton?.addEventListener('click',()=>{try{open();}catch(error){reportError('PROJECT EDITOR UNAVAILABLE.',error);}});
  closeButton?.addEventListener('click',close);
  cancelButton?.addEventListener('click',close);

  saveButton?.addEventListener('click',async()=>{
    if(busy)return;
    updateSummary();
    if(!candidate?.changed)return;
    const summary=summarizeVerifiedProjectChanges(candidate.changes);
    const ok=await confirmAction(
      'Write '+summary.total+' verified change'+(summary.total===1?'':'s')+
      ' to inactive project P'+draft.project+'? A recovery checkpoint will be created first.'
    );
    if(!ok)return;
    setBusy(true);setGlobalProgress('PROJECT EDIT PRECHECK',10);
    try{
      const latest=buildVerifiedProjectEditorCandidate(result,draft);
      if(!latest.changed)throw new Error('Project editor has no changes to write.');
      setGlobalProgress('PROJECT EDIT WRITE',40);
      const saved=await uploadProjectArchive(makeProjectFile(draft.project,latest.archive),{
        requireInactive:true,
        performReload:false
      });
      setGlobalProgress('PROJECT EDIT VERIFY',94);
      const savedProject=draft.project;
      dialog.hidden=true;
      draft=null;candidate=null;
      await refreshProjects();
      setStatus('PROJECT P'+savedProject+' · VERIFIED EDIT SAVED');
      return saved;
    }catch(error){
      reportError('PROJECT EDIT FAILED.',error);
    }finally{
      hideGlobalProgress();
      setBusy(false);
    }
  });

  dialog.hidden=true;
  updateOpenButton();
  return Object.freeze({
    setProject,open,close,
    getState:()=>Object.freeze({
      busy,
      project:result?.project||null,
      available:getVerifiedProjectEditorAvailability(result),
      dirty:!!candidate?.changed,
      changeCount:candidate?.changes?.length||0
    })
  });
}

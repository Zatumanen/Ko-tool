import{
  SEQUENCER_GRID_TICKS,SEQUENCER_GRID_STEPS,
  getProjectSequencerAvailability,createProjectSequencerSession,summarizeSequencerPattern
}from '../projectSequencerUi.js?v=20261001-1';
import{formatProjectWriteDiffPreview}from '../projectWriteDiff.js?v=20261001-1';

const GROUPS=['A','B','C','D'];
const FADER_PARAMS=['LVL','PTC','TIM','LPF','HPF','FX','ATK','REL','PAN','TUNE','VEL','MOD'];
const number=value=>Number.isFinite(Number(value))?Number(value):0;
const integer=value=>Math.round(number(value));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[char]));
const projectFile=(project,data)=>{
  const bytes=data instanceof Uint8Array?data:new Uint8Array(data||[]);
  const name='P'+project+'.tar';
  if(typeof File==='function')return new File([bytes],name,{type:'application/x-tar'});
  return{name,size:bytes.byteLength,type:'application/x-tar',async arrayBuffer(){
    return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  }};
};

export function createProjectSequencerController({
  dialog,openButton,closeButton,patternSelect,barsInput,pageLabel,prevPageButton,nextPageButton,
  grid,rawEvents,automationPanel,patternSummary,saveButton,cancelButton,
  newPatternInput,newPatternBars,newPatternButton,
  defaultVelocity,defaultDuration,
  sceneIndexInput,sceneA,sceneB,sceneC,sceneD,sceneNumerator,sceneDenominator,sceneApplyButton,
  currentSceneInput,songInput,songApplyButton,
  uploadProjectArchive,
  confirmAction=async()=>true,
  setStatus=()=>{},setGlobalProgress=()=>{},hideGlobalProgress=()=>{},
  refreshProjects=async()=>{},
  reportError=()=>{}
}={}){
  if(!dialog||!grid||typeof uploadProjectArchive!=='function')
    throw new TypeError('Sequencer UI dependencies are incomplete.');

  let result=null;
  let session=null;
  let selectedPattern=null;
  let page=0;
  let busy=false;

  const setBusy=value=>{
    busy=!!value;
    for(const control of dialog.querySelectorAll('button,input,select')){
      if(busy){
        if(!control.hasAttribute('data-seq-was-disabled'))
          control.dataset.seqWasDisabled=String(!!control.disabled);
        control.disabled=true;
      }else{
        control.disabled=control.dataset.seqWasDisabled==='true';
        delete control.dataset.seqWasDisabled;
      }
    }
    updateAvailability();
    updateSaveState();
  };

  const updateAvailability=()=>{
    const availability=getProjectSequencerAvailability(result);
    if(openButton){
      openButton.disabled=busy||!availability.enabled;
      openButton.title=availability.reason;
      openButton.dataset.verified=String(availability.enabled);
    }
    return availability;
  };

  const currentPattern=()=>selectedPattern&&session?session.getPattern(selectedPattern):null;

  const updatePatternSelect=()=>{
    const patterns=session?.listPatterns()||[];
    patternSelect.innerHTML=patterns.map(pattern=>
      '<option value="'+escapeHtml(pattern.id)+'">'+escapeHtml(pattern.id)+' · '+pattern.bars+' BAR'+(pattern.bars===1?'':'S')+'</option>'
    ).join('');
    if(!selectedPattern||!patterns.some(pattern=>pattern.id===selectedPattern))
      selectedPattern=patterns[0]?.id||null;
    if(selectedPattern)patternSelect.value=selectedPattern;
  };

  const renderGrid=()=>{
    const pattern=currentPattern();
    grid.innerHTML='';
    if(!pattern){
      grid.innerHTML='<div class="ep-seq-empty">NO PATTERN SELECTED</div>';
      return;
    }
    const safety=session.getPatternSafety(pattern.id);
    const pageStart=page*SEQUENCER_GRID_STEPS*SEQUENCER_GRID_TICKS;
    const pageEnd=pageStart+SEQUENCER_GRID_STEPS*SEQUENCER_GRID_TICKS;
    const notes=pattern.records.filter(record=>record.kind==='note');
    const exact=new Map(notes.filter(record=>record.tick>=pageStart&&record.tick<pageEnd&&record.tick%SEQUENCER_GRID_TICKS===0)
      .map(record=>[record.pad+':'+((record.tick-pageStart)/SEQUENCER_GRID_TICKS),record]));
    const header=document.createElement('div');
    header.className='ep-seq-grid-row ep-seq-grid-header';
    header.innerHTML='<span>PAD</span>'+Array.from({length:SEQUENCER_GRID_STEPS},(_,step)=>
      '<b>'+(step+1)+'</b>'
    ).join('');
    grid.append(header);
    for(let pad=1;pad<=12;pad++){
      const row=document.createElement('div');
      row.className='ep-seq-grid-row';
      const padModel=result?.model?.pads?.[selectedPattern[0].toLowerCase()]?.find(item=>Number(item.pad)===pad);
      const source=padModel?.sampleSlot?String(padModel.sampleSlot).padStart(3,'0'):padModel?.supertone?'SYN':'—';
      row.innerHTML='<span class="ep-seq-pad-label">P'+String(pad).padStart(2,'0')+'<small>'+source+'</small></span>';
      for(let step=0;step<SEQUENCER_GRID_STEPS;step++){
        const record=exact.get(pad+':'+step);
        const button=document.createElement('button');
        button.type='button';
        button.className='ep-seq-step'+(record?' active':'');
        button.dataset.step=String(step);
        button.dataset.pad=String(pad);
        button.title=record
          ?'Tick '+record.tick+' · note '+record.note+' · velocity '+record.velocity+' · duration '+record.duration
          :'Add note at raw tick '+(pageStart+step*SEQUENCER_GRID_TICKS);
        button.disabled=busy||!safety.structuralEditsAllowed;
        button.textContent=record?'●':'·';
        button.onclick=()=>{
          try{
            const modelPad=result?.model?.pads?.[selectedPattern[0].toLowerCase()]?.find(item=>Number(item.pad)===pad);
            const root=Number(modelPad?.rootNote);
            session.toggleGridNote(pattern.id,{
              page,step,pad,
              note:Number.isInteger(root)?root:60,
              velocity:clamp(integer(defaultVelocity.value||100),1,127),
              duration:clamp(integer(defaultDuration.value||SEQUENCER_GRID_TICKS),1,65535)
            });
            renderAll();
          }catch(error){reportError('SEQUENCER GRID EDIT FAILED.',error);}
        };
        row.append(button);
      }
      grid.append(row);
    }
    if(!safety.structuralEditsAllowed){
      const warning=document.createElement('div');
      warning.className='ep-seq-structural-warning';
      warning.textContent='STRUCTURAL EDITS BLOCKED · '+safety.unknownRecords+' UNKNOWN NATIVE RECORD(S) PRESERVED';
      grid.append(warning);
    }
  };

  const noteRow=record=>{
    const structural=session.getPatternSafety(selectedPattern).structuralEditsAllowed;
    return'<div class="ep-seq-event-row" data-note-id="'+escapeHtml(record.id)+'">'+
      '<span>NOTE</span>'+
      '<label>TICK<input data-note-field="tick" type="number" min="0" max="65535" value="'+record.tick+'"'+(structural?'':' disabled')+'></label>'+
      '<label>PAD<input data-note-field="pad" type="number" min="1" max="12" value="'+record.pad+'"></label>'+
      '<label>PITCH<input data-note-field="note" type="number" min="0" max="127" value="'+record.note+'"></label>'+
      '<label>VEL<input data-note-field="velocity" type="number" min="1" max="127" value="'+record.velocity+'"></label>'+
      '<label>DUR<input data-note-field="duration" type="number" min="1" max="65535" value="'+record.duration+'"></label>'+
      '<button type="button" data-note-update>APPLY</button>'+
      '<button type="button" data-note-delete'+(structural?'':' disabled')+'>DELETE</button>'+
      '</div>';
  };

  const automationRow=record=>{
    const structural=session.getPatternSafety(selectedPattern).structuralEditsAllowed;
    const params=FADER_PARAMS.map((name,index)=>
      '<option value="'+index+'"'+(index===Number(record.parameter)?' selected':'')+'>'+index+' '+name+'</option>'
    ).join('');
    return'<div class="ep-seq-event-row ep-seq-auto-row" data-auto-id="'+escapeHtml(record.id)+'">'+
      '<span>AUTO</span>'+
      '<label>TICK<input data-auto-field="tick" type="number" min="0" max="65535" value="'+record.tick+'"'+(structural?'':' disabled')+'></label>'+
      '<label>PARAM<select data-auto-field="parameter">'+params+'</select></label>'+
      '<label>VALUE<input data-auto-field="value" type="number" min="0" max="32767" value="'+record.value+'"></label>'+
      '<button type="button" data-auto-update>APPLY</button>'+
      '<button type="button" data-auto-delete'+(structural?'':' disabled')+'>DELETE</button>'+
      '</div>';
  };

  const renderEvents=()=>{
    const pattern=currentPattern();
    if(!pattern){rawEvents.innerHTML='';automationPanel.innerHTML='';return;}
    const notes=pattern.records.filter(record=>record.kind==='note').sort((a,b)=>a.tick-b.tick||a.pad-b.pad);
    const automation=pattern.records.filter(record=>record.kind==='automation').sort((a,b)=>a.tick-b.tick||a.parameter-b.parameter);
    rawEvents.innerHTML=notes.length?notes.map(noteRow).join(''):'<div class="ep-seq-empty">NO NOTE EVENTS</div>';
    automationPanel.innerHTML=automation.length?automation.map(automationRow).join(''):'<div class="ep-seq-empty">NO AUTOMATION</div>';

    rawEvents.querySelectorAll('[data-note-id]').forEach(row=>{
      const id=row.dataset.noteId;
      row.querySelector('[data-note-update]').onclick=()=>{
        try{
          const changes={};
          row.querySelectorAll('[data-note-field]').forEach(input=>changes[input.dataset.noteField]=integer(input.value));
          session.editNote(selectedPattern,id,changes);renderAll();
        }catch(error){reportError('NOTE EDIT FAILED.',error);}
      };
      row.querySelector('[data-note-delete]').onclick=()=>{
        try{session.removeNote(selectedPattern,id);renderAll();}
        catch(error){reportError('NOTE DELETE FAILED.',error);}
      };
    });
    automationPanel.querySelectorAll('[data-auto-id]').forEach(row=>{
      const id=row.dataset.autoId;
      row.querySelector('[data-auto-update]').onclick=()=>{
        try{
          const changes={};
          row.querySelectorAll('[data-auto-field]').forEach(input=>changes[input.dataset.autoField]=integer(input.value));
          session.editAutomation(selectedPattern,id,changes);renderAll();
        }catch(error){reportError('AUTOMATION EDIT FAILED.',error);}
      };
      row.querySelector('[data-auto-delete]').onclick=()=>{
        try{session.removeAutomation(selectedPattern,id);renderAll();}
        catch(error){reportError('AUTOMATION DELETE FAILED.',error);}
      };
    });
  };

  const updateSaveState=()=>{
    if(!session){saveButton.disabled=true;return;}
    try{
      const built=session.build();
      saveButton.disabled=busy||!built.changed;
      dialog.dataset.dirty=String(built.changed);
    }catch(error){
      saveButton.disabled=true;
      dialog.dataset.dirty='false';
      if(patternSummary)patternSummary.textContent='INVALID: '+String(error?.message||error);
    }
  };

  const renderSummary=()=>{
    const pattern=currentPattern();
    if(!pattern){patternSummary.textContent='NO PATTERN';return;}
    const summary=summarizeSequencerPattern(pattern);
    const safety=session.getPatternSafety(pattern.id);
    patternSummary.textContent=
      summary.id+' · '+summary.bars+' BAR'+(summary.bars===1?'':'S')+
      ' · '+summary.notes+' NOTES · '+summary.automation+' AUTO'+
      (summary.unknown?' · '+summary.unknown+' UNKNOWN':'')+
      ' · RAW TICK MAX '+summary.maxTick+
      (safety.structuralEditsAllowed?'':' · VALUE-ONLY SAFE MODE');
    barsInput.value=String(pattern.bars);
    pageLabel.textContent='PAGE '+(page+1)+' · TICKS '+
      (page*SEQUENCER_GRID_STEPS*SEQUENCER_GRID_TICKS)+'–'+
      ((page+1)*SEQUENCER_GRID_STEPS*SEQUENCER_GRID_TICKS-1);
    const maxPage=Math.floor(65535/(SEQUENCER_GRID_TICKS*SEQUENCER_GRID_STEPS));
    prevPageButton.disabled=busy||page<=0;
    nextPageButton.disabled=busy||page>=maxPage;
  };

  const renderSceneInputs=()=>{
    const scene=clamp(integer(sceneIndexInput.value||result?.model?.scenes?.currentScene||1),1,99);
    sceneIndexInput.value=String(scene);
    const native=result?.model?.scenes?.entries?.find(item=>Number(item.index)===scene);
    const refs=native?.groupPatterns||{};
    sceneA.value=String(Number(refs.a)||0);
    sceneB.value=String(Number(refs.b)||0);
    sceneC.value=String(Number(refs.c)||0);
    sceneD.value=String(Number(refs.d)||0);
    if(sceneNumerator&&sceneDenominator){
      const sig=native?.timeSignature;
      sceneNumerator.value=String(sig?.numerator||4);
      sceneDenominator.value=String(sig?.denominator||4);
      const blocked=result?.model?.profile?.id==='ep40';
      sceneNumerator.disabled=blocked;sceneDenominator.disabled=blocked;
    }
    currentSceneInput.value=String(Number(result?.model?.scenes?.currentScene)||1);
    songInput.value=(result?.model?.scenes?.song||[]).join(',');
  };

  const renderAll=()=>{
    updatePatternSelect();
    renderGrid();
    renderEvents();
    renderSummary();
    updateSaveState();
  };

  const setProject=next=>{
    result=next||null;
    session=null;selectedPattern=null;page=0;
    updateAvailability();
    if(!dialog.hidden&&!getProjectSequencerAvailability(result).enabled)close();
  };

  const open=()=>{
    const availability=updateAvailability();
    if(!availability.enabled)throw new Error(availability.reason+'.');
    session=createProjectSequencerSession(result);
    selectedPattern=session.listPatterns()[0]?.id||null;
    page=0;
    dialog.querySelector('[data-seq-project]').textContent='P'+result.project;
    dialog.querySelector('[data-seq-evidence]').textContent=
      String(result.model.profile.id||'EP').toUpperCase()+' '+String(result.model.profile.firmware||'')+
      ' · HARDWARE VERIFIED';
    dialog.hidden=false;
    renderSceneInputs();
    renderAll();
  };
  const close=()=>{
    if(busy)return;
    dialog.hidden=true;session=null;selectedPattern=null;page=0;
  };

  patternSelect.addEventListener('change',()=>{
    selectedPattern=patternSelect.value;page=0;renderAll();
  });
  barsInput.addEventListener('change',()=>{
    try{session.setPatternBars(selectedPattern,clamp(integer(barsInput.value),1,99));renderAll();}
    catch(error){reportError('PATTERN BAR EDIT FAILED.',error);renderAll();}
  });
  prevPageButton.addEventListener('click',()=>{if(page>0){page--;renderAll();}});
  nextPageButton.addEventListener('click',()=>{
    const maxPage=Math.floor(65535/(SEQUENCER_GRID_TICKS*SEQUENCER_GRID_STEPS));
    if(page<maxPage){page++;renderAll();}
  });

  newPatternButton.addEventListener('click',()=>{
    try{
      const id=String(newPatternInput.value||'').toUpperCase();
      session.createPattern(id,{bars:clamp(integer(newPatternBars.value||1),1,99)});
      selectedPattern=id;page=0;renderAll();
    }catch(error){reportError('CREATE PATTERN FAILED.',error);}
  });

  dialog.querySelector('[data-seq-add-note]').addEventListener('click',()=>{
    try{
      session.addNote(selectedPattern,{
        tick:integer(dialog.querySelector('[data-seq-note-tick]').value),
        pad:integer(dialog.querySelector('[data-seq-note-pad]').value),
        note:integer(dialog.querySelector('[data-seq-note-pitch]').value),
        velocity:integer(dialog.querySelector('[data-seq-note-velocity]').value),
        duration:integer(dialog.querySelector('[data-seq-note-duration]').value)
      });
      renderAll();
    }catch(error){reportError('ADD NOTE FAILED.',error);}
  });
  dialog.querySelector('[data-seq-add-auto]').addEventListener('click',()=>{
    try{
      session.addAutomation(selectedPattern,{
        tick:integer(dialog.querySelector('[data-seq-auto-tick]').value),
        parameter:integer(dialog.querySelector('[data-seq-auto-param]').value),
        value:integer(dialog.querySelector('[data-seq-auto-value]').value)
      });
      renderAll();
    }catch(error){reportError('ADD AUTOMATION FAILED.',error);}
  });

  sceneIndexInput.addEventListener('change',renderSceneInputs);
  sceneApplyButton.addEventListener('click',()=>{
    try{
      const refs=[sceneA,sceneB,sceneC,sceneD].map(input=>clamp(integer(input.value),0,99));
      const spec={groupPatterns:refs};
      if(result.model.profile.id==='ep133')
        spec.timeSignature=[clamp(integer(sceneNumerator.value),1,255),clamp(integer(sceneDenominator.value),1,255)];
      session.setScene(clamp(integer(sceneIndexInput.value),1,99),spec);
      updateSaveState();
      setStatus('SEQUENCER SCENE EDIT STAGED');
    }catch(error){reportError('SCENE EDIT FAILED.',error);}
  });
  songApplyButton.addEventListener('click',()=>{
    try{
      const current=clamp(integer(currentSceneInput.value),1,99);
      const song=String(songInput.value||'').split(',').map(value=>value.trim()).filter(Boolean).map(value=>clamp(integer(value),1,99));
      session.setCurrentScene(current);
      session.setSong(song);
      updateSaveState();
      setStatus('SEQUENCER SONG EDIT STAGED');
    }catch(error){reportError('SONG EDIT FAILED.',error);}
  });

  openButton?.addEventListener('click',()=>{try{open();}catch(error){reportError('SEQUENCER UNAVAILABLE.',error);}});
  closeButton?.addEventListener('click',close);
  cancelButton?.addEventListener('click',close);

  saveButton.addEventListener('click',async()=>{
    if(busy||!session)return;
    let built;
    try{built=session.build();}catch(error){reportError('SEQUENCER BUILD FAILED.',error);return;}
    if(!built.changed)return;
    setBusy(true);setGlobalProgress('SEQUENCER PREVIEW',10);
    try{
      if(typeof uploadProjectArchive.preview!=='function')
        throw new Error('Project write diff preview is unavailable.');
      const file=projectFile(result.project,built.archive);
      const preview=await uploadProjectArchive.preview(file,{requireInactive:true});
      setGlobalProgress('SEQUENCER DIFF',24);
      const ok=await confirmAction(
        formatProjectWriteDiffPreview(preview,{label:'SEQUENCER'})+
        ' · CONTINUE? A RECOVERY CHECKPOINT WILL BE CREATED BEFORE FILE PUT AND THE ARCHIVE WILL BE READ BACK.'
      );
      if(!ok){setStatus('PROJECT P'+result.project+' · SEQUENCER CANCELLED');return;}
      setGlobalProgress('SEQUENCER WRITE',42);
      await uploadProjectArchive(file,{
        requireInactive:true,
        performReload:false,
        expectedOriginalCrc32:preview.original.crc32,
        expectedCandidateCrc32:preview.candidate.crc32
      });
      dialog.hidden=true;session=null;selectedPattern=null;page=0;
      setGlobalProgress('SEQUENCER VERIFY',94);
      await refreshProjects();
      setStatus('PROJECT P'+result.project+' · SEQUENCER VERIFIED');
    }catch(error){
      reportError('SEQUENCER WRITE FAILED.',error);
    }finally{
      hideGlobalProgress();setBusy(false);
    }
  });

  dialog.hidden=true;
  updateAvailability();
  return Object.freeze({
    setProject,open,close,
    getState:()=>Object.freeze({
      busy,
      project:result?.project||null,
      available:getProjectSequencerAvailability(result),
      selectedPattern,
      page,
      dirty:dialog.dataset.dirty==='true'
    })
  });
}
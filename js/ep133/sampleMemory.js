export const EP_SAMPLE_SLOT_COUNT=999;
export const EP_SAMPLE_PAGE_SIZE=29;

export const DEFAULT_SAMPLE_TABS=[
  {name:'KICK',range:[1,99]},
  {name:'SNARE',range:[100,199]},
  {name:'CYMB',range:[200,299]},
  {name:'PERC',range:[300,399]},
  {name:'BASS',range:[400,499]},
  {name:'MELOD',range:[500,599]},
  {name:'LOOP',range:[600,699]},
  {name:'USER 1',range:[700,799]},
  {name:'USER 2',range:[800,899]},
  {name:'SFX',range:[900,999]}
];

export function createSampleSlots(entries=[]){
  const slots=Array.from({length:EP_SAMPLE_SLOT_COUNT},(_,i)=>({id:i+1,file:null,meta:null,node:null,nodeId:i+1}));
  for(const entry of entries){
    const nodeId=Number(entry?.nodeId);
    if(!Number.isInteger(nodeId)||nodeId<1||nodeId>EP_SAMPLE_SLOT_COUNT)continue;
    if(!/^\/sounds\/[^/]+$/.test(entry.fileName||''))continue;
    const slot=slots[nodeId-1];
    slot.file={
      name:(entry.fileName||'').split('/').pop(),
      path:entry.fileName,
      size:Number(entry.fileSize)||0
    };
    slot.node=entry;
    slot.nodeId=nodeId;
  }
  return slots;
}

export function applySampleMetadata(slots,nodeId,meta){
  const slot=slots[Number(nodeId)-1];
  if(slot)slot.meta=meta||null;
}

export function getSampleDisplayName(slot){
  return String(slot?.meta?.name||slot?.file?.name||'');
}

export function calculateSampleDuration(slot){
  const size=Number(slot?.file?.size);
  const samplerate=Number(slot?.meta?.samplerate);
  const channels=Number(slot?.meta?.channels);
  if(!Number.isFinite(size)||!Number.isFinite(samplerate)||!Number.isFinite(channels)||size<0||samplerate<=0||channels<=0)return null;
  return size/2/samplerate/channels;
}

export function findNextFreeSampleSlot(slots,start=1){
  const first=Math.max(1,Number(start)||1);
  for(let id=first;id<=EP_SAMPLE_SLOT_COUNT;id++)if(!slots[id-1]?.file)return id;
  return -1;
}

export function canTransferMoveSample(slot){
  return !!slot?.file&&slot.node?.isReadable===true&&slot.node?.isDeletable===true;
}

export function planSampleTransferTargets(slots,sourceIds,draggedId,dropId){
  const sources=[...new Set((sourceIds||[]).map(Number).filter(id=>Number.isInteger(id)&&id>=1&&id<=EP_SAMPLE_SLOT_COUNT))].sort((a,b)=>a-b);
  const drag=Number(draggedId);
  const drop=Number(dropId);
  if(!sources.length||!Number.isInteger(drag)||!sources.includes(drag)||!Number.isInteger(drop)||drop<1||drop>EP_SAMPLE_SLOT_COUNT)return[];
  const reserved=new Set();
  const blocked=new Set(sources);
  const free=id=>id>=1&&id<=EP_SAMPLE_SLOT_COUNT&&!reserved.has(id)&&!blocked.has(id)&&!slots[id-1]?.file;
  if(sources.length===1){
    for(let delta=0;delta<EP_SAMPLE_SLOT_COUNT;delta++){
      const up=drop+delta;
      if(free(up))return[{sourceId:sources[0],targetId:up}];
      if(delta){
        const down=drop-delta;
        if(free(down))return[{sourceId:sources[0],targetId:down}];
      }
    }
    return[];
  }
  const pairs=[];
  let spill=0;
  let previousTarget=0;
  for(const sourceId of sources){
    let candidate=drop+(sourceId-drag)+spill;
    candidate=Math.max(candidate,previousTarget+1,1);
    while(candidate<=EP_SAMPLE_SLOT_COUNT&&!free(candidate)){candidate+=1;spill+=1;}
    if(candidate>EP_SAMPLE_SLOT_COUNT)return[];
    reserved.add(candidate);
    previousTarget=candidate;
    pairs.push({sourceId,targetId:candidate});
  }
  return pairs;
}

export function createSampleMemory({
  listEl,
  tabsEl,
  searchEl,
  searchClearEl,
  onSelect,
  onPlay,
  onDrop,
  onTransfer,
  onDelete,
  onDownload,
  onDownloadMany,
  onRename,
  onContext,
  onDragStart,
  onUserError
}){
  let slots=createSampleSlots([]);
  let sampleTabs=DEFAULT_SAMPLE_TABS;
  let activeTab=0;
  let selectedId=null;
  let selectedIds=new Set();
  let selectionAnchor=null;
  let previewingId=null;
  let editingId=null;
  let editingOriginalName='';
  let editingValue='';
  let renamePending=false;
  let mutationsEnabled=false;
  let dragSourceId=0;
  let suppressClick=false;
  const slotOperations=new Map();

  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slotName=getSampleDisplayName;
  const formatSize=size=>{
    const value=Number(size);
    if(!Number.isFinite(value)||value<=0)return'';
    if(value<1024)return value+' B';
    if(value<1024*1024)return(value/1024).toFixed(1)+' KB';
    return(value/1024/1024).toFixed(2)+' MB';
  };
  const formatRate=rate=>{
    const value=Number(rate);
    if(!Number.isFinite(value)||value<=0)return'';
    const khz=value/1000;
    const text=Number.isInteger(khz)?String(khz):khz.toFixed(3).replace(/0+$/,'').replace(/\.$/,'');
    return text+' kHz';
  };
  const tabForSlot=id=>sampleTabs.findIndex(tab=>id>=tab.range[0]&&id<=tab.range[1]);
  const query=()=>String(searchEl?.value||'').trim().toLowerCase();
  const matchesSearch=slot=>{
    const q=query();
    if(!q)return false;
    return String(slot.id).includes(q)||slotName(slot).toLowerCase().includes(q);
  };
  const visible=()=>{
    const tab=sampleTabs[activeTab]||sampleTabs[0];
    return tab?slots.slice(tab.range[0]-1,tab.range[1]):[];
  };
  const selectedFiles=()=>[...selectedIds].sort((a,b)=>a-b).map(id=>slots[id-1]).filter(slot=>slot?.file);
  const scrollSelectedIntoView=()=>{
    if(!selectedId||!listEl)return;
    listEl.querySelector('[data-slot="'+selectedId+'"]')?.scrollIntoView?.({block:'nearest'});
  };
  const notifySelection=(slot,preview)=>{
    onSelect?.(slot||null);
    if(preview&&slot?.file){
      previewingId=slot.id;
      render();
      Promise.resolve(onPlay?.(slot)).catch(()=>{
        if(previewingId===slot.id){previewingId=null;render();}
      });
    }
  };
  const setSelection=(ids,activeId,{preview=false,navigate=true,anchor=true}={})=>{
    const valid=[...new Set((ids||[]).map(Number).filter(id=>Number.isInteger(id)&&id>=1&&id<=EP_SAMPLE_SLOT_COUNT))];
    if(!valid.length){
      selectedId=null;selectedIds=new Set();selectionAnchor=null;render();onSelect?.(null);return;
    }
    let active=Number(activeId);
    if(!valid.includes(active))active=valid[0];
    if(navigate){
      const tabIndex=tabForSlot(active);
      if(tabIndex>=0&&tabIndex!==activeTab){activeTab=tabIndex;renderTabs();}
    }
    selectedIds=new Set(valid);
    selectedId=active;
    if(anchor)selectionAnchor=active;
    render();
    scrollSelectedIntoView();
    notifySelection(slots[active-1],preview);
  };
  const selectClick=(slot,event)=>{
    const additive=!!(event?.ctrlKey||event?.metaKey);
    const extend=!!event?.shiftKey;
    if(extend&&selectionAnchor){
      const start=Math.min(selectionAnchor,slot.id),end=Math.max(selectionAnchor,slot.id);
      setSelection(Array.from({length:end-start+1},(_,i)=>start+i),slot.id,{preview:false,anchor:false});
      return;
    }
    if(additive){
      const next=new Set(selectedIds);
      if(next.has(slot.id))next.delete(slot.id);else next.add(slot.id);
      if(!next.size){setSelection([],null);return;}
      const active=next.has(slot.id)?slot.id:[...next].at(-1);
      setSelection([...next],active,{preview:false,anchor:next.has(slot.id)});
      return;
    }
    setSelection([slot.id],slot.id,{preview:!!slot.file});
  };
  const syncSearchTab=()=>{
    const q=query();
    if(!q){render();return;}
    const match=slots.find(matchesSearch);
    if(match){
      const tabIndex=tabForSlot(match.id);
      if(tabIndex>=0&&tabIndex!==activeTab){activeTab=tabIndex;renderTabs();}
    }
    render();
  };

  const renderTabs=()=>{
    if(!tabsEl)return;
    tabsEl.style.setProperty('--ep-tab-count',String(Math.max(1,sampleTabs.length)));
    tabsEl.innerHTML=sampleTabs.map((tab,index)=>{
      return'<button type="button" class="ep133-sample-tab'+(index===activeTab?' selected':'')+'" data-tab="'+index+'" title="'+escapeHtml(tab.name)+'">'+escapeHtml(tab.name)+'</button>';
    }).join('');
    tabsEl.querySelectorAll('[data-tab]').forEach(button=>{
      button.addEventListener('click',()=>{
        activeTab=Number(button.dataset.tab);
        renderTabs();
        const tab=sampleTabs[activeTab];
        if(tab)setSelection([tab.range[0]],tab.range[0],{preview:false,navigate:false});
      });
    });
  };

  const finishRename=async(slot,{save=true}={})=>{
    if(editingId!==slot?.id||renamePending)return;
    const original=editingOriginalName;
    const value=editingValue;
    if(!save||!mutationsEnabled||!value.trim()||value===original){
      editingId=null;editingOriginalName='';editingValue='';render();return;
    }
    renamePending=true;
    try{
      const renamed=await onRename?.(slot,value);
      if(renamed)slot.meta={...(slot.meta||{}),name:renamed};
    }catch(error){
      onUserError?.('COULD NOT RENAME SAMPLE.',error);
    }finally{
      renamePending=false;editingId=null;editingOriginalName='';editingValue='';render();
    }
  };

  const channelIcon=slot=>{
    const channels=Number(slot?.meta?.channels);
    if(channels!==1&&channels!==2)return'<span class="ep133-channel-empty"></span>';
    const label=channels===1?'Mono':'Stereo';
    return'<span class="ep133-channel-icon '+(channels===1?'mono':'stereo')+'" title="'+label+'" aria-label="'+label+'" role="img"></span>';
  };

  const operationCell=operation=>{
    if(!operation)return null;
    const progress=Number(operation.progress);
    if(Number.isFinite(progress)){
      const value=Math.max(0,Math.min(100,progress));
      return'<span class="ep133-row-progress" title="'+escapeHtml(operation.label||operation.status||'')+'"><span style="width:'+value+'%"></span></span>';
    }
    return'<span class="ep133-operation-label">'+escapeHtml(operation.label||operation.status||'')+'</span>';
  };

  const render=()=>{
    if(!listEl)return;
    listEl.innerHTML=visible().map(slot=>{
      const active=slot.id===selectedId;
      const secondary=selectedIds.has(slot.id)&&!active;
      const occupied=!!slot.file;
      const operation=slotOperations.get(slot.id)||null;
      const editing=editingId===slot.id;
      const name=slotName(slot);
      const nameControl=occupied
        ?'<input class="ep133-sample-name-input" data-name-input="'+slot.id+'" maxlength="16" value="'+escapeHtml(editing?editingValue:name)+'" '+(editing?'':'readonly')+' title="'+escapeHtml(name)+'" aria-label="Sample name">'
        :'<span class="ep133-sample-name"></span>';
      const actionButtons=active&&occupied
        ?'<span class="ep133-row-actions"><button type="button" data-download-row="'+slot.id+'" title="Download selected sample(s)" aria-label="Download selected sample(s)">↓</button>'+(slot.node?.isDeletable===true?'<button type="button" data-delete-row="'+slot.id+'" title="Delete selected sample(s)" aria-label="Delete selected sample(s)">×</button>':'')+'</span>'
        :'';
      const opCell=operationCell(operation);
      const draggable=mutationsEnabled&&occupied&&slot.node?.isReadable===true?' draggable="true"':'';
      return'<div class="ep133-sample-row '+(occupied?'occupied':'empty')+(active?' selected':'')+(secondary?' multi-selected':'')+(previewingId===slot.id?' previewing':'')+(matchesSearch(slot)?' search-match':'')+(operation?' operation-active':'')+'" data-slot="'+slot.id+'" role="option" aria-selected="'+(selectedIds.has(slot.id)?'true':'false')+'"'+draggable+'>'+
        '<span class="ep133-sample-number">'+String(slot.id).padStart(3,'0')+'</span>'+
        nameControl+
        '<span class="ep133-sample-size">'+(opCell||escapeHtml(occupied?formatSize(slot.file.size):''))+'</span>'+
        '<span class="ep133-sample-channel">'+(occupied?channelIcon(slot):'')+'</span>'+
        '<span class="ep133-sample-rate">'+escapeHtml(occupied?formatRate(slot.meta?.samplerate):'')+'</span>'+
        actionButtons+
        '</div>';
    }).join('');

    listEl.querySelectorAll('[data-slot]').forEach(row=>{
      const slot=slots[Number(row.dataset.slot)-1];
      const nameInput=row.querySelector('[data-name-input]');
      if(nameInput){
        nameInput.addEventListener('click',event=>{if(editingId===slot.id)event.stopPropagation();});
        nameInput.addEventListener('dblclick',event=>{
          if(!mutationsEnabled||!slot.file||slot.node?.isWritable!==true||selectedIds.size>1)return;
          event.preventDefault();event.stopPropagation();
          editingId=slot.id;editingOriginalName=slotName(slot);editingValue=editingOriginalName;render();
        });
        if(editingId===slot.id){
          nameInput.readOnly=false;
          nameInput.addEventListener('input',()=>{editingValue=nameInput.value;});
          nameInput.addEventListener('keydown',event=>{
            if(event.key==='Enter'){event.preventDefault();event.stopPropagation();void finishRename(slot,{save:true});}
            else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();void finishRename(slot,{save:false});}
          });
          nameInput.addEventListener('blur',()=>{void finishRename(slot,{save:true});});
          setTimeout(()=>{if(editingId===slot.id&&nameInput.isConnected){nameInput.focus();nameInput.select();}},0);
        }
      }

      row.querySelector('[data-download-row]')?.addEventListener('click',async event=>{
        event.preventDefault();event.stopPropagation();
        const files=selectedFiles();
        if(!files.length)return;
        try{
          if(files.length>1)await onDownloadMany?.(files);
          else await onDownload?.(files[0]);
        }catch(error){onUserError?.('COULD NOT DOWNLOAD SAMPLE.',error);}
      });
      row.querySelector('[data-delete-row]')?.addEventListener('click',async event=>{
        event.preventDefault();event.stopPropagation();
        if(!mutationsEnabled)return;
        const targets=selectedFiles().filter(item=>item.node?.isDeletable===true);
        if(!targets.length)return;
        try{
          const deleted=await onDelete?.(targets);
          if(deleted!==false){
            for(const item of targets)clearSlotInternal(item.id);
            render();
          }
        }catch(error){onUserError?.('COULD NOT DELETE SAMPLE.',error);}
      });

      row.addEventListener('click',event=>{
        if(suppressClick||event.target.closest('button'))return;
        selectClick(slot,event);
      });
      row.addEventListener('contextmenu',event=>{
        if(!slot.file)return;
        event.preventDefault();
        setSelection([slot.id],slot.id,{preview:false});
        onContext?.(slots[slot.id-1],event);
      });

      row.addEventListener('dragstart',event=>{
        if(!mutationsEnabled||!slot.file||slot.node?.isReadable!==true){event.preventDefault();return;}
        if(!selectedIds.has(slot.id)){
          selectedIds=new Set([slot.id]);
          selectedId=slot.id;
          selectionAnchor=slot.id;
          onSelect?.(slot);
        }
        dragSourceId=slot.id;
        suppressClick=true;
        onDragStart?.();
        const files=selectedFiles();
        event.dataTransfer.effectAllowed='copyMove';
        event.dataTransfer.setData('application/x-speeduppercut-slot',String(slot.id));
        event.dataTransfer.setData('text/plain',String(slot.id));
        for(const item of files)listEl.querySelector('[data-slot="'+item.id+'"]')?.classList.add('dragging');
      });
      row.addEventListener('dragend',()=>{
        listEl.querySelectorAll('.ep133-sample-row.dragging').forEach(item=>item.classList.remove('dragging'));
        render();
        setTimeout(()=>{suppressClick=false;dragSourceId=0;},0);
      });
      row.addEventListener('dragover',event=>{
        event.preventDefault();
        const internal=dragSourceId||Number(event.dataTransfer?.getData('application/x-speeduppercut-slot')||0);
        event.dataTransfer.dropEffect=internal&&(event.ctrlKey||event.metaKey)?'copy':internal?'move':'copy';
        row.classList.add('dragover');
      });
      row.addEventListener('dragleave',event=>{
        if(event.relatedTarget&&row.contains(event.relatedTarget))return;
        row.classList.remove('dragover');
      });
      row.addEventListener('drop',async event=>{
        event.preventDefault();event.stopPropagation();row.classList.remove('dragover');
        if(!mutationsEnabled)return;
        const sourceId=dragSourceId||Number(event.dataTransfer?.getData('application/x-speeduppercut-slot')||event.dataTransfer?.getData('text/plain')||0);
        const source=sourceId?slots[sourceId-1]:null;
        if(source?.file){
          const sources=selectedFiles().length&&selectedIds.has(source.id)?selectedFiles():[source];
          const copy=!!(event.ctrlKey||event.metaKey||event.dataTransfer?.dropEffect==='copy');
          if(!copy&&sources.some(item=>item.id===slot.id))return;
          try{
            const result=await onTransfer?.(sources,slot,{copy,draggedId:source.id});
            const ids=Array.isArray(result?.targetIds)?result.targetIds:[];
            if(ids.length)setSelection(ids,ids[0],{preview:false});
          }catch(error){onUserError?.(copy?'COULD NOT COPY SAMPLE.':'COULD NOT MOVE SAMPLE.',error);}
          return;
        }
        try{await onDrop?.(slot,event);}catch(error){onUserError?.('COULD NOT UPLOAD SAMPLE.',error);}
      });
    });
  };

  const clearSlotInternal=id=>{
    const nodeId=Number(id);
    if(!Number.isInteger(nodeId)||nodeId<1||nodeId>EP_SAMPLE_SLOT_COUNT)return;
    slots[nodeId-1]={id:nodeId,file:null,meta:null,node:null,nodeId};
    slotOperations.delete(nodeId);
    if(previewingId===nodeId)previewingId=null;
  };

  const keyboardActive=()=>{
    if(!listEl||listEl.offsetParent===null)return false;
    const active=document.activeElement;
    if(active?.closest?.('.ep133-properties'))return false;
    if(active===searchEl)return false;
    if(active?.tagName==='TEXTAREA'||active?.tagName==='SELECT')return false;
    if(active?.tagName==='INPUT'&&!active.matches?.('.ep133-sample-name-input[readonly]'))return false;
    return editingId===null;
  };
  const moveSelection=direction=>{
    const tab=sampleTabs[activeTab]||sampleTabs[0];
    if(!tab)return;
    const first=tab.range[0],last=tab.range[1];
    const current=selectedId>=first&&selectedId<=last?selectedId:first;
    const target=Math.max(first,Math.min(last,current+direction));
    if(target!==selectedId)setSelection([target],target,{preview:!!slots[target-1]?.file,navigate:false});
  };
  const changeTab=direction=>{
    const next=Math.max(0,Math.min(sampleTabs.length-1,activeTab+direction));
    if(next===activeTab)return;
    activeTab=next;renderTabs();
    const tab=sampleTabs[activeTab];
    setSelection([tab.range[0]],tab.range[0],{preview:false,navigate:false});
  };
  const requestDeleteSelected=async()=>{
    if(!mutationsEnabled)return;
    const targets=selectedFiles().filter(item=>item.node?.isDeletable===true);
    if(!targets.length)return;
    try{
      const deleted=await onDelete?.(targets);
      if(deleted!==false){for(const item of targets)clearSlotInternal(item.id);render();}
    }catch(error){onUserError?.('COULD NOT DELETE SAMPLE.',error);}
  };
  const keyDown=event=>{
    if(!keyboardActive())return;
    if(event.key==='ArrowUp'||event.key==='ArrowDown'){
      event.preventDefault();moveSelection(event.key==='ArrowUp'?-1:1);return;
    }
    if(event.key==='PageUp'||event.key==='PageDown'){
      event.preventDefault();changeTab(event.key==='PageUp'?-1:1);return;
    }
    if((event.key==='Delete'||event.key==='Backspace')&&mutationsEnabled){
      event.preventDefault();void requestDeleteSelected();
    }
  };
  document.addEventListener('keydown',keyDown);

  searchEl?.addEventListener('input',syncSearchTab);
  searchClearEl?.addEventListener('click',()=>{
    if(searchEl)searchEl.value='';
    render();
    searchEl?.focus();
  });

  renderTabs();
  render();

  return{
    setSlots(next){
      slots=Array.isArray(next)&&next.length?next:createSampleSlots([]);
      selectedId=null;selectedIds=new Set();selectionAnchor=null;previewingId=null;
      activeTab=Math.min(activeTab,Math.max(0,sampleTabs.length-1));
      renderTabs();render();
    },
    setTabs(nextTabs){
      const normalized=Array.isArray(nextTabs)?nextTabs.map(tab=>({
        name:String(tab?.name??''),
        range:[Number(tab?.range?.[0]),Number(tab?.range?.[1])],
        color:tab?.color
      })).filter(tab=>tab.name&&Number.isInteger(tab.range[0])&&Number.isInteger(tab.range[1])&&tab.range[0]>=1&&tab.range[1]>=tab.range[0]&&tab.range[1]<=EP_SAMPLE_SLOT_COUNT):[];
      sampleTabs=normalized.length?normalized:DEFAULT_SAMPLE_TABS;
      activeTab=Math.min(activeTab,Math.max(0,sampleTabs.length-1));
      renderTabs();render();
    },
    setMetadata(nodeId,meta){applySampleMetadata(slots,nodeId,meta);render();},
    mergeMetadata(nodeId,meta){
      const slot=slots[Number(nodeId)-1];
      if(!slot)return;
      slot.meta={...(slot.meta||{}),...(meta||{})};
      render();
    },
    setSlot(entry){
      const nodeId=Number(entry?.nodeId);
      if(!Number.isInteger(nodeId)||nodeId<1||nodeId>EP_SAMPLE_SLOT_COUNT)return;
      const next=createSampleSlots([entry])[nodeId-1];
      if(!next?.file)return;
      const previous=slots[nodeId-1];
      if(previous?.meta)next.meta=previous.meta;
      slots[nodeId-1]=next;render();
    },
    setEntries(entries){
      let changed=false;
      for(const entry of entries||[]){
        const nodeId=Number(entry?.nodeId);
        if(!Number.isInteger(nodeId)||nodeId<1||nodeId>EP_SAMPLE_SLOT_COUNT)continue;
        const next=createSampleSlots([entry])[nodeId-1];
        if(!next?.file)continue;
        const previous=slots[nodeId-1];
        if(previous?.meta)next.meta=previous.meta;
        slots[nodeId-1]=next;changed=true;
      }
      if(changed)render();
    },
    clearSlot(id){clearSlotInternal(id);render();},
    countOccupied(){return slots.reduce((count,slot)=>count+(slot?.file?1:0),0);},
    findNextFree(start=1){return findNextFreeSampleSlot(slots,start);},
    setOperation(id,{status='pending',label='',progress=null}={}){
      const nodeId=Number(id);
      if(!Number.isInteger(nodeId)||nodeId<1||nodeId>EP_SAMPLE_SLOT_COUNT)return;
      const numericProgress=Number(progress);
      slotOperations.set(nodeId,{status:String(status),label:String(label||status).toUpperCase(),progress:Number.isFinite(numericProgress)?numericProgress:null});
      render();
    },
    clearOperation(id){slotOperations.delete(Number(id));render();},
    clearOperations(){slotOperations.clear();render();},
    setMutationsEnabled(enabled){mutationsEnabled=!!enabled;render();},
    setPreviewing(id){previewingId=Number(id)||null;render();},
    refresh(){render();},
    selectSlots(ids,{activeId=null,preview=false,navigate=true}={}){setSelection(ids,activeId??ids?.[0],{preview,navigate});},
    getSelected(){return selectedId?slots[selectedId-1]:null;},
    getSelectedSlots(){return[...selectedIds].sort((a,b)=>a-b).map(id=>slots[id-1]).filter(Boolean);},
    getSlot(id){return slots[Number(id)-1]||null;},
    getSlots(){return slots;},
    getActiveTab(){return activeTab;}
  };
}

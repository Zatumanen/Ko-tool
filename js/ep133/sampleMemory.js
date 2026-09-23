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
  const slots=Array.from({length:EP_SAMPLE_SLOT_COUNT},(_,i)=>({
    id:i+1,
    file:null,
    meta:null,
    node:null
  }));

  for(const entry of entries){
    if(!entry?.nodeId || entry.nodeId<1 || entry.nodeId>EP_SAMPLE_SLOT_COUNT)continue;
    if(!/^\/sounds\/[^/]+$/.test(entry.fileName||''))continue;
    const slot=slots[entry.nodeId-1];
    slot.file={
      name:(entry.fileName||'').split('/').pop(),
      path:entry.fileName,
      size:entry.fileSize||0
    };
    slot.node=entry;
    slot.nodeId=entry.nodeId;
  }
  return slots;
}

export function applySampleMetadata(slots,nodeId,meta){
  const slot=slots[nodeId-1];
  if(!slot)return;
  slot.meta=meta||null;
}

export function getSampleDisplayName(slot){return slot?.meta?.name||slot?.file?.name||'';}

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

export function createSampleMemory({
  listEl,
  tabsEl,
  searchEl,
  infoEl,
  onSelect,
  onPlay,
  onStop,
  onDrop,
  onMove,
  onDelete,
  onDownload,
  onDownloadMany,
  onRename
}){
  let slots=[];
  let sampleTabs=DEFAULT_SAMPLE_TABS;
  let activeTab=0;
  let selectedId=null;
  let selectionAnchor=null;
  let selectionCurrent=null;
  let editingId=null;
  let editingOriginalName='';
  let editingValue='';
  let renamePending=false;
  const slotOperations=new Map();

  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const formatSize=size=>{
    if(!size)return '—';
    if(size<1024)return size+' B';
    if(size<1024*1024)return (size/1024).toFixed(1)+' KB';
    return (size/1024/1024).toFixed(2)+' MB';
  };

  const slotName=getSampleDisplayName;

  const visible=()=>{
    const tab=sampleTabs[activeTab]||sampleTabs[0];
    const query=(searchEl?.value||'').trim().toLowerCase();
    return slots.slice(tab.range[0]-1,tab.range[1]).filter(slot=>{
      if(!query)return true;
      return String(slot.id).includes(query)||slotName(slot).toLowerCase().includes(query);
    });
  };

  const scrollSelectedIntoView=()=>{
    if(!selectedId||!listEl)return;
    const row=listEl.querySelector('[data-slot="'+selectedId+'"]');
    row?.scrollIntoView?.({block:'nearest'});
  };

  const selectedRange=()=>{
    if(!selectionAnchor||!selectionCurrent)return selectedId?[selectedId]:[];
    const start=Math.min(selectionAnchor,selectionCurrent);
    const end=Math.max(selectionAnchor,selectionCurrent);
    return Array.from({length:end-start+1},(_,i)=>start+i);
  };

  const selectSlotById=(id,{preview=false,extend=false}={})=>{
    const slot=slots[id-1];
    if(!slot)return;
    selectedId=slot.id;
    if(extend&&selectionAnchor){
      selectionCurrent=slot.id;
    }else{
      selectionAnchor=slot.id;
      selectionCurrent=slot.id;
    }
    render();
    renderInfo();
    scrollSelectedIntoView();
    onSelect?.(slot);
    if(preview&&slot.file)onPlay?.(slot);
  };

  const renderTabs=()=>{
    if(!tabsEl)return;
    tabsEl.innerHTML=sampleTabs.map((tab,index)=>{
      const active=index===activeTab?' selected':'';
      return '<button type="button" class="ep133-sample-tab'+active+'" data-tab="'+index+'">'+
        escapeHtml(tab.name)+'</button>';
    }).join('');
    tabsEl.querySelectorAll('[data-tab]').forEach(button=>{
      button.onclick=()=>{
        activeTab=Number(button.dataset.tab);
        renderTabs();
        const tab=sampleTabs[activeTab];
        if(tab)selectSlotById(tab.range[0]);
        else render();
      };
    });
  };

  const renderInfo=()=>{
    if(!infoEl)return;
    const slot=selectedId?slots[selectedId-1]:null;
    if(!slot){
      infoEl.innerHTML='<div class="ep133-info-empty">Select a sample slot.</div>';
      return;
    }
    const occupied=!!slot.file;
    const selectedFiles=selectedRange().map(id=>slots[id-1]).filter(item=>item?.file);
    const name=occupied?slotName(slot):'';
    const metadata=slot.meta||{};
    infoEl.innerHTML=
      '<div class="ep133-slot-info-head"><strong>SLOT '+String(slot.id).padStart(3,'0')+'</strong><span>'+escapeHtml(name)+'</span></div>'+
      '<div><b>STATUS</b> '+(occupied?'OCCUPIED':'EMPTY')+'</div>'+
      (occupied?'<div><b>FILE</b> '+escapeHtml(slot.file.name)+'</div>'+
        '<div><b>SIZE</b> '+formatSize(slot.file.size)+'</div>'+
        (metadata.samplerate?'<div><b>RATE</b> '+escapeHtml(metadata.samplerate)+' Hz</div>':'')+
        (metadata.channels?'<div><b>CHANNELS</b> '+escapeHtml(metadata.channels)+'</div>':'')+
        '<div class="ep133-slot-destination">Selected destination: #'+String(slot.id).padStart(3,'0')+'</div>'+
        '<div class="ep133-slot-actions">'+
        '<button type="button" class="ep133-download-sample" data-download-slot="'+slot.id+'">'+(selectedFiles.length>1?'DOWNLOAD '+selectedFiles.length+' SAMPLES':'DOWNLOAD SAMPLE')+'</button>'+
        '<button type="button" class="ep133-delete-sample" data-delete-slot="'+slot.id+'">DELETE SAMPLE</button>'+
        '</div>'
      :'<div class="ep133-slot-destination">Selected destination: #'+String(slot.id).padStart(3,'0')+'</div>');
  };

  let dragSourceId=0;
  let suppressClick=false;

  if(infoEl){
    infoEl.addEventListener('click',async event=>{
      const downloadButton=event.target.closest('[data-download-slot]');
      if(downloadButton){
        event.stopPropagation();
        const slot=slots[Number(downloadButton.dataset.downloadSlot)-1];
        if(!slot?.file)return;
        const selectedFiles=selectedRange().map(id=>slots[id-1]).filter(item=>item?.file);
        downloadButton.disabled=true;
        try{
          if(selectedFiles.length>1)await onDownloadMany?.(selectedFiles);
          else await onDownload?.(slot);
        }
        catch(error){throw error;}
        finally{downloadButton.disabled=false;}
        return;
      }
      const deleteButton=event.target.closest('[data-delete-slot]');
      if(deleteButton){
        event.stopPropagation();
        const slot=slots[Number(deleteButton.dataset.deleteSlot)-1];
        if(!slot?.file)return;
        const selectedFiles=selectedRange().map(id=>slots[id-1]).filter(item=>item?.file);
        const deleteTargets=selectedFiles.length>1?selectedFiles:[slot];
        if(deleteTargets.length>1&&!window.confirm('Delete '+deleteTargets.length+' selected samples?'))return;
        deleteButton.disabled=true;
        try{
          for(const selectedSlot of deleteTargets){
            await onDelete?.(selectedSlot);
            selectedSlot.file=null;
            selectedSlot.meta=null;
            selectedSlot.node=null;
            selectedSlot.nodeId=selectedSlot.id;
            render();
            renderInfo();
          }
          if(deleteTargets.length>1)selectSlotById(deleteTargets[deleteTargets.length-1].id);
        }catch(error){throw error;}
        finally{deleteButton.disabled=false;}
      }
    });
  }

  const finishRename=async(slot,{save=true}={})=>{
    if(editingId!==slot?.id||renamePending)return;
    const original=editingOriginalName;
    const value=editingValue;
    if(!save||!value.trim()||value===original){
      editingId=null;editingOriginalName='';editingValue='';
      render();renderInfo();
      return;
    }
    renamePending=true;
    try{
      const renamed=await onRename?.(slot,value);
      if(renamed)slot.meta={...(slot.meta||{}),name:renamed};
    }finally{
      renamePending=false;
      editingId=null;editingOriginalName='';editingValue='';
      render();renderInfo();
    }
  };

  const render=()=>{
    if(!listEl)return;
    const rows=visible();
    listEl.innerHTML=rows.map(slot=>{
      const selected=slot.id===selectedId?' selected':'';
      const multiSelected=selectedRange().includes(slot.id)&&slot.id!==selectedId?' multi-selected':'';
      const movable=canTransferMoveSample(slot);
      const draggable=movable?' draggable="true"':'';
      const occupied=!!slot.file;
      const operation=slotOperations.get(slot.id)||null;
      const operationClass=operation?.status?' operation-'+String(operation.status).toLowerCase().replace(/[^a-z0-9_-]/g,''):'';
      const operationText=operation?.label||'';
      const editing=editingId===slot.id;
      const nameControl=occupied
        ? '<input class="ep133-sample-name-input" data-name-input="'+slot.id+'" maxlength="16" value="'+escapeHtml(editing?editingValue:slotName(slot))+'" '+(editing?'':'readonly')+' aria-label="Sample name">'
        : '<span class="ep133-sample-name"></span>';
      return '<div class="ep133-sample-row'+selected+multiSelected+operationClass+'" data-slot="'+slot.id+'"'+draggable+'>'+
        '<span class="ep133-sample-number">'+String(slot.id).padStart(3,'0')+'</span>'+
        nameControl+
        '<span class="ep133-sample-size">'+escapeHtml(operationText||(occupied?formatSize(slot.file.size):'—'))+'</span>'+
        '</div>';
    }).join('');
    listEl.querySelectorAll('[data-slot]').forEach(row=>{
      const slot=slots[Number(row.dataset.slot)-1];
      const nameInput=row.querySelector('[data-name-input]');
      if(nameInput){
        nameInput.addEventListener('click',event=>{if(editingId===slot.id)event.stopPropagation();});
        nameInput.addEventListener('dblclick',event=>{
          if(!slot.file||slot.node?.isWritable!==true||selectedRange().length>1)return;
          event.preventDefault();event.stopPropagation();
          editingId=slot.id;
          editingOriginalName=slotName(slot);
          editingValue=editingOriginalName;
          render();
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
      row.addEventListener('dragstart',event=>{
        if(!canTransferMoveSample(slot)){event.preventDefault();return;}
        dragSourceId=slot.id;
        suppressClick=true;
        event.dataTransfer.effectAllowed='move';
        event.dataTransfer.setData('application/x-speeduppercut-slot',String(slot.id));
        event.dataTransfer.setData('text/plain',String(slot.id));
        row.classList.add('dragging');
      });
      row.addEventListener('dragend',()=>{
        row.classList.remove('dragging');
        setTimeout(()=>{suppressClick=false;dragSourceId=0;},0);
      });
      row.onclick=event=>{
        if(suppressClick)return;
        selectSlotById(slot.id,{preview:!!slot.file&&!event.shiftKey,extend:!!event.shiftKey});
      };
      row.addEventListener('dragover',event=>{
        event.preventDefault();
        const sourceId=dragSourceId||Number(event.dataTransfer?.getData('application/x-speeduppercut-slot')||event.dataTransfer?.getData('text/plain')||0);
        const movingSlot=sourceId?slots[sourceId-1]:null;
        event.dataTransfer.dropEffect=movingSlot?'move':'copy';
        row.classList.add('dragover');
      });
      row.addEventListener('dragleave',event=>{
        if(event.relatedTarget&&row.contains(event.relatedTarget))return;
        row.classList.remove('dragover');
      });
      row.addEventListener('drop',async event=>{
        event.preventDefault();
        row.classList.remove('dragover');
        const sourceId=dragSourceId||Number(event.dataTransfer?.getData('application/x-speeduppercut-slot')||event.dataTransfer?.getData('text/plain')||0);
        const source=sourceId?slots[sourceId-1]:null;
        if(source?.file){
          if(source.id===slot.id)return;
          if(slot.file){
            selectSlotById(slot.id);
            return;
          }
          selectSlotById(slot.id);
          try{await onMove?.(source,slot);}catch(error){onSelect?.(source);throw error;}
          return;
        }
        await onDrop?.(slot,event);
      });
    });
    renderInfo();
  };

  const keyboardActive=()=>{
    if(!listEl||listEl.offsetParent===null)return false;
    const active=document.activeElement;
    if(active?.tagName==='TEXTAREA'||active?.tagName==='SELECT')return false;
    if(active?.tagName==='INPUT'){
      const readonlySampleName=active.matches?.('.ep133-sample-name-input[readonly]')===true;
      if(!readonlySampleName)return false;
    }
    return true;
  };
  const moveSelection=(direction,{extend=false}={})=>{
    const tab=sampleTabs[activeTab]||sampleTabs[0];
    if(!tab)return;
    const first=tab.range[0],last=tab.range[1];
    const current=selectedId>=first&&selectedId<=last?selectedId:first;
    selectSlotById(Math.max(first,Math.min(last,current+direction)),{extend});
  };
  const selectTabEdge=(edge,{extend=false}={})=>{
    const tab=sampleTabs[activeTab]||sampleTabs[0];
    if(tab)selectSlotById(edge==='start'?tab.range[0]:tab.range[1],{extend});
  };
  const getTopVisibleSlotId=()=>{
    if(!listEl)return selectedId;
    const bounds=listEl.getBoundingClientRect?.();
    const rows=Array.from(listEl.querySelectorAll?.('[data-slot]')||[]);
    if(!bounds||!rows.length)return selectedId;
    const row=rows.find(item=>item.getBoundingClientRect?.().bottom>bounds.top);
    return Number(row?.dataset?.slot)||selectedId;
  };
  const movePage=(direction,{extend=false}={})=>{
    const tab=sampleTabs[activeTab]||sampleTabs[0];
    if(!tab)return;
    const first=tab.range[0],last=tab.range[1];
    const top=Math.max(first,Math.min(last,getTopVisibleSlotId()||selectedId||first));
    const target=direction<0?Math.max(first,top-1):Math.min(last,top+EP_SAMPLE_PAGE_SIZE);
    if(target!==selectedId)selectSlotById(target,{extend});
  };
  const changeTab=direction=>{
    const next=Math.max(0,Math.min(sampleTabs.length-1,activeTab+direction));
    if(next===activeTab)return;
    activeTab=next;
    renderTabs();
    const tab=sampleTabs[activeTab];
    selectSlotById(tab.range[0]);
  };
  const keyDown=event=>{
    if(!keyboardActive())return;
    if((event.key==='ArrowUp'||event.key==='ArrowDown')&&event.altKey){
      event.preventDefault();
      movePage(event.key==='ArrowUp'?-1:1,{extend:!!event.shiftKey});
      return;
    }
    if((event.key==='ArrowUp'||event.key==='ArrowDown')&&event.metaKey){
      event.preventDefault();
      selectTabEdge(event.key==='ArrowUp'?'start':'end',{extend:!!event.shiftKey});
      return;
    }
    if(event.key==='ArrowUp'||event.key==='ArrowDown'){
      event.preventDefault();
      moveSelection(event.key==='ArrowUp'?-1:1,{extend:!!event.shiftKey});
      return;
    }
    if(event.key==='PageUp'||event.key==='PageDown'){
      event.preventDefault();
      changeTab(event.key==='PageUp'?-1:1);
      return;
    }
    if(event.key===' '&&!event.repeat){
      const slot=selectedId?slots[selectedId-1]:null;
      if(slot?.file){event.preventDefault();onPlay?.(slot);}
    }
  };
  const keyUp=event=>{
    if(!keyboardActive())return;
    const slot=selectedId?slots[selectedId-1]:null;
    if((event.key==='ArrowUp'||event.key==='ArrowDown')&&slot?.file)onPlay?.(slot);
    if(event.key===' '&&slot?.file){
      const duration=calculateSampleDuration(slot);
      if(duration&&duration<1)return;
      event.preventDefault();onStop?.(slot);
    }
  };
  document.addEventListener('keydown',keyDown);
  document.addEventListener('keyup',keyUp);

  return {
    setSlots(next){
      slots=next||[];
      selectedId=null;
      selectionAnchor=null;
      selectionCurrent=null;
      activeTab=Math.min(activeTab,Math.max(0,sampleTabs.length-1));
      renderTabs();
      render();
    },
    setTabs(nextTabs){
      const normalized=Array.isArray(nextTabs)?nextTabs.map(tab=>({name:String(tab?.name??''),range:[Number(tab?.range?.[0]),Number(tab?.range?.[1])],color:tab?.color})).filter(tab=>tab.name&&Number.isInteger(tab.range[0])&&Number.isInteger(tab.range[1])&&tab.range[0]>=1&&tab.range[1]>=tab.range[0]&&tab.range[1]<=EP_SAMPLE_SLOT_COUNT):[];
      sampleTabs=normalized.length?normalized:DEFAULT_SAMPLE_TABS;
      activeTab=Math.min(activeTab,Math.max(0,sampleTabs.length-1));
      renderTabs();
      render();
    },
    setMetadata(nodeId,meta){
      applySampleMetadata(slots,nodeId,meta);
      render();
    },
    mergeMetadata(nodeId,meta){
      const slot=slots[nodeId-1];
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
      slots[nodeId-1]=next;
      render();
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
        slots[nodeId-1]=next;
        changed=true;
      }
      if(changed)render();
    },
    clearSlot(id){
      const nodeId=Number(id);
      if(!Number.isInteger(nodeId)||nodeId<1||nodeId>EP_SAMPLE_SLOT_COUNT)return;
      slots[nodeId-1]={id:nodeId,file:null,meta:null,node:null};
      render();
    },
    countOccupied(){return slots.reduce((count,slot)=>count+(slot?.file?1:0),0);},
    findNextFree(start=1){return findNextFreeSampleSlot(slots,start);},
    setOperation(id,{status='pending',label='',progress=null}={}){
      const nodeId=Number(id);
      if(!Number.isInteger(nodeId)||nodeId<1||nodeId>EP_SAMPLE_SLOT_COUNT)return;
      const numericProgress=Number(progress);
      const suffix=Number.isFinite(numericProgress)?' '+Math.max(0,Math.min(100,Math.round(numericProgress)))+'%':'';
      slotOperations.set(nodeId,{status,label:String(label||status).toUpperCase()+suffix,progress:Number.isFinite(numericProgress)?numericProgress:null});
      render();
    },
    clearOperation(id){
      slotOperations.delete(Number(id));
      render();
    },
    refresh(){render();renderInfo();},
    getSelected(){return selectedId?slots[selectedId-1]:null;},
    getSelectedSlots(){return selectedRange().map(id=>slots[id-1]).filter(Boolean);},
    getSlot(id){return slots[id-1]||null;}
  };
}

export const EP_SAMPLE_SLOT_COUNT=999;

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
  onDownload
}){
  let slots=[];
  let sampleTabs=DEFAULT_SAMPLE_TABS;
  let activeTab=0;
  let selectedId=null;

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

  const selectSlotById=(id,{preview=false}={})=>{
    const slot=slots[id-1];
    if(!slot)return;
    selectedId=slot.id;
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
        render();
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
        '<button type="button" class="ep133-download-sample" data-download-slot="'+slot.id+'">DOWNLOAD SAMPLE</button>'+
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
        downloadButton.disabled=true;
        try{await onDownload?.(slot);}
        catch(error){throw error;}
        finally{downloadButton.disabled=false;}
        return;
      }
      const deleteButton=event.target.closest('[data-delete-slot]');
      if(deleteButton){
        event.stopPropagation();
        const slot=slots[Number(deleteButton.dataset.deleteSlot)-1];
        if(!slot?.file)return;
        deleteButton.disabled=true;
        try{
          await onDelete?.(slot);
          slot.file=null;
          slot.meta=null;
          slot.node=null;
          slot.nodeId=slot.id;
          render();
          renderInfo();
        }catch(error){throw error;}
        finally{deleteButton.disabled=false;}
      }
    });
  }

  const render=()=>{
    if(!listEl)return;
    const rows=visible();
    listEl.innerHTML=rows.map(slot=>{
      const selected=slot.id===selectedId?' selected':'';
      const movable=!!slot.file&&slot.node?.isMovable===true;
      const draggable=movable?' draggable="true"':'';
      const occupied=!!slot.file;
      return '<div class="ep133-sample-row'+selected+'" data-slot="'+slot.id+'"'+draggable+'>'+
        '<span class="ep133-sample-number">'+String(slot.id).padStart(3,'0')+'</span>'+
        '<span class="ep133-sample-name">'+escapeHtml(occupied?slotName(slot):'')+'</span>'+
        '<span class="ep133-sample-size">'+(occupied?formatSize(slot.file.size):'—')+'</span>'+
        '</div>';
    }).join('');
    listEl.querySelectorAll('[data-slot]').forEach(row=>{
      const slot=slots[Number(row.dataset.slot)-1];
      row.addEventListener('dragstart',event=>{
        if(!slot.file||slot.node?.isMovable!==true){event.preventDefault();return;}
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
      row.onclick=()=>{
        if(suppressClick)return;
        selectSlotById(slot.id,{preview:!!slot.file});
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
            onSelect?.(slot);
            selectedId=slot.id;
            render();
            renderInfo();
            return;
          }
          selectedId=slot.id;
          render();
          renderInfo();
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
    if(active&&['INPUT','TEXTAREA','SELECT'].includes(active.tagName))return false;
    return true;
  };
  const moveSelection=direction=>{
    const tab=sampleTabs[activeTab]||sampleTabs[0];
    if(!tab)return;
    const first=tab.range[0],last=tab.range[1];
    const current=selectedId>=first&&selectedId<=last?selectedId:first;
    selectSlotById(Math.max(first,Math.min(last,current+direction)));
  };
  const selectTabEdge=edge=>{
    const tab=sampleTabs[activeTab]||sampleTabs[0];
    if(tab)selectSlotById(edge==='start'?tab.range[0]:tab.range[1]);
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
    if((event.key==='ArrowUp'||event.key==='ArrowDown')&&event.metaKey){
      event.preventDefault();
      selectTabEdge(event.key==='ArrowUp'?'start':'end');
      return;
    }
    if(event.key==='ArrowUp'||event.key==='ArrowDown'){
      event.preventDefault();
      if(!event.repeat)moveSelection(event.key==='ArrowUp'?-1:1);
      else moveSelection(event.key==='ArrowUp'?-1:1);
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
    if(event.key===' '&&slot?.file){event.preventDefault();onStop?.(slot);}
  };
  document.addEventListener('keydown',keyDown);
  document.addEventListener('keyup',keyUp);

  return {
    setSlots(next){
      slots=next||[];
      selectedId=null;
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
    refresh(){render();renderInfo();},
    getSelected(){return selectedId?slots[selectedId-1]:null;},
    getSlot(id){return slots[id-1]||null;}
  };
}

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
  onDrop,
  onDelete
}){
  let slots=[];
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
    const tab=DEFAULT_SAMPLE_TABS[activeTab];
    const query=(searchEl?.value||'').trim().toLowerCase();
    return slots.slice(tab.range[0]-1,tab.range[1]).filter(slot=>{
      if(!query)return true;
      return String(slot.id).includes(query)||slotName(slot).toLowerCase().includes(query);
    });
  };

  const renderTabs=()=>{
    if(!tabsEl)return;
    tabsEl.innerHTML=DEFAULT_SAMPLE_TABS.map((tab,index)=>{
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
        '<button type="button" class="ep133-delete-sample" data-delete-slot="'+slot.id+'">DELETE SAMPLE</button>'
      :'<div class="ep133-slot-destination">Selected destination: #'+String(slot.id).padStart(3,'0')+'</div>');
  };

  const render=()=>{
    if(!listEl)return;
    const rows=visible();
    listEl.innerHTML=rows.map(slot=>{
      const selected=slot.id===selectedId?' selected':'';
      const occupied=!!slot.file;
      return '<button type="button" class="ep133-sample-row'+selected+'" data-slot="'+slot.id+'">'+
        '<span class="ep133-sample-number">'+String(slot.id).padStart(3,'0')+'</span>'+
        '<span class="ep133-sample-name">'+escapeHtml(occupied?slotName(slot):'')+'</span>'+
        '<span class="ep133-sample-size">'+(occupied?formatSize(slot.file.size):'—')+'</span>'+
        '</button>';
    }).join('');
    infoEl?.querySelectorAll('[data-delete-slot]').forEach(button=>{button.onclick=async event=>{event.stopPropagation();const slot=slots[Number(button.dataset.deleteSlot)-1];if(!slot?.file)return;button.disabled=true;try{await onDelete?.(slot);slot.file=null;slot.meta=null;slot.node=null;slot.nodeId=slot.id;render();renderInfo();}catch(error){throw error;}finally{button.disabled=false;}};});
    listEl.querySelectorAll('[data-slot]').forEach(row=>{
      const slot=slots[Number(row.dataset.slot)-1];
      row.onclick=()=>{
        selectedId=slot.id;
        render();
        renderInfo();
        onSelect?.(slot);
        if(slot.file)onPlay?.(slot);
      };
      row.addEventListener('dragover',event=>{
        event.preventDefault();
        event.dataTransfer.dropEffect='copy';
        row.classList.add('dragover');
      });
      row.addEventListener('dragleave',event=>{
        if(event.relatedTarget&&row.contains(event.relatedTarget))return;
        row.classList.remove('dragover');
      });
      row.addEventListener('drop',async event=>{
        event.preventDefault();
        row.classList.remove('dragover');
        await onDrop?.(slot,event);
      });
    });
    renderInfo();
  };

  return {
    setSlots(next){
      slots=next||[];
      selectedId=null;
      renderTabs();
      render();
    },
    setMetadata(nodeId,meta){
      applySampleMetadata(slots,nodeId,meta);
      render();
    },
    refresh(){render();renderInfo();},
    getSelected(){return selectedId?slots[selectedId-1]:null;},
    getSlot(id){return slots[id-1]||null;}
  };
}

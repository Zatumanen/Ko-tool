const slotId=value=>{
  const number=Number(value);
  return Number.isInteger(number)&&number>=1&&number<=999?number:null;
};
const clone=value=>value&&typeof value==='object'?{...value}:null;
const GROUPS=['a','b','c','d'];
const projectId=value=>{
  const text=String(value??'').trim();
  return /^\d{1,2}$/.test(text)?text.padStart(2,'0'):text;
};
const freezeReference=reference=>Object.freeze({...reference});

export function buildProjectDependencyReport(preflight,{getSampleSlot}={}){
  const referenced=[...new Set(
    Array.from(preflight?.referencedSampleSlots||[],slotId).filter(Boolean)
  )].sort((a,b)=>a-b);
  const missingSet=new Set(
    Array.from(preflight?.missingSampleSlots||[],slotId).filter(Boolean)
  );
  const entries=referenced.map(slot=>{
    const local=typeof getSampleSlot==='function'?getSampleSlot(slot):null;
    const file=clone(local?.file);
    const meta=clone(local?.meta);
    const missing=missingSet.has(slot);
    return Object.freeze({
      slot,
      status:missing?'missing':'available',
      available:!missing,
      name:missing?'':String(meta?.name||file?.name||file?.fileName||''),
      size:missing?0:(Number(file?.size??file?.fileSize)||0),
      channels:missing?null:(Number(meta?.channels)||null),
      sampleRate:missing?null:(Number(meta?.samplerate)||null),
      verification:{
        file:String(local?.verification?.file||'unknown'),
        metadata:String(local?.verification?.metadata||'unknown')
      }
    });
  });
  const missing=entries.filter(entry=>!entry.available);
  const available=entries.filter(entry=>entry.available);
  return Object.freeze({
    referenced:entries.length,
    available:available.length,
    missing:missing.length,
    allAvailable:missing.length===0,
    referencedSlots:Object.freeze(entries.map(entry=>entry.slot)),
    missingSlots:Object.freeze(missing.map(entry=>entry.slot)),
    entries:Object.freeze(entries)
  });
}

export function assertProjectDependenciesAvailable(report){
  if(!report||typeof report!=='object')throw new TypeError('Project dependency report is required.');
  if(Number(report.missing)>0){
    const slots=Array.from(report.missingSlots||[],slot=>String(slot).padStart(3,'0'));
    throw new Error('Project references missing sample slots: '+slots.join(', ')+'.');
  }
  return report;
}

export function buildSampleDependencyIndex(projectResults=[]){
  const references=[];
  const scannedProjects=[];
  for(const result of Array.from(projectResults||[])){
    if(!result||typeof result!=='object')continue;
    const project=projectId(result.project);
    if(project&&!scannedProjects.includes(project))scannedProjects.push(project);
    const pads=result.model?.pads||{};
    for(const group of GROUPS){
      for(const pad of Array.from(pads[group]||[])){
        const slot=slotId(pad?.sampleSlot);
        if(!slot)continue;
        references.push(freezeReference({
          slot,
          project,
          nodeId:Number(result.nodeId)||null,
          active:!!result.active,
          group,
          pad:Number(pad?.pad)||null,
          path:String(pad?.path||`pads/${group}/p${String(Number(pad?.pad)||0).padStart(2,'0')}`)
        }));
      }
    }
  }
  references.sort((a,b)=>
    a.slot-b.slot||
    a.project.localeCompare(b.project)||
    GROUPS.indexOf(a.group)-GROUPS.indexOf(b.group)||
    (a.pad||0)-(b.pad||0)
  );
  const entries=[];
  for(const reference of references){
    let entry=entries.at(-1);
    if(!entry||entry.slot!==reference.slot){
      entry={slot:reference.slot,references:[],projects:[]};
      entries.push(entry);
    }
    entry.references.push(reference);
    if(reference.project&&!entry.projects.includes(reference.project))entry.projects.push(reference.project);
  }
  const frozenEntries=entries.map(entry=>Object.freeze({
    slot:entry.slot,
    referenceCount:entry.references.length,
    projectCount:entry.projects.length,
    projects:Object.freeze([...entry.projects]),
    references:Object.freeze([...entry.references])
  }));
  return Object.freeze({
    projectsScanned:scannedProjects.length,
    scannedProjects:Object.freeze([...scannedProjects].sort()),
    sampleCount:frozenEntries.length,
    referenceCount:references.length,
    slots:Object.freeze(frozenEntries.map(entry=>entry.slot)),
    entries:Object.freeze(frozenEntries),
    references:Object.freeze([...references])
  });
}

export function getSampleDependencyBlockers(index,slots=[]){
  const wanted=new Set(Array.from(slots||[],slotId).filter(Boolean));
  if(!wanted.size)return Object.freeze([]);
  return Object.freeze(Array.from(index?.entries||[]).filter(entry=>wanted.has(slotId(entry?.slot))));
}

const dependencyLocation=reference=>{
  const project='P'+projectId(reference?.project||'??');
  const group=String(reference?.group||'?').toUpperCase();
  const pad=Number.isInteger(Number(reference?.pad))?String(Number(reference.pad)).padStart(2,'0'):'??';
  return project+' '+group+pad;
};

export function assertSampleSlotsUnreferenced(index,slots=[],{operation='modify'}={}){
  const blockers=getSampleDependencyBlockers(index,slots);
  if(!blockers.length)return index;
  const detail=blockers.map(entry=>
    'slot '+String(entry.slot).padStart(3,'0')+' is used by '+entry.references.map(dependencyLocation).join(', ')
  ).join('; ');
  throw new Error(
    'Sample dependency safety lock: '+detail+'. '+String(operation||'modify').toUpperCase()+' would break project pad references.'
  );
}

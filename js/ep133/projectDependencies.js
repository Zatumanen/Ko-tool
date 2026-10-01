const slotId=value=>{
  const number=Number(value);
  return Number.isInteger(number)&&number>=1&&number<=999?number:null;
};
const clone=value=>value&&typeof value==='object'?{...value}:null;

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
      name:String(meta?.name||file?.name||file?.fileName||''),
      size:Number(file?.size??file?.fileSize)||0,
      channels:Number(meta?.channels)||null,
      sampleRate:Number(meta?.samplerate)||null,
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

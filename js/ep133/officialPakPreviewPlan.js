/**
 * Read-only assessment of an already validated official .pak/.ppak archive.
 *
 * A UI inventory is never authoritative FILE readback. This module intentionally
 * returns NO bytes, mutation instructions, restore plan, or write authorization.
 */
const upper=value=>String(value??'').trim().toUpperCase();
const version=value=>String(value??'').trim();
const pad=value=>String(value).padStart(3,'0');
const freezeRows=rows=>Object.freeze(rows.map(row=>Object.freeze(row)));

export function buildOfficialPakPreviewPlan(archive,{device=null,getSlot=()=>null}={}){
  if(!archive||!Array.isArray(archive.projects)||!Array.isArray(archive.sounds))
    throw new TypeError('Official PAK preview requires a validated archive inventory.');

  const meta=archive.metadata||{};
  const source={
    sku:upper(meta.device_sku),
    baseSku:upper(meta.base_sku),
    firmware:version(meta.device_version)
  };
  const target={
    sku:upper(device?.identitySku),
    baseSku:upper(device?.baseSku||device?.metadata?.base_sku),
    firmware:version(device?.metadata?.os_version||device?.metadata?.sw_version)
  };
  const complete=[...Object.values(source),...Object.values(target)].every(Boolean);
  const identity=complete
    ?(source.sku===target.sku&&source.baseSku===target.baseSku&&
      source.firmware===target.firmware?'match':'mismatch')
    :'unverified';

  const slots=freezeRows(archive.sounds.map(sound=>{
    const node=typeof getSlot==='function'?getSlot(sound.slot):null;
    const state=node?.file?'occupied-unverified':
      node?.state==='empty'?'ui-empty-unverified':'unknown';
    return{
      slot:Number(sound.slot),name:String(sound.name||''),
      pcmBytes:Number(sound.pcmBytes)||0,
      sampleFrames:Number(sound.sampleFrames)||0,
      state,
      reason:state==='occupied-unverified'
        ?'Occupied in UI; PCM equality, protected status and write rights are unverified.'
        :state==='ui-empty-unverified'
          ?'Empty in UI only; FILE occupancy, protected status and write rights are unknown.'
          :'No synchronized slot state; FILE occupancy, protected status and write rights are unknown.'
    };
  }));

  const archivedSlots=new Set(slots.map(row=>row.slot));
  const projects=freezeRows(archive.projects.map(project=>{
    const references=[...new Set((project.padReferences||[]).map(row=>Number(row.slot)))].sort((a,b)=>a-b);
    const missing=Object.freeze(references.filter(slot=>!archivedSlots.has(slot)));
    return{
      number:String(project.number),size:Number(project.size)||0,
      padAssignments:(project.padReferences||[]).length,
      references:Object.freeze(references),
      missingInArchive:missing,
      state:'target-unverified',
      reason:'Project existence, active status, write rights and preserved fields are unverified.'
    };
  }));

  const occupied=slots.filter(x=>x.state==='occupied-unverified').length;
  const candidateEmpty=slots.filter(x=>x.state==='ui-empty-unverified').length;
  const unknown=slots.length-occupied-candidateEmpty;
  const missingReferences=projects.reduce((sum,p)=>sum+p.missingInArchive.length,0);
  const requiredPcmBytes=slots.reduce((sum,s)=>sum+s.pcmBytes,0);
  const warnings=[...(archive.warnings||[])];
  if(identity==='mismatch')warnings.push('ARCHIVE SKU / BASE SKU / FIRMWARE DOES NOT MATCH CONNECTED EP.');
  else if(identity==='unverified')warnings.push('ARCHIVE / DEVICE IDENTITY IS INCOMPLETE OR UNKNOWN.');
  if(missingReferences)warnings.push('PROJECT PAD REFERENCES NOT INCLUDED IN ARCHIVE: '+missingReferences+'.');
  warnings.push('SLOT STATUS COMES FROM UI, NOT AUTHORITATIVE FILE READBACK.');
  warnings.push('FREE SPACE, PROTECTED SLOTS AND FILE WRITE RIGHTS ARE UNVERIFIED.');
  warnings.push('PROJECT TARGET / ACTIVE STATUS IS UNVERIFIED.');

  return Object.freeze({
    kind:'official-pak-read-only-preview',
    restoreAllowed:false,
    identity,
    source:Object.freeze(source),target:Object.freeze(target),
    slots,projects,
    summary:Object.freeze({occupied,candidateEmpty,unknown,missingReferences,requiredPcmBytes}),
    warnings:Object.freeze(warnings)
  });
}

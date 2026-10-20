import{parseProjectArchive,validateProjectArchive,patchProjectArchiveMembers}from './projectArchive.js?v=20261001-1';

/**
 * Prepare an exact native project-TAR remap for a sound-slot MOVE.
 * This is pure and OFFLINE: no device/file writes or firmware behavior claims.
 * Use only with a backed-up, journaled and hardware-verified MOVE+project-write
 * workflow. Native FILE_MOVE itself may already update project references.
 */
export function planProjectSampleSlotRemap(input,moves,{profile}={}){
  if(!profile||!['ep133','ep40'].includes(profile.id)||profile.projectAuthoring!==true)
    throw new Error('Project slot remap requires a verified EP-133/EP-40 project authoring profile.');
  if(!Array.isArray(moves)||moves.length===0)
    throw new Error('Project slot remap requires a nonempty MOVE plan.');
  const mappings=new Map(),destinations=new Set();
  for(const move of moves){
    const from=Number(move?.sourceId),to=Number(move?.targetId);
    if(!Number.isInteger(from)||!Number.isInteger(to)||from<1||from>999||to<1||to>999||from===to||
      mappings.has(from)||destinations.has(to))
      throw new Error('Project slot remap requires unique distinct source/destination slots in 1..999.');
    mappings.set(from,to);destinations.add(to);
  }
  for(const target of destinations)
    if(mappings.has(target))
      throw new Error('Project slot remap cannot overwrite a source slot; use an empty target.');

  const original=input instanceof Uint8Array?input.slice():new Uint8Array(input||[]);
  // Only native writer-approved pads. 27-byte EP-133 Sample Tool pad records
  // must remain read-only; no hidden conversion or normalization to 26 bytes.
  validateProjectArchive(original,{profile});
  const members=parseProjectArchive(original);
  const replacements=new Map(),expected=original.slice(),pads=[];
  let offset=0;
  for(const member of members){
    if(member.type!=='5'&&/^pads\/[abcd]\/p(?:0[1-9]|1[0-2])$/.test(member.path)){
      const from=member.data[1]|member.data[2]<<8;
      const to=mappings.get(from);
      if(to!=null){
        const copy=member.data.slice();
        copy[1]=to&255;copy[2]=to>>>8;
        replacements.set(member.path,copy);
        expected[offset+512+1]=copy[1];expected[offset+512+2]=copy[2];
        pads.push(Object.freeze({path:member.path,from,to}));
      }
    }
    offset+=512+Math.ceil(member.size/512)*512;
  }
  if(!pads.length)return Object.freeze({
    changed:false,pads:Object.freeze([]),original,candidate:original.slice()
  });
  const candidate=patchProjectArchiveMembers(original,replacements,{profile,allowAdditions:false});
  // Crucial: the same sample moved to another slot keeps every pad setting,
  // including trim, pitch, envelope, live/unknown members, and TAR envelope.
  if(candidate.length!==expected.length||candidate.some((byte,index)=>byte!==expected[index]))
    throw new Error('Project slot remap changed data outside exact pad slot bytes; refusing candidate.');
  return Object.freeze({changed:true,pads:Object.freeze(pads),original,candidate});
}

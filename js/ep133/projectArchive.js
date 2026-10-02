import * as core from './projectArchiveCore.js?v=20261001-1';
export * from './projectArchiveCore.js?v=20261001-1';

const TAR_BLOCK_SIZE=512;
const TAR_END_BYTES=TAR_BLOCK_SIZE*2;
const asBytes=input=>input instanceof Uint8Array?input:new Uint8Array(input||[]);

const memberSpans=(input,members)=>{
  const bytes=asBytes(input);
  const spans=new Map();
  let offset=0;
  for(const member of members){
    const start=offset;
    const dataStart=start+TAR_BLOCK_SIZE;
    const paddedLength=Math.ceil(Number(member.size||0)/TAR_BLOCK_SIZE)*TAR_BLOCK_SIZE;
    const dataEnd=dataStart+Number(member.size||0);
    const next=dataStart+paddedLength;
    if(next>bytes.length)throw new Error('Project TAR span exceeds archive size for '+member.path+'.');
    spans.set(member.path,{start,dataStart,dataEnd,next,member});
    offset=next;
  }
  return{bytes,spans,bodyEnd:offset};
};

export function restoreProjectTarEnvelope(baseInput,candidateInput){
  const baseMembers=core.parseProjectArchive(baseInput);
  const candidateMembers=core.parseProjectArchive(candidateInput);
  const base=memberSpans(baseInput,baseMembers);
  const candidate=memberSpans(candidateInput,candidateMembers);
  let output=asBytes(candidateInput).slice();

  for(const member of candidateMembers){
    const original=base.spans.get(member.path);
    const current=candidate.spans.get(member.path);
    if(!original||!current)continue;
    if(original.member.type!==member.type||Number(original.member.size)!==Number(member.size))continue;

    output.set(base.bytes.slice(original.start,original.dataStart),current.start);
    const sourcePadding=base.bytes.slice(original.dataEnd,original.next);
    const targetPaddingLength=current.next-current.dataEnd;
    if(sourcePadding.length===targetPaddingLength&&targetPaddingLength>0)
      output.set(sourcePadding,current.dataEnd);
  }

  if(base.bodyEnd===candidate.bodyEnd&&base.bytes.length!==output.length&&base.bytes.length>=base.bodyEnd+TAR_END_BYTES){
    const resized=new Uint8Array(base.bytes.length);
    resized.set(output.slice(0,candidate.bodyEnd),0);
    resized.set(base.bytes.slice(base.bodyEnd),base.bodyEnd);
    output=resized;
  }

  core.parseProjectArchive(output);
  return output;
}

export function patchProjectArchiveMembers(baseInput,replacements,options={}){
  return restoreProjectTarEnvelope(
    baseInput,
    core.patchProjectArchiveMembers(baseInput,replacements,options)
  );
}

export function patchProjectPad(baseInput,spec,options={}){
  return restoreProjectTarEnvelope(
    baseInput,
    core.patchProjectPad(baseInput,spec,options)
  );
}

export function buildProjectFromNative(baseInput,doc={},options={}){
  return restoreProjectTarEnvelope(
    baseInput,
    core.buildProjectFromNative(baseInput,doc,options)
  );
}

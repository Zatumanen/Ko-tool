import{parseProjectArchive}from './projectArchive.js?v=20261001-1';

const toBytes=input=>input instanceof Uint8Array?input:new Uint8Array(input||[]);
const bytesEqual=(a,b)=>{
  if(a.length!==b.length)return false;
  for(let index=0;index<a.length;index++)if(a[index]!==b[index])return false;
  return true;
};
const byteDiff=(beforeInput,afterInput)=>{
  const before=toBytes(beforeInput),after=toBytes(afterInput);
  const limit=Math.max(before.length,after.length);
  let changedBytes=0,firstChangedByte=-1;
  for(let index=0;index<limit;index++){
    if(index>=before.length||index>=after.length||before[index]!==after[index]){
      changedBytes+=1;
      if(firstChangedByte<0)firstChangedByte=index;
    }
  }
  return Object.freeze({changedBytes,firstChangedByte});
};

export function getProjectMemberKind(path,type='0'){
  const normalized=String(path||'');
  if(type==='5')return'directory';
  if(/^pads\/[abcd]\/p(?:0[1-9]|1[0-2])$/.test(normalized))return'pad';
  if(/^patterns\/[abcd](?:0[1-9]|[1-9][0-9])$/.test(normalized))return'pattern';
  if(normalized==='scenes')return'scenes';
  if(normalized==='settings')return'settings';
  if(normalized==='fx_settings')return'fx';
  if(normalized==='live')return'live';
  return'unknown';
}

const freezeEntry=entry=>Object.freeze(entry);

export function buildProjectWriteDiff(originalInput,candidateInput){
  const originalBytes=toBytes(originalInput),candidateBytes=toBytes(candidateInput);
  const original=parseProjectArchive(originalBytes);
  const candidate=parseProjectArchive(candidateBytes);
  const originalByPath=new Map(original.map(member=>[member.path,member]));
  const candidateByPath=new Map(candidate.map(member=>[member.path,member]));
  const orderedPaths=[
    ...original.map(member=>member.path),
    ...candidate.map(member=>member.path).filter(path=>!originalByPath.has(path))
  ];
  const entries=[];
  for(const path of orderedPaths){
    const before=originalByPath.get(path)||null;
    const after=candidateByPath.get(path)||null;
    const kind=getProjectMemberKind(path,after?.type||before?.type||'0');
    if(!before){
      entries.push(freezeEntry({
        path,kind,status:'added',beforeSize:0,afterSize:after.size,
        byteChanges:after.size,firstChangedByte:after.size?0:-1
      }));
      continue;
    }
    if(!after){
      entries.push(freezeEntry({
        path,kind,status:'removed',beforeSize:before.size,afterSize:0,
        byteChanges:before.size,firstChangedByte:before.size?0:-1
      }));
      continue;
    }
    if(before.type===after.type&&bytesEqual(before.data,after.data)){
      entries.push(freezeEntry({
        path,kind,status:'unchanged',beforeSize:before.size,afterSize:after.size,
        byteChanges:0,firstChangedByte:-1
      }));
      continue;
    }
    const stats=byteDiff(before.data,after.data);
    entries.push(freezeEntry({
      path,kind,status:'modified',beforeSize:before.size,afterSize:after.size,
      byteChanges:stats.changedBytes,firstChangedByte:stats.firstChangedByte,
      typeChanged:before.type!==after.type
    }));
  }

  const changedMembers=entries.filter(entry=>entry.status!=='unchanged');
  const added=changedMembers.filter(entry=>entry.status==='added').length;
  const removed=changedMembers.filter(entry=>entry.status==='removed').length;
  const modified=changedMembers.filter(entry=>entry.status==='modified').length;
  const originalUnknown=original.filter(member=>member.type!=='5'&&getProjectMemberKind(member.path,member.type)==='unknown');
  const candidateUnknown=candidate.filter(member=>member.type!=='5'&&getProjectMemberKind(member.path,member.type)==='unknown');
  let preservedUnknown=0;
  for(const member of originalUnknown){
    const next=candidateByPath.get(member.path);
    if(next&&next.type===member.type&&bytesEqual(member.data,next.data))preservedUnknown+=1;
  }
  const touchedUnknown=changedMembers.filter(entry=>entry.kind==='unknown');
  const archiveStats=byteDiff(originalBytes,candidateBytes);

  return Object.freeze({
    changed:changedMembers.length>0||archiveStats.changedBytes>0,
    archive:Object.freeze({
      beforeBytes:originalBytes.byteLength,
      afterBytes:candidateBytes.byteLength,
      changedBytes:archiveStats.changedBytes,
      firstChangedByte:archiveStats.firstChangedByte
    }),
    members:Object.freeze({
      original:original.length,
      candidate:candidate.length,
      changed:changedMembers.length,
      modified,added,removed,
      unchanged:entries.length-changedMembers.length
    }),
    changedMembers:Object.freeze(changedMembers),
    unknown:Object.freeze({
      original:originalUnknown.length,
      candidate:candidateUnknown.length,
      preserved:preservedUnknown,
      touched:touchedUnknown.length,
      changedPaths:Object.freeze(touchedUnknown.map(entry=>entry.path))
    })
  });
}

const memberLabel=entry=>{
  const status=entry.status==='modified'?'MOD':entry.status==='added'?'ADD':'DEL';
  const bytes=entry.status==='modified'
    ?entry.byteChanges+'B'
    :entry.status==='added'?('+'+entry.afterSize+'B'):('-'+entry.beforeSize+'B');
  return status+' '+entry.path+' '+bytes;
};

export function formatProjectWriteDiffPreview(preview,{label='PROJECT WRITE',maxMembers=6}={}){
  const diff=preview?.diff||preview;
  if(!diff?.members||!diff?.archive)throw new TypeError('Project write diff preview is invalid.');
  const project=preview?.project!=null?'P'+String(preview.project).padStart(2,'0'):null;
  const changed=Array.isArray(diff.changedMembers)?diff.changedMembers:[];
  const parts=[String(label||'PROJECT WRITE').toUpperCase()+' DIFF'+(project?' · '+project:'')];
  parts.push(
    diff.members.changed+' MEMBER'+(diff.members.changed===1?'':'S')+' CHANGED'+
    ' ('+diff.members.modified+' MOD / '+diff.members.added+' ADD / '+diff.members.removed+' DEL)'
  );
  for(const entry of changed.slice(0,Math.max(0,Number(maxMembers)||0)))parts.push(memberLabel(entry));
  if(changed.length>maxMembers)parts.push('+'+(changed.length-maxMembers)+' MORE');
  if(!changed.length&&diff.archive.changedBytes)parts.push('TAR HEADER/PADDING ONLY');
  parts.push(
    'UNKNOWN '+diff.unknown.preserved+'/'+diff.unknown.original+' PRESERVED'+
    (diff.unknown.touched?' · '+diff.unknown.touched+' TOUCHED':'')
  );
  parts.push(
    'ARCHIVE '+diff.archive.beforeBytes+'→'+diff.archive.afterBytes+'B · '+
    diff.archive.changedBytes+' BYTE POSITION'+(diff.archive.changedBytes===1?'':'S')+' DIFFER'
  );
  if(preview?.original?.crc32&&preview?.candidate?.crc32)
    parts.push('CRC '+preview.original.crc32+'→'+preview.candidate.crc32);
  return parts.join(' · ');
}

import{assertProjectTransportSupported}from './projectProfile.js?v=20261001-1';
import{parseProjectArchive}from './projectArchive.js?v=20261001-1';
import{readProjectPad}from './projectReader.js?v=20261001-1';
import{buildSampleDependencyIndex,assertSampleSlotsUnreferenced,getSampleDependencyBlockers}from './projectDependencies.js?v=20261001-1';

const normalizeSlots=values=>[...new Set(
  Array.from(values||[],Number).filter(value=>Number.isInteger(value)&&value>=1&&value<=999)
)].sort((a,b)=>a-b);

export function readSampleDependencyRequest(operation){
  const request=operation?.sampleDependencyGuard;
  if(request==null)return null;
  if(!request||typeof request!=='object'||!Array.isArray(request.slots))
    throw new Error('Invalid sample dependency guard request.');
  const slots=normalizeSlots(request.slots);
  if(!slots.length)throw new Error('Sample dependency guard request contains no valid source slots.');
  if(request.confirmReferencedDelete!=null&&typeof request.confirmReferencedDelete!=='function')
    throw new Error('Invalid referenced-sample delete confirmation.');
  if(request.onMovePreflight!=null&&typeof request.onMovePreflight!=='function')
    throw new Error('Invalid MOVE preflight receiver.');
  if(request.onProjectRead!=null&&typeof request.onProjectRead!=='function')
    throw new Error('Invalid MOVE project-read progress receiver.');
  const moves=request.moves==null?null:Array.from(request.moves,pair=>Object.freeze({
    sourceId:Number(pair?.sourceId),targetId:Number(pair?.targetId)
  }));
  if(moves&&(!moves.length||moves.some(pair=>
    !Number.isInteger(pair.sourceId)||pair.sourceId<1||pair.sourceId>999||
    !Number.isInteger(pair.targetId)||pair.targetId<1||pair.targetId>999||
    pair.sourceId===pair.targetId
  )))throw new Error('Invalid MOVE source/destination plan.');
  return Object.freeze({
    slots:Object.freeze(slots),
    operation:String(request.operation||'modify'),
    ...(moves?{moves:Object.freeze(moves)}:{}),
    ...(request.onMovePreflight?{onMovePreflight:request.onMovePreflight}:{}),
    ...(request.onProjectRead?{onProjectRead:request.onProjectRead}:{}),
    ...(request.confirmReferencedDelete?{confirmReferencedDelete:request.confirmReferencedDelete}:{})
  });
}

/**
 * Read only the on-device pad assignments needed for sample-delete safety.
 * A firmware-created project may have implicit/absent pattern members even
 * though its scene table references them. That must not invalidate a reliable
 * scan of its pads. Keep the strict project validator for project WRITES.
 *
 * Fail closed for a malformed TAR, missing/ambiguous pad records or unexpected
 * pad encodings: otherwise a referenced sample could be deleted accidentally.
 */
export function readProjectPadDependencies(input,{profile}={}){
  if(!profile||!['ep133','ep40'].includes(profile.id))
    throw new Error('Sample dependency preflight requires a verified EP-133 or EP-40 project profile.');
  const pads={a:[],b:[],c:[],d:[]};
  const seen=new Set();
  const lengths=Array.isArray(profile.readablePadRecordSizes)
    ?profile.readablePadRecordSizes
    :Array.isArray(profile.acceptedPadRecordSizes)
      ?profile.acceptedPadRecordSizes:[profile.padRecordSize];
  for(const member of parseProjectArchive(input)){
    const path=String(member.path);
    if(member.type==='5'){
      if(/^pads\/[abcd]\/p(?:0[1-9]|1[0-2])$/.test(path))
        throw new Error('Project pad is a directory, not a record: '+path+'.');
      continue;
    }
    if(path!=='pads'&&!path.startsWith('pads/'))continue;
    if(!/^pads\/[abcd]\/p(?:0[1-9]|1[0-2])$/.test(path))
      throw new Error('Unexpected project pad member '+path+'; sample deletion cannot be verified.');
    if(seen.has(path))throw new Error('Duplicate project pad member '+path+'.');
    seen.add(path);
    if(!lengths.includes(member.data.length))
      throw new Error(path+' has unsupported pad-record size '+member.data.length+'.');
    if(member.data[0]!==0)
      throw new Error(path+' has a nonzero validity byte; sample deletion cannot be verified.');
    const pad=readProjectPad(member,{profile});
    const maxSlot=profile.supportsSupertone?1009:999;
    if(pad.storedSlot>maxSlot)
      throw new Error(path+' references slot/symbol '+pad.storedSlot+' outside 0..'+maxSlot+'.');
    pads[pad.group].push({
      path:pad.path,group:pad.group,pad:pad.pad,sampleSlot:pad.sampleSlot
    });
  }
  return{pads};
}

export function createSampleDependencyGuard({getConnectedDeviceInfo}={}){
  if(typeof getConnectedDeviceInfo!=='function')throw new TypeError('Sample dependency guard requires device identity access.');

  const getProfile=()=>{
    const info=getConnectedDeviceInfo();
    if(!info)throw new Error('EP-series device is not connected.');
    const firmware=String(info.metadata?.os_version||info.metadata?.sw_version||'');
    const profile=assertProjectTransportSupported(info.sku,firmware);
    if(profile.id!=='ep133'&&profile.id!=='ep40')
      throw new Error('Sample dependency indexing is enabled only for EP-133 and EP-40.');
    return profile;
  };

  const buildIndex=async(fileOps,{verifiedMove=false,onProjectRead=null}={})=>{
    if(!fileOps?.listDirectory||!fileOps?.getFile)throw new TypeError('Sample dependency guard requires lease-bound FILE reads.');
    const profile=getProfile();
    const root=await fileOps.listDirectory(0,'/');
    const parent=root.find(item=>item.fileName==='/projects'&&item.fileType==='folder');
    if(!parent)throw new Error('EP-series /projects node is not available for sample dependency preflight.');
    const projects=(await fileOps.listDirectory(parent.nodeId,'/projects'))
      .filter(item=>item.fileType==='folder'&&/^\/projects\/\d{2}$/.test(item.fileName))
      .sort((a,b)=>a.fileName.localeCompare(b.fileName));
    const results=[];
    // Keep the full authoritative device scan on every MOVE; only eliminate
    // redundant FILE_INIT rounds, not the project reads or safety checks.
    const readProject=verifiedMove&&profile.id==='ep133'&&
      typeof fileOps.getFileInInitializedSession==='function'
      ?fileOps.getFileInInitializedSession:fileOps.getFile;
    onProjectRead?.(0,projects.length);
    for(const node of projects){
      const archive=await readProject(node.nodeId);
      results.push({
        project:node.fileName.slice(-2),
        nodeId:node.nodeId,
        // Keep exact pre-MOVE TAR bytes under the strict FILE lease for readback.
        data:archive.data.slice(),
        model:readProjectPadDependencies(archive.data,{profile})
      });
      onProjectRead?.(results.length,projects.length);
    }
    return Object.freeze({
      ...buildSampleDependencyIndex(results),
      projectSnapshots:Object.freeze(results.map(result=>Object.freeze({
        project:result.project,nodeId:result.nodeId,data:result.data
      })))
    });
  };

  const assertOperationSafe=async(fileOps,operation)=>{
    const request=readSampleDependencyRequest(operation);
    if(!request)return null;
    const device=getConnectedDeviceInfo();
    const verifiedMove=request.operation==='move'&&
      device?.sku==='TE032AS001'&&device?.metadata?.os_version==='2.5.1';
    const index=await buildIndex(fileOps,{
      verifiedMove,onProjectRead:request.onProjectRead
    });
    const blockers=getSampleDependencyBlockers(index,request.slots);
    if(request.operation==='move'&&request.moves){
      const sources=request.moves.map(pair=>pair.sourceId).sort((a,b)=>a-b);
      const targets=request.moves.map(pair=>pair.targetId);
      if(sources.length!==request.slots.length||
         sources.some((slot,i)=>slot!==request.slots[i])||
         new Set(sources).size!==sources.length||
         new Set(targets).size!==targets.length||
         targets.some(slot=>request.slots.includes(slot)))
        throw new Error('MOVE preflight plan does not match its complete source slot set.');
      if(getSampleDependencyBlockers(index,targets).length)
        throw new Error('MOVE destination is already referenced by a saved project.');
    }
    if(request.operation==='move'&&blockers.length){
      const info=getConnectedDeviceInfo();
      // Hardware evidence for firmware-managed multi-project remap is currently
      // limited to the exact EP-133 2.5.1 identity. Never generalize to EP-40.
      if(info?.sku!=='TE032AS001'||info?.metadata?.os_version!=='2.5.1'||
         !request.moves||typeof request.onMovePreflight!=='function')
        assertSampleSlotsUnreferenced(index,request.slots,{operation:'move'});
      request.onMovePreflight(Object.freeze({
        projectSnapshots:Object.freeze(index.projectSnapshots.filter(item=>
          blockers.some(blocker=>blocker.projects.includes(item.project))
        )),
        references:Object.freeze(blockers.flatMap(blocker=>blocker.references)),
        verifiedFastRead:verifiedMove
      }));
      return index;
    }
    if(!blockers.length)return index;
    if(request.operation==='delete'&&request.confirmReferencedDelete){
      // Project pads remain unchanged. The user must explicitly accept that
      // the referenced sound will disappear. Unknown/malformed projects have
      // already failed closed during buildIndex.
      const confirmed=await request.confirmReferencedDelete(blockers);
      return confirmed===true?index:false;
    }
    assertSampleSlotsUnreferenced(index,request.slots,{operation:request.operation});
    return index;
  };

  return Object.freeze({buildIndex,assertOperationSafe});
}

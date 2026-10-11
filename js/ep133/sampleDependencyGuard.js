import{assertProjectTransportSupported}from './projectProfile.js?v=20261001-1';
import{parseProjectArchive}from './projectArchive.js?v=20261001-1';
import{readProjectPad}from './projectReader.js?v=20261001-1';
import{buildSampleDependencyIndex,assertSampleSlotsUnreferenced}from './projectDependencies.js?v=20261001-1';

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
  return Object.freeze({slots:Object.freeze(slots),operation:String(request.operation||'modify')});
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
  const lengths=Array.isArray(profile.acceptedPadRecordSizes)
    ?profile.acceptedPadRecordSizes
    :[profile.padRecordSize];
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

  const buildIndex=async fileOps=>{
    if(!fileOps?.listDirectory||!fileOps?.getFile)throw new TypeError('Sample dependency guard requires lease-bound FILE reads.');
    const profile=getProfile();
    const root=await fileOps.listDirectory(0,'/');
    const parent=root.find(item=>item.fileName==='/projects'&&item.fileType==='folder');
    if(!parent)throw new Error('EP-series /projects node is not available for sample dependency preflight.');
    const projects=(await fileOps.listDirectory(parent.nodeId,'/projects'))
      .filter(item=>item.fileType==='folder'&&/^\/projects\/\d{2}$/.test(item.fileName))
      .sort((a,b)=>a.fileName.localeCompare(b.fileName));
    const results=[];
    for(const node of projects){
      const archive=await fileOps.getFile(node.nodeId);
      results.push({
        project:node.fileName.slice(-2),
        nodeId:node.nodeId,
        model:readProjectPadDependencies(archive.data,{profile})
      });
    }
    return buildSampleDependencyIndex(results);
  };

  const assertOperationSafe=async(fileOps,operation)=>{
    const request=readSampleDependencyRequest(operation);
    if(!request)return null;
    const index=await buildIndex(fileOps);
    assertSampleSlotsUnreferenced(index,request.slots,{operation:request.operation});
    return index;
  };

  return Object.freeze({buildIndex,assertOperationSafe});
}

import{assertProjectTransportSupported}from './projectProfile.js?v=20261001-1';
import{readProjectModel}from './projectReader.js?v=20261001-1';
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
        model:readProjectModel(archive.data,{profile})
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

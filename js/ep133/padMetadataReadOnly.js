import{resolveRegisteredCapabilityEvidence}from './evidenceRegistry.js?v=20261001-1';
import{assessEpFirmwareCompatibility}from './deviceCompatibilityMatrix.js?v=20261008-1';
import{decodeFileRights}from './deviceCapabilities.js?v=20261001-1';
import{assertFileMetadata}from './coreContracts.js?v=20261008-1';

// Read-only extraction of PR #139's LIST/INFO target discovery. No writer,
// payload preparation, archive fallback or recovery dependency belongs here.
export function getPadReadAvailability(device={}){
  const sku=String(device?.sku||'');
  const firmware=String(device?.metadata?.os_version||device?.metadata?.sw_version||device?.firmware||'');
  const compatibility=assessEpFirmwareCompatibility(sku,firmware);
  // This capability is absent in current main. Do not infer it from sample
  // metadata, project archive/reload permissions or raw FILE capability flags.
  const evidence=resolveRegisteredCapabilityEvidence(sku,'project.pad-metadata',firmware);
  return Object.freeze({read:compatibility.supported&&evidence.read===true,write:false,evidence,
    reason:compatibility.supported?(evidence.read?'':('Pad metadata READ is not authorized. '+evidence.reason)):compatibility.reason});
}

const validFid=value=>Number.isInteger(value)&&value>0&&value<=0xffff;
const validName=value=>typeof value==='string'&&value!=='.'&&value!=='..'&&value.length>0&&!/[\x00-\x1f\x7f/\\]/.test(value);
const metadataObject=value=>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Pad metadata must be an object.');
  assertFileMetadata(value,'Pad metadata');return structuredClone(value);
};
const selectors=(options={},required=false)=>{
  const{project,group,pad,sampleSlot}=options;
  if(!Number.isInteger(sampleSlot)||sampleSlot<1||sampleSlot>999)throw Error('Invalid library sample slot.');
  if((required||project!=null)&&!(typeof project==='string'&&/^(0[1-9]|[1-9]\d)$/.test(project)))throw Error('Invalid project selector.');
  if((required||group!=null)&&!['A','B','C','D'].includes(group))throw Error('Invalid group selector.');
  if((required||pad!=null)&&!(typeof pad==='string'&&/^(0[1-9]|1[0-2])$/.test(pad)))throw Error('Invalid pad selector.');
  if(group!=null&&project==null||pad!=null&&group==null)throw Error('Incomplete project/group/pad selectors.');
  return{project,group,pad,sampleSlot};
};
const assignment=metadata=>{
  const sym=metadata.sym;
  const slot=typeof sym==='number'?sym:typeof sym==='string'&&/^\d+$/.test(sym)?Number(sym):NaN;
  return Number.isInteger(slot)&&slot>=1&&slot<=999
    ?{status:'VERIFIED',sampleSlot:slot,reason:''}
    :{status:'UNVERIFIED',sampleSlot:null,reason:'Live pad assignment is missing, zero or ambiguous.'};
};

function treeReader(ops){
  let total=0;const seen=new Set([0]);
  const children=async(fid,path)=>{
    let received=0;
    const entries=await ops.listDirectory(fid,path,null,()=>{
      if(++received>1024||total+received>4096)throw Error('Pad discovery entry limit exceeded.');
    });
    if(!Array.isArray(entries))throw Error('Invalid pad directory listing.');
    total+=entries.length;if(entries.length>1024||total>4096)throw Error('Pad discovery entry limit exceeded.');
    const prefix=path==='/'?'/':path+'/',names=new Set();
    return entries.map(entry=>{
      const name=typeof entry?.fileName==='string'&&entry.fileName.startsWith(prefix)?entry.fileName.slice(prefix.length):null;
      if(!validName(name)||!validFid(entry.nodeId)||seen.has(entry.nodeId)||names.has(name))
        throw Error('Ambiguous or invalid pad tree LIST identity.');
      seen.add(entry.nodeId);names.add(name);return{...entry,name};
    });
  };
  const inspect=async(entry,parentId,type)=>{
    const info=await ops.getFileInfo(entry.nodeId);
    if(!info||info.nodeId!==entry.nodeId||info.parentId!==parentId||info.fileName!==entry.name)
      throw Error('Pad INFO identity, parent or name does not match LIST.');
    if(!Number.isInteger(info.flags)||info.flags<0||info.flags>255||
      (info.flags&3)!==(type==='folder'?2:1)||entry.fileType!==type||!decodeFileRights(info.flags).read)
      throw Error('Pad INFO type and READ capability are required.');
    return entry;
  };
  const find=(entries,name)=>{const entry=entries.find(e=>e.name===name);if(!entry)throw Error('Pad node not found: '+name);return entry;};
  return{children,inspect,find};
}

async function resolveTree(ops,s){
  const tree=treeReader(ops),root=await tree.children(0,'/');
  const directory=await tree.inspect(tree.find(root,'projects'),0,'folder');
  const projectNodes=await tree.children(directory.nodeId,'/projects');
  const result={projects:[],groups:[],pads:[],unverifiedPads:[]};
  for(const node of projectNodes){
    selectors({project:node.name,sampleSlot:s.sampleSlot});
    await tree.inspect(node,directory.nodeId,'folder');result.projects.push({project:node.name,projectFid:node.nodeId});
  }
  if(s.project==null)return{tree,result};
  const projectNode=tree.find(projectNodes,s.project),projectFid=projectNode.nodeId;
  const path='/projects/'+s.project;
  const projectChildren=await tree.children(projectFid,path);
  const groups=await tree.inspect(tree.find(projectChildren,'groups'),projectFid,'folder');
  const groupNodes=await tree.children(groups.nodeId,path+'/groups');
  for(const node of groupNodes){
    selectors({...s,group:node.name});await tree.inspect(node,groups.nodeId,'folder');
    result.groups.push({project:s.project,group:node.name,projectFid,groupFid:node.nodeId});
  }
  if(s.group==null)return{tree,result};
  const groupNode=tree.find(groupNodes,s.group),groupFid=groupNode.nodeId;
  const padNodes=await tree.children(groupFid,path+'/groups/'+s.group);
  for(const node of padNodes)selectors({...s,pad:node.name});
  return{tree,result,padNodes,projectFid,groupFid};
}
const targetFrom=(s,node,projectFid,groupFid)=>({...s,pad:node.name,projectFid,groupFid,padFid:node.nodeId});
async function listTargets(ops,options){
  const s=selectors(options),{tree,result,padNodes,projectFid,groupFid}=await resolveTree(ops,s);
  for(const node of padNodes||[]){
    await tree.inspect(node,groupFid,'file');
    const status=assignment(metadataObject(await ops.getFileMetadata(node.nodeId)));
    const target=targetFrom(s,node,projectFid,groupFid);
    if(status.status==='UNVERIFIED')result.unverifiedPads.push({...target,assignment:status});
    else if(status.sampleSlot===s.sampleSlot)result.pads.push(target);
  }
  return result;
}
async function readTarget(ops,options){
  const s=selectors(options,true);
  for(const key of ['projectFid','groupFid','padFid'])if(!validFid(options[key]))throw Error('Previously discovered pad FID required.');
  const{tree,padNodes,projectFid,groupFid}=await resolveTree(ops,s);
  const node=await tree.inspect(tree.find(padNodes,s.pad),groupFid,'file');
  const target=targetFrom(s,node,projectFid,groupFid);
  for(const key of ['projectFid','groupFid','padFid'])if(target[key]!==options[key])throw Error('Pad target FID changed; discover again.');
  const metadata=metadataObject(await ops.getFileMetadata(node.nodeId)),status=assignment(metadata);
  if(status.status==='VERIFIED'&&status.sampleSlot!==s.sampleSlot)throw Error('Pad assignment no longer matches the selected library sample.');
  return{target,metadata,assignment:status};
}

const deviceIdentity=device=>JSON.stringify([device?.sku,device?.metadata?.os_version||device?.metadata?.sw_version||device?.firmware,
  device?.metadata?.serialNumber||device?.metadata?.serial]);
export function createPadMetadataReader({withFileTransaction,getConnectedDeviceInfo,captureSession,assertSession,
  getAvailability=getPadReadAvailability,assertReadable=()=>{}}={}){
  for(const service of [withFileTransaction,getConnectedDeviceInfo,captureSession,assertSession,getAvailability,assertReadable])
    if(typeof service!=='function')throw TypeError('Pad reader requires transaction, session and permission services.');
  const run=(label,operation,selectors,options={})=>{
    const target=structuredClone(selectors),token=options.sessionToken??captureSession(),identity=deviceIdentity(getConnectedDeviceInfo());
    const guard=()=>{
      if(options.isCurrent&&options.isCurrent()!==true)throw Error('Pad read cancelled.');
      assertSession(token);
      if(deviceIdentity(getConnectedDeviceInfo())!==identity)throw Error('Pad device identity changed.');
      const permission=getAvailability(getConnectedDeviceInfo());
      if(permission?.read!==true)throw Error(permission?.reason||'Pad READ permission requires firmware evidence.');
      assertReadable();
    };
    // Promise rejection, including pre-lease failures, has one consumer contract.
    return Promise.resolve().then(()=>{
      guard();return withFileTransaction(label,async lease=>{
        guard();const reads={};
        for(const name of ['listDirectory','getFileInfo','getFileMetadata']){
          if(typeof lease?.[name]!=='function')throw Error('Pad reader requires lease-bound '+name);
          reads[name]=async(...args)=>{guard();const result=await lease[name](...args);guard();return result;};
        }
        const result=await operation(Object.freeze(reads),target);guard();return result;
      },{strict:false});
    });
  };
  return Object.freeze({
    listTargets:(selectors,options)=>run('read-only pad discovery',listTargets,selectors,options),
    readTarget:(selectors,options)=>run('read-only pad snapshot',readTarget,selectors,options)
  });
}

import{resolveDeviceCapabilities}from './deviceCapabilities.js?v=20261001-1';
import{assessEpFirmwareCompatibility}from './deviceCompatibilityMatrix.js?v=20261008-1';
import{assertFileMetadata}from './coreContracts.js?v=20261008-1';
import{TE_SYSEX_FILE_CAPABILITY_READ,TE_SYSEX_FILE_FILE_TYPE_FILE,TE_SYSEX_FILE_FILE_TYPE_DIR}from './constants.js';

/**
 * Pure pad-node contracts, separate from /sounds defaults and native TAR records.
 * Field names/string enums/release pairing come from the public protocol document
 * pinned in evidenceRegistry.PAD_METADATA_PROTOCOL_SOURCE. This documents a shape;
 * it does not establish a safe physical write payload on any model/firmware.
 * The runtime must independently require getPadMetadataAvailability(...).write.
 */
export const PAD_METADATA_FIELDS=Object.freeze([
  'sym','sound.playmode','sample.start','sample.end','envelope.attack',
  'envelope.release','sound.pitch','sound.amplitude','sound.pan','sound.mutegroup',
  'time.mode','midi.channel'
]);
const FIELDS=new Set(PAD_METADATA_FIELDS);
const EDITABLE=new Set(['sound.pitch','sound.playmode','time.mode']);
const PLAY_MODES=Object.freeze(['oneshot','key','legato']);
const TIME_MODES=Object.freeze(['off','bar','bpm']);
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const object=(value,label)=>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(label+' must be a metadata object.');
  return value;
};

/** deviceInfo: {sku, firmware} or the connected {sku, metadata:{os_version,sw_version}}. */
export function getPadMetadataAvailability(deviceInfo={}){
  const sku=String(deviceInfo?.sku||'');
  const firmware=String(deviceInfo?.metadata?.os_version||deviceInfo?.metadata?.sw_version||deviceInfo?.firmware||'');
  const compatibility=assessEpFirmwareCompatibility(sku,firmware);
  const evidence=resolveDeviceCapabilities({sku,firmware}).evidence.padMetadata;
  return Object.freeze({
    read:compatibility.supported&&evidence.read===true,
    write:compatibility.supported&&evidence.write===true,
    reason:compatibility.supported?(evidence.reason||''):compatibility.reason,
    evidence
  });
}

/**
 * Optional profile: {playModes: string[]} (e.g. getEpDeviceProfile's result).
 * It can restrict documented modes; it cannot introduce new wire enums/mappings.
 * Numeric enums are refused: this source contains no pad numeric-to-string map.
 * Partial read snapshots can normalize; preparation below requires all 12 fields.
 */
export function normalizePadMetadata(metadata,{profile}={}){
  object(metadata,'Pad metadata');
  const result={};
  for(const[key,value]of Object.entries(metadata)){
    if(!FIELDS.has(key))throw new Error('Unsupported pad metadata field: '+key);
    if(key==='sound.playmode'||key==='time.mode'){
      const modes=key==='sound.playmode'?PLAY_MODES:TIME_MODES;
      if(typeof value!=='string'||!modes.includes(value))throw new Error('Unsupported pad enum for '+key+'. Source-backed string mode required.');
      if(key==='sound.playmode'&&Array.isArray(profile?.playModes)&&!profile.playModes.includes(value))
        throw new Error('Pad play mode is not allowed by the connected profile.');
    }else if(key==='sym'){
      // Keep the authoritative assignment identifier's type/value unchanged.
      if(!((typeof value==='string'&&value.trim().length>0)||
        (typeof value==='number'&&Number.isSafeInteger(value)&&value>=0)))
        throw new Error('Invalid pad assignment sym.');
    }else{
      if(typeof value!=='number'||!Number.isFinite(value))throw new Error('Pad '+key+' requires a finite number.');
      if(key==='sound.pitch'&&(value<-12||value>12))throw new Error('Pad pitch is outside -12..12.');
      if((key==='envelope.attack'||key==='envelope.release')&&(!Number.isInteger(value)||value<0||value>255))
        throw new Error('Invalid pad '+key+' byte.');
    }
    result[key]=value;
  }
  return result;
}

function completeSnapshot(metadata,options){
  const result=normalizePadMetadata(metadata,options);
  for(const field of PAD_METADATA_FIELDS)
    if(!own(result,field))throw new Error('Complete pad snapshot required; missing '+field+'.');
  return result;
}

function assertChanges(changes){
  object(changes,'Pad changes');
  for(const key of Object.keys(changes)){
    if(EDITABLE.has(key))continue;
    if(key==='envelope.release'&&own(changes,'sound.playmode'))continue;
    throw new Error('Unsupported pad change: '+key+'. Release is only a playmode companion.');
  }
}

/** Build a complete candidate; never supply defaults or authorize a physical SET. */
export function preparePadMetadataPayload(before,changes,{profile}={}){
  const snapshot=completeSnapshot(before,{profile});
  assertChanges(changes);
  const normalizedChanges=normalizePadMetadata(changes,{profile});
  return{...snapshot,...normalizedChanges};
}

/**
 * Report: {ok,intendedFields,preservedFields,mismatches:[{field,kind,expected,actual}]}.
 * kind is intended/preserved for readback differences, or payload for invalid
 * candidates. Compare every supported field, including unchanged pad overrides.
 */
export function verifyPadMetadata(before,payload,readback){
  const mismatches=[];
  const intendedFields=[];
  const preservedFields=[];
  let snapshot,candidate;
  try{
    snapshot=completeSnapshot(before);
    candidate=completeSnapshot(payload);
    const changes={};
    for(const key of PAD_METADATA_FIELDS){
      if(Object.is(snapshot[key],candidate[key]))preservedFields.push(key);
      else{intendedFields.push(key);changes[key]=candidate[key];}
    }
    // A release-only difference is still valid when a complete payload carries
    // the unchanged playmode explicitly as its documented companion.
    if(own(changes,'envelope.release'))changes['sound.playmode']=candidate['sound.playmode'];
    for(const key of Object.keys(changes))
      if(!EDITABLE.has(key)&&key!=='envelope.release')
        mismatches.push({field:key,kind:'payload',expected:snapshot[key],actual:candidate[key]});
    assertChanges(changes);
  }catch(error){
    mismatches.push({field:null,kind:'payload',reason:error.message});
    return{ok:false,intendedFields,preservedFields,mismatches};
  }
  const actual=readback&&typeof readback==='object'&&!Array.isArray(readback)?readback:{};
  for(const key of PAD_METADATA_FIELDS){
    if(!own(actual,key)||!Object.is(candidate[key],actual[key]))
      mismatches.push({field:key,kind:intendedFields.includes(key)?'intended':'preserved',expected:candidate[key],actual:actual[key]});
  }
  for(const key of Object.keys(actual))
    if(!FIELDS.has(key))mismatches.push({field:key,kind:'preserved',reason:'Unsupported readback field.'});
  return{ok:mismatches.length===0,intendedFields,preservedFields,mismatches};
}

// These services accept only the caller's transaction lease. The runtime owns
// connection, authorization, session invalidation and firmware read permission.
// Never substitute standalone FILE functions or cached project archives here.
const MAX_DIRECTORY_ENTRIES=1024;
const MAX_DISCOVERY_ENTRIES=4096;
const validFid=value=>Number.isInteger(value)&&value>0&&value<=0xffff;
const validName=value=>typeof value==='string'&&value.length>0&&
  value!=='.'&&value!=='..'&&!/[\x00-\x1f\x7f/\\]/.test(value);

function padSelectors({project,group,pad,sampleSlot}={},required=false){
  for(const[key,value]of Object.entries({project,group,pad}))
    if((required||value!=null)&&!validName(value))throw new Error('Invalid or missing pad '+key+' selector.');
  if(group!=null&&project==null||pad!=null&&group==null)
    throw new Error('Incomplete project/group/pad selector chain.');
  if(!Number.isInteger(sampleSlot)||sampleSlot<1||sampleSlot>999)
    throw new Error('Pad sampleSlot must be a library sample slot in 1..999.');
  return{project,group,pad,sampleSlot};
}

function padTreeReader(fileOps){
  for(const name of ['listDirectory','getFileInfo','getFileMetadata'])
    if(typeof fileOps?.[name]!=='function')throw new TypeError('Pad discovery requires lease-bound FILE reads: '+name+'.');
  let total=0;
  const seen=new Set([0]);
  const children=async(nodeId,path)=>{
    let received=0;
    // The transport invokes onEntry while collecting pages, so reject excessive
    // trees before it accumulates an unbounded directory in memory.
    const entries=await fileOps.listDirectory(nodeId,path,null,()=>{
      if(++received>MAX_DIRECTORY_ENTRIES||total+received>MAX_DISCOVERY_ENTRIES)
        throw new Error('Pad discovery directory entry limit exceeded.');
    });
    if(!Array.isArray(entries))throw new Error('Invalid pad directory listing.');
    total+=entries.length;
    if(entries.length>MAX_DIRECTORY_ENTRIES||total>MAX_DISCOVERY_ENTRIES)
      throw new Error('Pad discovery directory entry limit exceeded.');
    const prefix=path==='/'?'/':path+'/';
    const names=new Set();
    return entries.map(entry=>{
      const name=typeof entry?.fileName==='string'&&entry.fileName.startsWith(prefix)
        ?entry.fileName.slice(prefix.length):null;
      if(!validName(name))throw new Error('Invalid pad tree child path.');
      if(!validFid(entry.nodeId)||seen.has(entry.nodeId)||names.has(name))
        throw new Error('Ambiguous or duplicate pad tree identity.');
      seen.add(entry.nodeId);names.add(name);
      return{...entry,name};
    });
  };
  const inspect=async(entry,parentId,type)=>{
    const info=await fileOps.getFileInfo(entry.nodeId);
    if(!info||info.nodeId!==entry.nodeId||info.parentId!==parentId||info.fileName!==entry.name)
      throw new Error('Pad tree INFO identity, parent or name does not match LIST chain.');
    const bits=type==='folder'?TE_SYSEX_FILE_FILE_TYPE_DIR:TE_SYSEX_FILE_FILE_TYPE_FILE;
    if(!Number.isInteger(info.flags)||info.flags<0||info.flags>255||
      (info.flags&3)!==bits||entry.fileType!==type)
      throw new Error('Pad tree INFO node type does not match LIST chain.');
    if(!(info.flags&TE_SYSEX_FILE_CAPABILITY_READ))
      throw new Error('Pad tree INFO read capability is required.');
    return entry;
  };
  const find=(entries,name)=>{
    const entry=entries.find(item=>item.name===name);
    if(!entry)throw new Error('Pad target node not found: '+name+'.');
    return entry;
  };
  return{children,inspect,find};
}

async function resolvePadTree(fileOps,selectors){
  const tree=padTreeReader(fileOps);
  const root=await tree.children(0,'/');
  const directory=await tree.inspect(tree.find(root,'projects'),0,'folder');
  const projectNodes=await tree.children(directory.nodeId,'/projects');
  const projects=[];
  for(const node of projectNodes){
    await tree.inspect(node,directory.nodeId,'folder');
    projects.push({project:node.name,projectFid:node.nodeId});
  }
  const result={projects,groups:[],pads:[]};
  if(selectors.project==null)return{tree,result};
  const projectNode=tree.find(projectNodes,selectors.project);
  const projectFid=projectNode.nodeId;
  const projectPath='/projects/'+projectNode.name;
  const projectChildren=await tree.children(projectFid,projectPath);
  const groupsDirectory=await tree.inspect(tree.find(projectChildren,'groups'),projectFid,'folder');
  const groupNodes=await tree.children(groupsDirectory.nodeId,projectPath+'/groups');
  for(const node of groupNodes){
    await tree.inspect(node,groupsDirectory.nodeId,'folder');
    result.groups.push({project:selectors.project,group:node.name,projectFid,groupFid:node.nodeId});
  }
  if(selectors.group==null)return{tree,result};
  const groupNode=tree.find(groupNodes,selectors.group);
  const padNodes=await tree.children(groupNode.nodeId,projectPath+'/groups/'+groupNode.name);
  return{tree,result,padNodes,projectFid,groupFid:groupNode.nodeId};
}

function padAssignment(metadata){
  object(metadata,'Pad assignment metadata');
  const sym=metadata.sym;
  if(!(typeof sym==='number'&&Number.isSafeInteger(sym)&&sym>=0||
    typeof sym==='string'&&/^\d+$/.test(sym)&&Number.isSafeInteger(Number(sym))))
    throw new Error('Missing or ambiguous pad assignment sym.');
  return Number(sym);
}

function targetFrom(selectors,node,projectFid,groupFid){
  return{project:selectors.project,group:selectors.group,pad:node.name,
    projectFid,groupFid,padFid:node.nodeId,sampleSlot:selectors.sampleSlot};
}

/** Literal device-name selectors; readable nodes need no WRITE permission. */
export async function listPadTargets(fileOps,options={}){
  const selectors=padSelectors(options);
  const{tree,result,padNodes,projectFid,groupFid}=await resolvePadTree(fileOps,selectors);
  for(const node of padNodes||[]){
    await tree.inspect(node,groupFid,'file');
    const metadata=await fileOps.getFileMetadata(node.nodeId);
    const assignment=padAssignment(metadata);
    assertFileMetadata(metadata,'Pad assignment metadata');
    // sym:0 is not a verified assignment, even if an archive says otherwise.
    if(assignment!==0&&assignment===selectors.sampleSlot)
      result.pads.push(targetFrom(selectors,node,projectFid,groupFid));
  }
  return result;
}

const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;

/**
 * Resolve again on every call. No saved-archive values or enum conversions.
 * Fingerprint is deterministic JSON for equality checks, not an authenticity hash.
 * A mutation consumer must also compare every returned target FID with its
 * previously selected target; selectors never authorize a relocated node.
 */
export async function readPadTarget(fileOps,options={}){
  const selectors=padSelectors(options,true);
  const{tree,padNodes,projectFid,groupFid}=await resolvePadTree(fileOps,selectors);
  const node=await tree.inspect(tree.find(padNodes,selectors.pad),groupFid,'file');
  const raw=await fileOps.getFileMetadata(node.nodeId);
  if(padAssignment(raw)!==selectors.sampleSlot)
    throw new Error('Pad assignment does not match the selected library sample.');
  assertFileMetadata(raw,'Pad assignment metadata');
  const metadata=JSON.parse(JSON.stringify(raw));
  const target=targetFrom(selectors,node,projectFid,groupFid);
  const fingerprint=JSON.stringify(canonical({target,metadata}));
  return{target,metadata,fingerprint};
}

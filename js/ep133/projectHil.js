import{getConnectedDeviceInfo,getDeviceSessionToken,passiveFirmwareDebugPreflight}from './device.js?v=20260929-23';
import{listDeviceFiles,getFile,getFileMetadata,uploadProjectArchive,downloadProjectArchive}from './filesystem.js?v=20260929-23';
import{getEpProjectProfile}from './projectProfile.js?v=20260929-23';
import{validateProjectArchive,preflightProjectSampleDependencies}from './projectArchive.js?v=20260929-23';
import{readProjectModel,buildProjectFromModel}from './projectReader.js?v=20260929-23';

const bytesEqual=(a,b)=>{
  const aa=a instanceof Uint8Array?a:new Uint8Array(a||[]);
  const bb=b instanceof Uint8Array?b:new Uint8Array(b||[]);
  if(aa.length!==bb.length)return false;
  for(let i=0;i<aa.length;i++)if(aa[i]!==bb[i])return false;
  return true;
};
const projectNumberFromPath=path=>{
  const match=String(path||'').match(/^\/projects\/(\d{2})$/);
  return match?Number(match[1]):null;
};
const normalizedRequestedProjects=value=>{
  if(value==null)return null;
  const list=Array.isArray(value)?value:[value];
  const set=new Set();
  for(const item of list){
    const number=Number(item);
    if(!Number.isInteger(number)||number<1||number>99)throw new Error('HIL project numbers must be 1..99.');
    set.add(number);
  }
  return set;
};
const safeError=error=>String(error?.message||error||'Unknown error');

function requireHilProfile(info){
  const firmware=String(info?.metadata?.os_version||info?.metadata?.sw_version||'');
  const profile=getEpProjectProfile(info?.sku,firmware);
  if(profile.id!=='ep133'&&profile.id!=='ep40')
    throw new Error('Read-only project HIL is enabled only for EP-133 and EP-40.');
  return profile;
}

export function auditProjectArchiveBytes(input,{profile,occupiedSlots=[]}={}){
  if(!profile||!['ep133','ep40'].includes(profile.id))
    throw new Error('Archive audit requires an explicit EP-133 or EP-40 profile.');
  const data=input instanceof Uint8Array?input:new Uint8Array(input||[]);
  const validation=validateProjectArchive(data,{profile});
  const model=readProjectModel(data,{profile});
  const rebuilt=buildProjectFromModel(model);
  const sampleDependencies=preflightProjectSampleDependencies(data,occupiedSlots,{profile});
  const patternUnknownRecords=model.patterns.reduce((sum,pattern)=>sum+pattern.unknownRecords.length,0);
  const assignedPads=Object.values(model.pads).flat().filter(pad=>pad.storedSlot!==0);
  return{
    validation,
    roundtripByteExact:bytesEqual(data,rebuilt),
    sourceBytes:data.length,
    memberOrder:[...model.sourceMemberOrder],
    pads:{
      present:Object.values(model.pads).reduce((sum,pads)=>sum+pads.length,0),
      assigned:assignedPads.length,
      sampleAssignments:assignedPads.filter(pad=>pad.sampleSlot!=null).length,
      supertoneAssignments:assignedPads.filter(pad=>pad.supertone!=null).length
    },
    patterns:{
      count:model.patterns.length,
      notes:model.patterns.reduce((sum,pattern)=>sum+pattern.notes.length,0),
      automation:model.patterns.reduce((sum,pattern)=>sum+pattern.automation.length,0),
      unknownRecords:patternUnknownRecords
    },
    scenes:{
      present:!!model.scenes,
      used:model.scenes?model.scenes.entries.filter(scene=>scene.used).length:0,
      currentScene:model.scenes?.currentScene??null,
      songLength:model.scenes?.songLength??0
    },
    settingsPresent:!!model.settings,
    fxSettingsPresent:!!model.fxSettings,
    livePresent:!!model.live,
    unknownMembers:model.unknownMembers.map(member=>member.path),
    uncertainties:{...model.uncertainties},
    sampleDependencies
  };
}

export async function auditConnectedEpProjects({projectNumbers=null,onProgress}={}){
  const info=getConnectedDeviceInfo();
  if(!info)throw new Error('Connect an EP-133 or EP-40 before running project HIL.');
  const profile=requireHilProfile(info);
  const requested=normalizedRequestedProjects(projectNumbers);
  const sessionToken=getDeviceSessionToken();
  if(!sessionToken)throw new Error('EP device session is not available.');

  await passiveFirmwareDebugPreflight(1200,'read-only project HIL');
  if(getDeviceSessionToken()!==sessionToken)throw new Error('EP device session changed during HIL preflight.');

  onProgress?.({phase:'list'});
  const files=await listDeviceFiles();
  if(getDeviceSessionToken()!==sessionToken)throw new Error('EP device session changed while listing files.');

  const occupiedSlots=files
    .filter(item=>item.fileType==='file'&&String(item.fileName).startsWith('/sounds/'))
    .map(item=>Number(item.nodeId))
    .filter(id=>Number.isInteger(id)&&id>=1&&id<=999);

  const projectNodes=files
    .filter(item=>item.fileType==='folder'&&projectNumberFromPath(item.fileName)!=null)
    .map(item=>({...item,projectNumber:projectNumberFromPath(item.fileName)}))
    .filter(item=>requested==null||requested.has(item.projectNumber))
    .sort((a,b)=>a.projectNumber-b.projectNumber);

  const projects=[];
  for(let index=0;index<projectNodes.length;index++){
    const node=projectNodes[index];
    if(getDeviceSessionToken()!==sessionToken)throw new Error('EP device session changed during project HIL.');
    onProgress?.({phase:'project',index,total:projectNodes.length,projectNumber:node.projectNumber,path:node.fileName});
    try{
      const file=await getFile(node.nodeId);
      if(getDeviceSessionToken()!==sessionToken)throw new Error('EP device session changed while reading project '+String(node.projectNumber).padStart(2,'0')+'.');
      const audit=auditProjectArchiveBytes(file.data,{profile,occupiedSlots});
      projects.push({
        ok:audit.roundtripByteExact,
        projectNumber:node.projectNumber,
        path:node.fileName,
        nodeId:node.nodeId,
        deviceBytes:file.size,
        ...audit
      });
    }catch(error){
      if(getDeviceSessionToken()!==sessionToken)throw error;
      projects.push({
        ok:false,
        projectNumber:node.projectNumber,
        path:node.fileName,
        nodeId:node.nodeId,
        error:safeError(error)
      });
    }
  }

  const report={
    mode:'read-only',
    device:{
      sku:info.sku,
      identitySku:info.identitySku,
      baseSku:info.baseSku,
      firmware:String(info.metadata?.os_version||info.metadata?.sw_version||'')
    },
    profile:profile.id,
    warnings:[
      'Close every other EP Sample Tool / SysEx client while this audit runs; the device FILE subsystem is globally single-threaded.'
    ],
    occupiedSampleSlots:occupiedSlots.length,
    projects,
    allPassed:projects.length>0&&projects.every(project=>project.ok===true)
  };
  onProgress?.({phase:'done',report});
  return report;
}


const activeFromMetadata=metadata=>{
  const value=Number(metadata?.active);
  return Number.isInteger(value)&&value>0?value:null;
};
const firstNoopScratchSafe=audit=>!!audit&&audit.roundtripByteExact===true&&
  audit.pads.assigned===0&&audit.patterns.count===0&&!audit.scenes.present&&
  !audit.settingsPresent&&!audit.fxSettingsPresent&&!audit.livePresent&&
  audit.unknownMembers.length===0;

function triggerCheckpointDownload({projectNumber,profile,data}){
  if(typeof document==='undefined'||typeof URL==='undefined'||typeof Blob==='undefined')
    throw new Error('Project write HIL requires a browser so the pre-write checkpoint can be downloaded.');
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const name=(profile.id==='ep40'?'EP40':'EP133')+'-P'+String(projectNumber).padStart(2,'0')+'-checkpoint-'+stamp+'.tar';
  const blob=new Blob([data],{type:'application/x-tar'});
  const url=URL.createObjectURL(blob);
  try{
    const link=document.createElement('a');
    link.href=url;
    link.download=name;
    link.style.display='none';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }finally{
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return name;
}

const sameBytes=(a,b)=>bytesEqual(a,b);

export async function findProjectNoopHilCandidates({projectNumbers=null,onProgress}={}){
  const info=getConnectedDeviceInfo();
  if(!info)throw new Error('Connect an EP-133 or EP-40 before scanning no-op HIL candidates.');
  const profile=requireHilProfile(info);
  const requested=normalizedRequestedProjects(projectNumbers);
  const sessionToken=getDeviceSessionToken();
  if(!sessionToken)throw new Error('EP device session is not available.');

  await passiveFirmwareDebugPreflight(1200,'read-only no-op HIL candidate scan');
  if(getDeviceSessionToken()!==sessionToken)throw new Error('EP device session changed during candidate-scan preflight.');

  onProgress?.({phase:'list'});
  const files=await listDeviceFiles();
  if(getDeviceSessionToken()!==sessionToken)throw new Error('EP device session changed while listing HIL candidates.');

  const projectsNode=files.find(item=>item.fileName==='/projects'&&item.fileType==='folder');
  if(!projectsNode)throw new Error('EP /projects node is unavailable.');
  const activeProjectFid=activeFromMetadata(await getFileMetadata(projectsNode.nodeId,'active'));
  if(!activeProjectFid)throw new Error('EP active project FID could not be read; candidate scan aborted.');

  const occupiedSlots=files
    .filter(item=>item.fileType==='file'&&String(item.fileName).startsWith('/sounds/'))
    .map(item=>Number(item.nodeId))
    .filter(id=>Number.isInteger(id)&&id>=1&&id<=999);

  const projectNodes=files
    .filter(item=>item.fileType==='folder'&&projectNumberFromPath(item.fileName)!=null)
    .map(item=>({...item,projectNumber:projectNumberFromPath(item.fileName)}))
    .filter(item=>requested==null||requested.has(item.projectNumber))
    .sort((a,b)=>a.projectNumber-b.projectNumber);

  const candidates=[],rejected=[];
  for(let index=0;index<projectNodes.length;index++){
    const node=projectNodes[index];
    if(getDeviceSessionToken()!==sessionToken)throw new Error('EP device session changed during candidate scan.');
    onProgress?.({phase:'project',index,total:projectNodes.length,projectNumber:node.projectNumber,path:node.fileName});
    if(Number(node.nodeId)===activeProjectFid){
      rejected.push({projectNumber:node.projectNumber,path:node.fileName,nodeId:node.nodeId,reason:'active-project'});
      continue;
    }
    try{
      const file=await getFile(node.nodeId);
      const audit=auditProjectArchiveBytes(file.data,{profile,occupiedSlots});
      const entry={projectNumber:node.projectNumber,path:node.fileName,nodeId:node.nodeId,bytes:file.size,audit};
      if(firstNoopScratchSafe(audit))candidates.push(entry);
      else rejected.push({...entry,reason:'not-empty-or-not-byte-exact'});
    }catch(error){
      if(getDeviceSessionToken()!==sessionToken)throw error;
      rejected.push({projectNumber:node.projectNumber,path:node.fileName,nodeId:node.nodeId,reason:'read-or-audit-failed',error:safeError(error)});
    }
  }

  const report={
    mode:'read-only-noop-candidate-scan',
    device:{
      sku:info.sku,
      identitySku:info.identitySku,
      baseSku:info.baseSku,
      firmware:String(info.metadata?.os_version||info.metadata?.sw_version||'')
    },
    profile:profile.id,
    activeProjectFid,
    candidates,
    rejected,
    safeCandidateCount:candidates.length
  };
  onProgress?.({phase:'done',report});
  return report;
}

export async function runProjectNoopWriteHil({projectNumber,acknowledge,onProgress}={}){
  const number=Number(projectNumber);
  if(!Number.isInteger(number)||number<1||number>99)throw new Error('No-op write HIL project number must be 1..99.');
  const expectedAck='ERASE PROJECT '+number;
  if(String(acknowledge||'')!==expectedAck)
    throw new Error('No-op write HIL requires exact acknowledgement: '+JSON.stringify(expectedAck)+'.');

  const info=getConnectedDeviceInfo();
  if(!info)throw new Error('Connect an EP-133 or EP-40 before running project write HIL.');
  const profile=requireHilProfile(info);
  const sessionToken=getDeviceSessionToken();
  if(!sessionToken)throw new Error('EP device session is not available.');

  await passiveFirmwareDebugPreflight(1200,'no-op project write HIL');
  if(getDeviceSessionToken()!==sessionToken)throw new Error('EP device session changed during write-HIL preflight.');

  onProgress?.({phase:'list'});
  const files=await listDeviceFiles();
  if(getDeviceSessionToken()!==sessionToken)throw new Error('EP device session changed while listing files.');

  const projectsNode=files.find(item=>item.fileName==='/projects'&&item.fileType==='folder');
  if(!projectsNode)throw new Error('EP /projects node is unavailable.');
  const targetPath='/projects/'+String(number).padStart(2,'0');
  const target=files.find(item=>item.fileName===targetPath&&item.fileType==='folder');
  if(!target)throw new Error('Scratch project '+String(number).padStart(2,'0')+' is unavailable.');

  const beforeActive=activeFromMetadata(await getFileMetadata(projectsNode.nodeId,'active'));
  if(beforeActive===target.nodeId)
    throw new Error('Refusing no-op write HIL: project '+String(number).padStart(2,'0')+' is currently active.');

  const occupiedSlots=files
    .filter(item=>item.fileType==='file'&&String(item.fileName).startsWith('/sounds/'))
    .map(item=>Number(item.nodeId))
    .filter(id=>Number.isInteger(id)&&id>=1&&id<=999);

  onProgress?.({phase:'checkpoint',projectNumber:number,path:targetPath});
  const checkpoint=await getFile(target.nodeId);
  if(getDeviceSessionToken()!==sessionToken)throw new Error('EP device session changed while checkpointing project '+String(number).padStart(2,'0')+'.');
  const audit=auditProjectArchiveBytes(checkpoint.data,{profile,occupiedSlots});
  if(!audit.roundtripByteExact)throw new Error('Scratch project fails byte-exact no-op roundtrip; write HIL aborted.');
  if(!firstNoopScratchSafe(audit))
    throw new Error('Scratch project is not empty enough for the first no-op write HIL; choose an unused project slot.');

  const checkpointFile=triggerCheckpointDownload({projectNumber:number,profile,data:checkpoint.data});
  onProgress?.({phase:'checkpoint-downloaded',projectNumber:number,name:checkpointFile,bytes:checkpoint.size});

  const uploadFile={
    name:'P'+String(number).padStart(2,'0')+'.tar',
    async arrayBuffer(){
      const copy=checkpoint.data.slice();
      return copy.buffer.slice(copy.byteOffset,copy.byteOffset+copy.byteLength);
    }
  };

  await passiveFirmwareDebugPreflight(1200,'no-op project write HIL final preflight');
  if(getDeviceSessionToken()!==sessionToken)throw new Error('EP device session changed during final write-HIL preflight.');
  const finalActive=activeFromMetadata(await getFileMetadata(projectsNode.nodeId,'active'));
  if(finalActive!==beforeActive)throw new Error('Refusing no-op write HIL: active project changed after checkpoint.');
  if(finalActive===target.nodeId)throw new Error('Refusing no-op write HIL: scratch project became active before write.');

  let internalBackupMatched=false;
  onProgress?.({phase:'write',projectNumber:number,bytes:checkpoint.size});
  const upload=await uploadProjectArchive(uploadFile,{
    performReload:false,
    requireInactive:true,
    expectedActiveProjectFid:beforeActive,
    onBackup:backup=>{
      internalBackupMatched=sameBytes(checkpoint.data,backup.data);
      if(!internalBackupMatched)throw new Error('Upload transaction checkpoint changed between preflight and write.');
    }
  });
  if(upload.reload!==null)throw new Error('No-op write HIL unexpectedly performed project reload.');
  if(upload.activeProjectBeforeWrite!==beforeActive)throw new Error('No-op write HIL active-project guard did not match the final preflight.');

  if(getDeviceSessionToken()!==sessionToken)throw new Error('EP device session changed after no-op project write.');
  onProgress?.({phase:'readback',projectNumber:number});
  const readback=await downloadProjectArchive(targetPath);
  const readbackByteExact=sameBytes(checkpoint.data,readback.data);
  if(!readbackByteExact)throw new Error('No-op write HIL readback differs from the downloaded checkpoint.');

  const afterActive=activeFromMetadata(await getFileMetadata(projectsNode.nodeId,'active'));
  if(afterActive!==beforeActive)throw new Error('No-op write HIL changed the active project unexpectedly.');

  const result={
    mode:'write-noop',
    device:{
      sku:info.sku,
      identitySku:info.identitySku,
      firmware:String(info.metadata?.os_version||info.metadata?.sw_version||'')
    },
    profile:profile.id,
    projectNumber:number,
    path:targetPath,
    projectFid:target.nodeId,
    checkpointFile,
    checkpointBytes:checkpoint.size,
    scratchAudit:audit,
    memberVerification:upload.verification,
    readbackByteExact,
    reloadPerformed:false,
    activeProjectBefore:beforeActive,
    activeProjectAfter:afterActive,
    activeProjectUnchanged:afterActive===beforeActive,
    passed:readbackByteExact&&afterActive===beforeActive&&internalBackupMatched
  };
  onProgress?.({phase:'done',report:result});
  return result;
}

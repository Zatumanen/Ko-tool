import{getConnectedDeviceInfo,getDeviceSessionToken,passiveFirmwareDebugPreflight}from './device.js?v=20260929-11';
import{listDeviceFiles,getFile}from './filesystem.js?v=20260929-11';
import{getEpProjectProfile}from './projectProfile.js?v=20260929-11';
import{validateProjectArchive,preflightProjectSampleDependencies}from './projectArchive.js?v=20260929-11';
import{readProjectModel,buildProjectFromModel}from './projectReader.js?v=20260929-11';

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
    if(!Number.isInteger(number)||number<0||number>99)throw new Error('HIL project numbers must be 0..99.');
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

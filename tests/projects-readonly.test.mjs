import test from 'node:test';
import assert from 'node:assert/strict';
import{createProjectFilesystem}from '../js/ep133/projectFilesystem.js';
import{createMemoryProjectRecoveryStore}from '../js/ep133/projectRecovery.js';
import{summarizeProjectReadOnly}from '../js/ep133/ui/projectReadOnlyController.js';
import{validateProjectArchive,patchProjectArchiveMembers}from '../js/ep133/projectArchive.js';
import{getEpProjectProfile}from '../js/ep133/projectProfile.js';
import{getVerifiedProjectEditorAvailability}from '../js/ep133/ui/projectEditorController.js';
import{getProjectSequencerAvailability}from '../js/ep133/projectSequencerUi.js';

const writeTarText=(bytes,offset,length,text)=>{
  for(let i=0;i<length;i++)bytes[offset+i]=0;
  for(let i=0;i<text.length&&i<length;i++)bytes[offset+i]=text.charCodeAt(i);
};
const makeTarMember=(path,data=new Uint8Array(),type='0')=>{
  const payload=data instanceof Uint8Array?data:new Uint8Array(data);
  const header=new Uint8Array(512);
  writeTarText(header,0,100,path);
  writeTarText(header,100,8,type==='5'?'0000755\0':'0000644\0');
  if(payload.length)writeTarText(header,124,12,payload.length.toString(8)+'\0');
  header[156]=type.charCodeAt(0);
  header.fill(0x20,148,156);
  let checksum=0;for(const byte of header)checksum+=byte;
  const checksumText=checksum.toString(8)+'\0';
  writeTarText(header,148,8,checksumText);
  for(let i=148+checksumText.length;i<156;i++)header[i]=0x20;
  const padded=new Uint8Array(Math.ceil(payload.length/512)*512);padded.set(payload);
  return[header,padded];
};
const makeProjectTar=members=>{
  const chunks=[];let size=1024;
  for(const member of members){
    const pair=makeTarMember(member.path,member.data,member.type||'0');
    chunks.push(...pair);size+=pair[0].length+pair[1].length;
  }
  const out=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}
  return out;
};
const padRecord=slot=>{
  const pad=new Uint8Array(26);
  pad[1]=slot&255;pad[2]=(slot>>8)&255;
  pad[16]=100;pad[20]=255;pad[24]=60;
  return pad;
};
const pattern=()=>Uint8Array.from([0,2,1,0,0,0,0,60,100,24,0,0]);
const scenes=()=>{
  const data=new Uint8Array(712);
  data.set([0,0,0,0,0,4,4],0);
  for(let scene=0;scene<99;scene++){
    const offset=7+scene*6;data[offset+4]=4;data[offset+5]=4;
  }
  data.set([1,1,1,1],7);
  const trailer=7+99*6;data[trailer+3]=1;
  return data;
};
const settings=()=>{
  const data=new Uint8Array(222);
  new DataView(data.buffer).setFloat32(4,123.5,true);
  return data;
};
const fx=()=>{
  const data=new Uint8Array(144),view=new DataView(data.buffer);
  data[4]=2;view.setFloat32(16,.25,true);view.setFloat32(80,.75,true);
  return data;
};
const projectTar=makeProjectTar([
  {path:'pads/a/p01',data:padRecord(7)},
  {path:'pads/b/p01',data:padRecord(8)},
  {path:'patterns/a01',data:pattern()},
  {path:'patterns/b01',data:pattern()},
  {path:'patterns/c01',data:pattern()},
  {path:'patterns/d01',data:pattern()},
  {path:'scenes',data:scenes()},
  {path:'settings',data:settings()},
  {path:'fx_settings',data:fx()}
]);

const harness=(archive=projectTar)=>{
  const calls={put:0,set:0,get:0,list:[]};
  const filesystem=createProjectFilesystem({
    runFileOperation:operation=>operation(),
    withStrictFirmwareDebugGuard:operation=>operation(),
    getConnectedDeviceInfo:()=>({
      sku:'TE032AS001',
      metadata:{os_version:'2.5.1',serial:'READONLY-E2E'}
    }),
    markDeviceUnsafe(){},
    isDeviceUnsafe:()=>false,
    initRead:async()=>{},
    initFileSystem:async()=>{},
    listDirectory:async(nodeId,path)=>{
      calls.list.push([nodeId,path]);
      if(nodeId===0)return[{nodeId:2000,fileName:'/projects',fileType:'folder',fileSize:0}];
      if(nodeId===2000)return[
        {nodeId:3001,fileName:'/projects/01',fileType:'folder',fileSize:archive.byteLength},
        {nodeId:3002,fileName:'/projects/02',fileType:'folder',fileSize:2048}
      ];
      return[];
    },
    listDeviceFiles:async()=>[],
    getFile:async nodeId=>{
      calls.get++;
      if(nodeId!==3001)throw new Error('unexpected project FID');
      return{name:'P01.tar',size:archive.byteLength,data:archive.slice()};
    },
    putFile:async()=>{calls.put++;throw new Error('read-only test invoked PUT');},
    getFileMetadata:async nodeId=>nodeId===2000?{active:3001}:{},
    setFileMetadata:async()=>{calls.set++;throw new Error('read-only test invoked METADATA SET');},
    recoveryStore:createMemoryProjectRecoveryStore()
  });
  return{filesystem,calls};
};

test('read-only project list discovers project folders and active project without mutations',async()=>{
  const{filesystem,calls}=harness();
  const result=await filesystem.listProjectArchivesReadOnly();
  assert.equal(result.profile.id,'ep133');
  assert.equal(result.activeProjectFid,3001);
  assert.deepEqual(result.projects.map(project=>[project.project,project.active]),[
    ['01',true],['02',false]
  ]);
  assert.equal(calls.put,0);
  assert.equal(calls.set,0);
  assert.equal(calls.get,0);
});

test('read-only project reader parses the native archive without exposing a write path',async()=>{
  const{filesystem,calls}=harness();
  const result=await filesystem.readProjectArchiveReadOnly('01');
  assert.equal(result.project,'01');
  assert.equal(result.active,true);
  assert.equal(result.model.settings.bpm,123.5);
  assert.equal(result.model.patterns.length,4);
  assert.equal(result.model.scenes.entries.filter(scene=>scene.used).length,1);
  assert.equal(result.model.fxSettings.effectName,'reverb');
  assert.equal(calls.get,1);
  assert.equal(calls.put,0);
  assert.equal(calls.set,0);
});

test('project read-only summary reports BPM, scenes, patterns, pads, FX and used sample slots',async()=>{
  const{filesystem}=harness();
  const summary=summarizeProjectReadOnly(await filesystem.readProjectArchiveReadOnly('01'));
  assert.equal(summary.project,'01');
  assert.equal(summary.active,true);
  assert.equal(summary.bpm,123.5);
  assert.equal(summary.scenes.used,1);
  assert.equal(summary.scenes.current,1);
  assert.equal(summary.patterns.total,4);
  assert.equal(summary.patterns.used,4);
  assert.equal(summary.patterns.notes,4);
  assert.equal(summary.pads.assigned,2);
  assert.deepEqual(summary.pads.sampleSlots,[7,8]);
  assert.equal(summary.fx.name,'reverb');
  assert.equal(summary.fx.parameter1,.25);
  assert.equal(summary.fx.parameter2,.75);
});

test('missing B01 and C01 scene references load read-only, warn, and block editing',async()=>{
  const archive=makeProjectTar([
    {path:'pads/a/p01',data:padRecord(7)},
    {path:'patterns/a01',data:pattern()},
    {path:'patterns/d01',data:pattern()},
    {path:'scenes',data:scenes()},
    {path:'settings',data:settings()},
    {path:'fx_settings',data:fx()}
  ]);
  const profile=getEpProjectProfile('TE032AS001','2.5.1');
  assert.throws(()=>validateProjectArchive(archive,{profile}),error=>String(error.message).includes('references missing patterns/b01'));
  const {filesystem,calls}=harness(archive);
  const result=await filesystem.readProjectArchiveReadOnly('01');
  assert.deepEqual(result.model.missingPatternReferences,['patterns/b01','patterns/c01']);
  assert.deepEqual(summarizeProjectReadOnly(result).missingPatternReferences,['patterns/b01','patterns/c01']);
  const inactive={...result,active:false};
  assert.equal(getVerifiedProjectEditorAvailability(inactive).enabled,false);
  assert.match(getVerifiedProjectEditorAvailability(inactive).reason,/MISSING.*PATTERN/);
  assert.equal(getProjectSequencerAvailability(inactive).enabled,false);
  assert.equal(calls.get,1);
  assert.equal(calls.put,0);
  assert.equal(calls.set,0);
});

test('27-byte EP-133 projects load read-only with fractional pitch, but all project write paths remain blocked',async()=>{
  const pad=Uint8Array.from([...padRecord(7),50]);
  const archive=makeProjectTar([{path:'pads/a/p01',data:pad}]);
  const profile=getEpProjectProfile('TE032AS001','2.5.1');
  assert.deepEqual(profile.readablePadRecordSizes,[26,27]);
  assert.deepEqual(profile.acceptedPadRecordSizes,[26]);
  assert.equal(validateProjectArchive(archive,{profile,readOnly:true}).pads,1);
  assert.throws(()=>validateProjectArchive(archive,{profile}),/pad-record size 27/);
  assert.throws(()=>patchProjectArchiveMembers(archive,{}, {profile}),/pad-record size 27/);

  const {filesystem,calls}=harness(archive);
  const result=await filesystem.readProjectArchiveReadOnly('01');
  assert.equal(result.model.nativePadRecordsWritable,false);
  assert.equal(result.model.pads.a[0].sampleSlot,7);
  assert.equal(result.model.pads.a[0].pitchFraction,50);
  assert.equal(result.model.pads.a[0].pitchSemitones,0.5);
  assert.equal(getVerifiedProjectEditorAvailability(result).enabled,false);
  assert.match(getVerifiedProjectEditorAvailability(result).reason,/27-BYTE.*READ-ONLY/);
  assert.equal(getProjectSequencerAvailability(result).enabled,false);
  assert.equal(calls.put,0);
  assert.equal(calls.set,0);
});

test('empty 27-byte pad still reads as unassigned and cannot mutate a project',async()=>{
  const pad=Uint8Array.from([...padRecord(0),0]);
  const archive=makeProjectTar([{path:'pads/a/p01',data:pad}]);
  const {filesystem}=harness(archive);
  const result=await filesystem.readProjectArchiveReadOnly('01');
  assert.equal(result.model.pads.a[0].unassigned,true);
  assert.equal(result.model.pads.a[0].sampleSlot,null);
  assert.deepEqual(result.dependencies.referencedSampleSlots,[]);
  assert.equal(getProjectSequencerAvailability(result).enabled,false);
});

test('Projects UI controller source is mutation-free by construction',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/ui/projectReadOnlyController.js',import.meta.url),'utf8');
  assert.match(source,/listProjectArchivesReadOnly/);
  assert.match(source,/readProjectArchiveReadOnly/);
  assert.doesNotMatch(source,/putFile|setFileMetadata|deleteFile|moveFile|uploadProjectArchive|reloadProjectArchive|createProjectSequencer/);
});

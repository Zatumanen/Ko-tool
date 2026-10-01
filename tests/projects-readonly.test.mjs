import test from 'node:test';
import assert from 'node:assert/strict';
import{createProjectFilesystem}from '../js/ep133/projectFilesystem.js';
import{createMemoryProjectRecoveryStore}from '../js/ep133/projectRecovery.js';
import{summarizeProjectReadOnly}from '../js/ep133/ui/projectReadOnlyController.js';

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

const harness=()=>{
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
        {nodeId:3001,fileName:'/projects/01',fileType:'folder',fileSize:projectTar.byteLength},
        {nodeId:3002,fileName:'/projects/02',fileType:'folder',fileSize:2048}
      ];
      return[];
    },
    listDeviceFiles:async()=>[],
    getFile:async nodeId=>{
      calls.get++;
      if(nodeId!==3001)throw new Error('unexpected project FID');
      return{name:'P01.tar',size:projectTar.byteLength,data:projectTar.slice()};
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

test('Projects UI controller source is mutation-free by construction',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/ui/projectReadOnlyController.js',import.meta.url),'utf8');
  assert.match(source,/listProjectArchivesReadOnly/);
  assert.match(source,/readProjectArchiveReadOnly/);
  assert.doesNotMatch(source,/putFile|setFileMetadata|deleteFile|moveFile|uploadProjectArchive|reloadProjectArchive|createProjectSequencer/);
});

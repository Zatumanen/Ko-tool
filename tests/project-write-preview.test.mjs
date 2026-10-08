import test from'node:test';
import assert from'node:assert/strict';
import{createProjectFilesystem}from'../js/ep133/projectFilesystem.js';

const writeText=(bytes,offset,length,text)=>{
  bytes.fill(0,offset,offset+length);
  for(let index=0;index<text.length&&index<length;index++)bytes[offset+index]=text.charCodeAt(index);
};
const member=(path,payload)=>{
  const data=Uint8Array.from(payload);
  const header=new Uint8Array(512);
  writeText(header,0,100,path);
  writeText(header,100,8,'0000644\0');
  writeText(header,124,12,data.length.toString(8)+'\0');
  header[156]='0'.charCodeAt(0);header.fill(0x20,148,156);
  let sum=0;for(const byte of header)sum+=byte;
  const checksum=sum.toString(8)+'\0';writeText(header,148,8,checksum);
  for(let index=148+checksum.length;index<156;index++)header[index]=0x20;
  const padded=new Uint8Array(Math.ceil(data.length/512)*512);padded.set(data);
  return[header,padded];
};
const tar=bars=>{
  const chunks=[
    ...member('vendor_blob',[1,2,3]),
    ...member('patterns/a01',[0,bars,0,0])
  ];
  const out=new Uint8Array(chunks.reduce((sum,chunk)=>sum+chunk.length,1024));
  let offset=0;
  for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}
  return out;
};
const projectFile=data=>({
  name:'P02.tar',size:data.byteLength,type:'application/x-tar',
  async arrayBuffer(){return data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);}
});

const harness=()=>{
  let current=tar(1);
  let putCalls=0,checkpointSaves=0;
  const recoveryStore={
    async saveCheckpoint(){checkpointSaves++;},
    async updateCheckpoint(){return null;},
    async getCheckpoint(){return null;},
    async listCheckpoints(){return[];},
    async deleteCheckpoint(){}
  };
  const filesystem=createProjectFilesystem({
    runFileOperation:operation=>operation(),
    withStrictFirmwareDebugGuard:operation=>operation(),
    getConnectedDeviceInfo:()=>({sku:'TE032AS001',serial:'PREVIEW-DEVICE',metadata:{os_version:'2.5.1'}}),
    markDeviceUnsafe(){},isDeviceUnsafe:()=>false,
    async initRead(){},async initFileSystem(){},
    async listDirectory(nodeId){
      if(nodeId===0)return[
        {nodeId:1000,fileName:'/sounds',fileType:'folder'},
        {nodeId:2000,fileName:'/projects',fileType:'folder'}
      ];
      if(nodeId===1000)return[];
      if(nodeId===2000)return[
        {nodeId:3001,fileName:'/projects/01',fileType:'folder',fileSize:current.byteLength},
        {nodeId:3002,fileName:'/projects/02',fileType:'folder',fileSize:current.byteLength}
      ];
      return[];
    },
    async listDeviceFiles(){return[];},
    async getFile(nodeId){
      if(nodeId!==3002)throw new Error('unexpected getFile '+nodeId);
      return{name:'02',size:current.byteLength,data:current.slice()};
    },
    async putFile(){putCalls++;},
    async getFileMetadata(nodeId){return nodeId===2000?{active:3001}:{active:null};},
    async setFileMetadata(){},
    recoveryStore
  });
  return{
    filesystem,
    setCurrent:data=>{current=data.slice();},
    stats:()=>({putCalls,checkpointSaves})
  };
};

test('project write preview reads the live destination and creates no checkpoint or FILE mutation',async()=>{
  const h=harness();
  const candidate=tar(2);
  const preview=await h.filesystem.previewProjectArchiveWrite(projectFile(candidate),{requireInactive:true});
  assert.equal(preview.project,'02');
  assert.equal(preview.activeProjectBeforeWrite,3001);
  assert.equal(preview.diff.members.changed,1);
  assert.equal(preview.diff.changedMembers[0].path,'patterns/a01');
  assert.equal(preview.diff.changedMembers[0].kind,'pattern');
  assert.equal(preview.diff.unknown.touched,0);
  assert.equal(preview.diff.unknown.preserved,1);
  assert.match(preview.original.crc32,/^[0-9a-f]{8}$/i);
  assert.match(preview.candidate.crc32,/^[0-9a-f]{8}$/i);
  assert.deepEqual(h.stats(),{putCalls:0,checkpointSaves:0});
});

test('project write refuses stale diff previews before checkpoint creation or FILE PUT',async()=>{
  const h=harness();
  const candidate=tar(2);
  const preview=await h.filesystem.previewProjectArchiveWrite(projectFile(candidate),{requireInactive:true});
  h.setCurrent(tar(3));
  await assert.rejects(()=>h.filesystem.uploadProjectArchive(projectFile(candidate),{
    requireInactive:true,performReload:false,
    expectedOriginalCrc32:preview.original.crc32,
    expectedCandidateCrc32:preview.candidate.crc32
  }),/project changed on device after diff preview/i);
  assert.deepEqual(h.stats(),{putCalls:0,checkpointSaves:0});
});

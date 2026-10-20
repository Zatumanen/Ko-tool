import test from 'node:test';
import assert from 'node:assert/strict';
import{
  buildSampleDependencyIndex,getSampleDependencyBlockers,assertSampleSlotsUnreferenced
}from '../js/ep133/projectDependencies.js';
import{readSampleDependencyRequest,readProjectPadDependencies,createSampleDependencyGuard}from '../js/ep133/sampleDependencyGuard.js';
import{getEpProjectProfile}from '../js/ep133/projectProfile.js';
import{readProjectModel}from '../js/ep133/projectReader.js';

const model=pads=>({pads:{a:[],b:[],c:[],d:[],...pads}});

test('reverse sample dependency index maps slots to exact projects groups and pads',()=>{
  const index=buildSampleDependencyIndex([
    {project:'1',nodeId:201,active:true,model:model({a:[{sampleSlot:7,pad:1,path:'pads/a/p01'},{sampleSlot:8,pad:2,path:'pads/a/p02'}],b:[{sampleSlot:7,pad:4,path:'pads/b/p04'}]})},
    {project:'12',nodeId:212,active:false,model:model({c:[{sampleSlot:7,pad:3,path:'pads/c/p03'}],d:[{sampleSlot:null,pad:1,path:'pads/d/p01'}]})}
  ]);
  assert.equal(index.projectsScanned,2);
  assert.equal(index.sampleCount,2);
  assert.equal(index.referenceCount,4);
  assert.deepEqual(index.slots,[7,8]);
  const slot7=index.entries.find(entry=>entry.slot===7);
  assert.equal(slot7.referenceCount,3);
  assert.equal(slot7.projectCount,2);
  assert.deepEqual(slot7.projects,['01','12']);
  assert.deepEqual(slot7.references.map(ref=>[ref.project,ref.group,ref.pad,ref.path]),[
    ['01','a',1,'pads/a/p01'],['01','b',4,'pads/b/p04'],['12','c',3,'pads/c/p03']
  ]);
});

test('dependency blocker lookup filters requested slots and mutation assertion fails closed',()=>{
  const index=buildSampleDependencyIndex([
    {project:'03',nodeId:203,model:model({a:[{sampleSlot:7,pad:1,path:'pads/a/p01'}]})},
    {project:'12',nodeId:212,model:model({c:[{sampleSlot:7,pad:4,path:'pads/c/p04'}],d:[{sampleSlot:9,pad:2,path:'pads/d/p02'}]})}
  ]);
  assert.deepEqual(getSampleDependencyBlockers(index,[8]),[]);
  assert.equal(getSampleDependencyBlockers(index,[7,8]).length,1);
  assert.equal(assertSampleSlotsUnreferenced(index,[8],{operation:'delete'}),index);
  assert.throws(()=>assertSampleSlotsUnreferenced(index,[7,9],{operation:'delete'}),/slot 007 is used by P03 A01, P12 C04; slot 009 is used by P12 D02\. DELETE would break project pad references/i);
});

test('dependency request metadata normalizes the complete source slot set without changing FILE transaction options',()=>{
  const operation=()=>{};
  Object.defineProperty(operation,'sampleDependencyGuard',{value:{slots:[9,7,9],operation:'delete'}});
  assert.deepEqual(readSampleDependencyRequest(operation),{slots:[7,9],operation:'delete'});
  assert.equal(readSampleDependencyRequest(()=>{}),null);
});

test('sample delete tags the complete target set before entering the unchanged strict FILE lease API',async()=>{
  const fs=await import('node:fs/promises');
  const [filesystem,guard,del,move]=await Promise.all([
    fs.readFile(new URL('../js/ep133/filesystem.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../js/ep133/sampleDependencyGuard.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../js/ep133/ui/sampleDeleteController.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../js/ep133/ui/sampleMoveController.js',import.meta.url),'utf8')
  ]);
  assert.match(filesystem,/export function withFileTransaction\(label,operation,\{strict=false\}=\{\}\)/);
  assert.match(filesystem,/sampleDependencyGuard\.assertOperationSafe\(fileOps,operation\)/);
  assert.match(guard,/const index=await buildIndex\(fileOps\)/);
  assert.match(guard,/assertSampleSlotsUnreferenced\(index,request\.slots/);
  assert.match(del,/tagDependencyGuard\(operation,canonicalTargets\.map\(slot=>slot\.id\),'delete',async blockers=>/);
  assert.match(del,/withFileTransaction\('sample delete transaction',operation,\{strict:true\}\)/);
  assert.match(move,/Object\.defineProperty\(operation,'sampleDependencyGuard'/);
  assert.match(move,/withFileTransaction\('sample move transaction',operation,\{strict:true\}\)/);
});

const sampleTar=(members)=>{
  const blocks=[];
  const write=(bytes,start,len,value)=>{
    bytes.fill(0,start,start+len);
    for(let i=0;i<value.length&&i<len;i++)bytes[start+i]=value.charCodeAt(i);
  };
  for(const {path,data=new Uint8Array()} of members){
    const payload=data instanceof Uint8Array?data:Uint8Array.from(data);
    const header=new Uint8Array(512);
    write(header,0,100,path);
    write(header,100,8,'0000644\0');
    if(payload.length)write(header,124,12,payload.length.toString(8)+'\0');
    header[156]=48;header.fill(0x20,148,156);
    let sum=0;for(const byte of header)sum+=byte;
    const octal=sum.toString(8)+'\0';
    write(header,148,8,octal);
    header.fill(0x20,148+octal.length,156);
    blocks.push(header);
    const aligned=new Uint8Array(Math.ceil(payload.length/512)*512);
    aligned.set(payload);
    blocks.push(aligned);
  }
  const size=blocks.reduce((n,b)=>n+b.length,1024);
  const bytes=new Uint8Array(size);let offset=0;
  for(const block of blocks){bytes.set(block,offset);offset+=block.length;}
  return bytes;
};
const padData=(slot,length=26)=>{
  const data=new Uint8Array(length);
  data[1]=slot&255;data[2]=slot>>8;
  data[16]=100;data[20]=255;data[24]=60;
  return data;
};
const sceneWithMissingPattern=()=>{
  const data=new Uint8Array(712);
  for(let i=0;i<99;i++){data[7+i*6+4]=4;data[7+i*6+5]=4;}
  data.set([1,1,1,1],7);
  data[7+99*6+3]=1;
  return data;
};
const ep133Profile=getEpProjectProfile('TE032AS001','2.5.1');

test('delete dependency scan tolerates missing scene pattern while still blocking referenced pads',()=>{
  const archive=sampleTar([
    {path:'pads/a/p01',data:padData(7)},
    {path:'pads/b/p02',data:padData(9)},
    {path:'scenes',data:sceneWithMissingPattern()}
  ]);
  assert.deepEqual(readProjectModel(archive,{profile:ep133Profile}).missingPatternReferences,
    ['patterns/a01','patterns/b01','patterns/c01','patterns/d01']);
  const model=readProjectPadDependencies(archive,{profile:ep133Profile});
  const index=buildSampleDependencyIndex([{project:'02',nodeId:3002,model}]);
  assert.deepEqual(index.slots,[7,9]);
  assert.equal(assertSampleSlotsUnreferenced(index,[10],{operation:'delete'}),index);
  assert.throws(()=>assertSampleSlotsUnreferenced(index,[9],{operation:'delete'}),/slot 009 is used by P02 B02/);
});

test('dependency guard scans every project and never deletes slots used by implicit-pattern projects',async()=>{
  const badScene=sampleTar([{path:'pads/d/p04',data:padData(15)},{path:'scenes',data:sceneWithMissingPattern()}]);
  const goodScene=sampleTar([{path:'pads/a/p01',data:padData(7)}]);
  const guard=createSampleDependencyGuard({
    getConnectedDeviceInfo:()=>({sku:'TE032AS001',metadata:{os_version:'2.5.1'}})
  });
  const fileOps={
    listDirectory:async node=>node===0
      ?[{nodeId:2000,fileName:'/projects',fileType:'folder'}]
      :[{nodeId:3001,fileName:'/projects/01',fileType:'folder'},
        {nodeId:3002,fileName:'/projects/02',fileType:'folder'}],
    getFile:async node=>({data:node===3001?goodScene:badScene})
  };
  const safe=()=>{};Object.defineProperty(safe,'sampleDependencyGuard',{value:{slots:[30],operation:'delete'}});
  const index=await guard.assertOperationSafe(fileOps,safe);
  assert.equal(index.projectsScanned,2);
  assert.deepEqual(index.slots,[7,15]);
  const used=()=>{};Object.defineProperty(used,'sampleDependencyGuard',{value:{slots:[15],operation:'delete'}});
  await assert.rejects(guard.assertOperationSafe(fileOps,used),/slot 015 is used by P02 D04/);
});

test('sample dependency override requires explicit confirmation only for delete',async()=>{
  const archive=sampleTar([{path:'pads/a/p01',data:padData(7)}]);
  const guard=createSampleDependencyGuard({
    getConnectedDeviceInfo:()=>({sku:'TE032AS001',metadata:{os_version:'2.5.1'}})
  });
  const fileOps={
    listDirectory:async node=>node===0
      ?[{nodeId:2000,fileName:'/projects',fileType:'folder'}]
      :[{nodeId:3001,fileName:'/projects/01',fileType:'folder'}],
    getFile:async()=>({data:archive})
  };
  const makeOperation=(operation,confirmReferencedDelete)=>{
    const task=()=>{};
    Object.defineProperty(task,'sampleDependencyGuard',{
      value:{slots:[7],operation,confirmReferencedDelete}
    });
    return task;
  };
  let warned=null;
  const declined=await guard.assertOperationSafe(fileOps,makeOperation('delete',blockers=>{
    warned=blockers;return false;
  }));
  assert.equal(declined,false);
  assert.equal(warned[0].slot,7);
  assert.deepEqual(warned[0].references.map(r=>[r.project,r.group,r.pad]),[['01','a',1]]);
  const accepted=await guard.assertOperationSafe(fileOps,makeOperation('delete',async()=>true));
  assert.equal(accepted.projectsScanned,1);
  assert.deepEqual(accepted.slots,[7]);
  await assert.rejects(
    guard.assertOperationSafe(fileOps,makeOperation('move',async()=>true)),
    /slot 007 is used by P01 A01/
  );
  await assert.rejects(
    guard.assertOperationSafe(fileOps,makeOperation('delete',null)),
    /slot 007 is used by P01 A01/
  );
});

test('read-only EP-133 dependency scan accepts 26/27-byte pads without bypassing project references',async()=>{
  const native=sampleTar([{path:'pads/a/p01',data:padData(7,26)}]);
  const variantPad=padData(9,27);variantPad[26]=50;
  const variant=sampleTar([
    {path:'pads/b/p02',data:variantPad},
    {path:'pads/c/p03',data:padData(0,27)}
  ]);
  const guard=createSampleDependencyGuard({
    getConnectedDeviceInfo:()=>({sku:'TE032AS001',metadata:{os_version:'2.5.1'}})
  });
  const fileOps={
    listDirectory:async node=>node===0
      ?[{nodeId:2000,fileName:'/projects',fileType:'folder'}]
      :[{nodeId:3001,fileName:'/projects/01',fileType:'folder'},
        {nodeId:3002,fileName:'/projects/02',fileType:'folder'}],
    getFile:async node=>({data:node===3001?native:variant})
  };
  const operation=(slots,kind='delete')=>{
    const task=()=>{};
    Object.defineProperty(task,'sampleDependencyGuard',{value:{slots,operation:kind}});
    return task;
  };
  const index=await guard.assertOperationSafe(fileOps,operation([10]));
  assert.equal(index.projectsScanned,2);
  assert.deepEqual(index.slots,[7,9]);
  await assert.rejects(guard.assertOperationSafe(fileOps,operation([9])),
    /slot 009 is used by P02 B02/);
  await assert.rejects(guard.assertOperationSafe(fileOps,operation([7])),
    /slot 007 is used by P01 A01/);
  assert.equal(readProjectPadDependencies(variant,{profile:ep133Profile}).pads.c[0].sampleSlot,null);
});

test('dependency preflight fails closed on corrupt or ambiguous pad records',()=>{
  const parse=members=>readProjectPadDependencies(sampleTar(members),{profile:ep133Profile});
  assert.throws(()=>parse([{path:'pads/a/p01',data:new Uint8Array([0,7,0])}]),/unsupported pad-record size 3/);
  assert.throws(()=>parse([{path:'pads/a/p01',data:padData(7,28)}]),/unsupported pad-record size 28/);
  const badValidity=padData(7,27);badValidity[0]=1;
  assert.throws(()=>parse([{path:'pads/a/p01',data:badValidity}]),/nonzero validity byte/);
  assert.throws(()=>parse([
    {path:'pads/a/p01',data:padData(7)},
    {path:'pads/a/p01',data:padData(10)}
  ]),/Duplicate project pad member/);
  assert.throws(()=>parse([{path:'pads/a/custom',data:padData(7)}]),/Unexpected project pad member/);
  assert.throws(()=>parse([{path:'pads/a/p01',data:padData(1200)}]),/outside 0\.\.999/);
  const corrupted=sampleTar([{path:'pads/a/p01',data:padData(7)}]);
  corrupted[148]=0;
  assert.throws(()=>readProjectPadDependencies(corrupted,{profile:ep133Profile}),/checksum mismatch/i);
});

test('Riddim EP-40 dependency reader handles native 29-byte pads and excludes supertones',()=>{
  const profile=getEpProjectProfile('TE032AS006','2.5.1');
  const archive=sampleTar([
    {path:'pads/c/p03',data:padData(42,29)},
    {path:'pads/d/p02',data:padData(1000,29)}
  ]);
  const index=buildSampleDependencyIndex([
    {project:'01',nodeId:3001,model:readProjectPadDependencies(archive,{profile})}
  ]);
  assert.deepEqual(index.slots,[42]);
  assert.throws(()=>readProjectPadDependencies(sampleTar([
    {path:'pads/a/p01',data:padData(1009+1,29)}
  ]),{profile}),/outside 0\.\.1009/);
});

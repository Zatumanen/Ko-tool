import test from 'node:test';
import assert from 'node:assert/strict';
import{getEpProjectProfile}from '../js/ep133/projectProfile.js';
import{readProjectModel}from '../js/ep133/projectReader.js';
import{
  SEQUENCER_GRID_TICKS,SEQUENCER_GRID_STEPS,
  getProjectSequencerAvailability,createProjectSequencerSession,summarizeSequencerPattern
}from '../js/ep133/projectSequencerUi.js';

const writeText=(target,offset,length,text)=>{
  target.fill(0,offset,offset+length);
  for(let index=0;index<text.length&&index<length;index++)target[offset+index]=text.charCodeAt(index);
};
const member=(path,data)=>{
  const payload=data instanceof Uint8Array?data:new Uint8Array(data||[]);
  const header=new Uint8Array(512);
  writeText(header,0,100,path);writeText(header,100,8,'0000644\0');
  writeText(header,124,12,payload.length.toString(8)+'\0');
  header[156]='0'.charCodeAt(0);header.fill(0x20,148,156);
  let sum=0;for(const byte of header)sum+=byte;
  const checksum=sum.toString(8)+'\0';writeText(header,148,8,checksum);
  for(let index=148+checksum.length;index<156;index++)header[index]=0x20;
  const padded=new Uint8Array(Math.ceil(payload.length/512)*512);padded.set(payload);
  return[header,padded];
};
const tar=members=>{
  const chunks=[];let size=1024;
  for(const item of members){
    const parts=member(item.path,item.data);chunks.push(...parts);size+=parts[0].length+parts[1].length;
  }
  const out=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}
  return out;
};
const pattern=(records=[])=>{
  const out=new Uint8Array(4+records.length*8);
  out.set([0,1,records.length,0],0);
  records.forEach((record,index)=>out.set(record,4+index*8));
  return out;
};
const note=(tick,pad=1,pitch=60,velocity=100,duration=24,flag=0)=>Uint8Array.from([
  tick&255,(tick>>8)&255,(pad-1)*8,pitch,velocity,duration&255,(duration>>8)&255,flag
]);
const unknown=(tick=0)=>Uint8Array.from([tick&255,(tick>>8)&255,3,9,8,7,6,5]);
const scenes=()=>{
  const data=new Uint8Array(712);data.set([0,0,0,0,0,4,4],0);
  for(let scene=0;scene<99;scene++){const offset=7+scene*6;data[offset+4]=4;data[offset+5]=4;}
  data.set([1,1,1,1],7);data[7+99*6+3]=1;return data;
};
const settings=()=>{
  const data=new Uint8Array(222),view=new DataView(data.buffer);
  view.setFloat32(4,120,true);
  for(let offset=24;offset<216;offset+=4)view.setFloat32(offset,-1,true);
  return data;
};
const source=tar([
  {path:'patterns/a01',data:pattern([note(24,1,60,100,24,17)])},
  {path:'patterns/b01',data:pattern([note(0,1)])},
  {path:'patterns/c01',data:pattern([note(0,1)])},
  {path:'patterns/d01',data:pattern([note(0,1)])},
  {path:'scenes',data:scenes()},
  {path:'settings',data:settings()},
  {path:'vendor_future',data:Uint8Array.from([5,4,3,2,1])}
]);
const profile=getEpProjectProfile('TE032AS001','2.5.1');
const result=()=>({
  project:'02',active:false,
  dependencies:{referencedSampleSlots:[],missingSampleSlots:[],allSamplesAvailable:true},
  model:readProjectModel(source,{profile})
});

test('sequencer UI uses explicit 24-tick / 16-step pages without rewriting native records',()=>{
  assert.equal(SEQUENCER_GRID_TICKS,24);
  assert.equal(SEQUENCER_GRID_STEPS,16);
  const session=createProjectSequencerSession(result());
  const before=session.getPattern('A01');
  assert.equal(before.records[0].tick,24);
  assert.equal(before.records[0].flag,17);

  const added=session.toggleGridNote('A01',{page:0,step:2,pad:2,note:62,velocity:91,duration:12});
  assert.equal(added.action,'added');
  assert.equal(added.tick,48);
  let built=session.build();
  assert.equal(built.changed,true);
  let decoded=built.model.patterns.find(item=>item.id==='A01');
  const newNote=decoded.notes.find(item=>item.tick===48&&item.pad===2);
  assert.ok(newNote);
  assert.equal(newNote.note,62);
  assert.equal(newNote.velocity,91);
  assert.equal(newNote.duration,12);
  assert.equal(decoded.notes.find(item=>item.tick===24&&item.pad===1).flag,17);

  const removed=session.toggleGridNote('A01',{page:0,step:2,pad:2});
  assert.equal(removed.action,'removed');
  built=session.build();
  decoded=built.model.patterns.find(item=>item.id==='A01');
  assert.equal(decoded.notes.some(item=>item.tick===48&&item.pad===2),false);
  assert.equal(decoded.notes.find(item=>item.tick===24).flag,17);
});

test('sequencer UI preserves unknown records and allows value-only edits while blocking structural edits',()=>{
  const unsafeTar=tar([
    {path:'patterns/a01',data:pattern([unknown(),note(24,1,60,100,24,31)])}
  ]);
  const unsafeResult={
    project:'02',active:false,
    dependencies:{allSamplesAvailable:true},
    model:readProjectModel(unsafeTar,{profile})
  };
  const session=createProjectSequencerSession(unsafeResult);
  assert.deepEqual(session.getPatternSafety('A01'),{
    unknownRecords:1,structuralEditsAllowed:false,valueEditsAllowed:true
  });
  const noteRecord=session.getPattern('A01').records.find(record=>record.kind==='note');
  session.editNote('A01',noteRecord.id,{velocity:77});
  assert.throws(
    ()=>session.toggleGridNote('A01',{page:0,step:2,pad:2}),
    /unknown native records/i
  );
  assert.throws(
    ()=>session.editNote('A01',noteRecord.id,{tick:48}),
    /unknown native records/i
  );
  const decoded=session.build().model.patterns[0];
  assert.equal(decoded.notes[0].velocity,77);
  assert.deepEqual([...decoded.unknownRecords[0].raw],[0,0,3,9,8,7,6,5]);
});

test('sequencer UI can create patterns, stage scene/song edits and preserve unrelated TAR members',()=>{
  const session=createProjectSequencerSession(result());
  session.createPattern('A02',{bars:2});
  session.addNote('A02',{tick:0,pad:3,note:64,velocity:105,duration:24});
  session.setScene(2,{groupPatterns:[2,1,1,1],timeSignature:[4,4]});
  session.setCurrentScene(2);
  session.setSong([1,2]);

  const built=session.build();
  assert.equal(built.changed,true);
  const a02=built.model.patterns.find(item=>item.id==='A02');
  assert.ok(a02);
  assert.equal(a02.bars,2);
  assert.equal(a02.notes[0].pad,3);
  assert.equal(built.model.scenes.currentScene,2);
  assert.deepEqual(built.model.scenes.song,[1,2]);
  const scene2=built.model.scenes.entries.find(item=>item.index===2);
  assert.deepEqual(scene2.groupPatterns,{a:2,b:1,c:1,d:1});
  assert.deepEqual([...built.model.unknownMembers[0].data],[5,4,3,2,1]);
});

test('sequencer availability is fail-closed for active, missing-dependency and unverified projects',()=>{
  assert.deepEqual(getProjectSequencerAvailability({...result(),active:true}),{
    enabled:false,reason:'ACTIVE PROJECT CANNOT BE SEQUENCED'
  });
  assert.deepEqual(getProjectSequencerAvailability({
    ...result(),dependencies:{allSamplesAvailable:false}
  }),{
    enabled:false,reason:'PROJECT HAS MISSING SAMPLE DEPENDENCIES'
  });
  const futureProfile=getEpProjectProfile('TE032AS001','9.9.9');
  assert.equal(getProjectSequencerAvailability({
    project:'02',active:false,dependencies:{allSamplesAvailable:true},model:{profile:futureProfile}
  }).enabled,false);
});

test('sequencer pattern summary reports notes, automation, unknown records and raw tick pages',()=>{
  const session=createProjectSequencerSession(result());
  session.addAutomation('A01',{tick:400,parameter:5,value:1234});
  const summary=summarizeSequencerPattern(session.getPattern('A01'));
  assert.equal(summary.notes,1);
  assert.equal(summary.automation,1);
  assert.equal(summary.unknown,0);
  assert.equal(summary.maxTick,400);
  assert.equal(summary.pages,2);
});


test('Sequencer UI writes only through checkpointed project upload and does not import FILE mutation primitives',async()=>{
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../js/ep133/ui/projectSequencerController.js',import.meta.url),'utf8');
  assert.match(source,/uploadProjectArchive/);
  assert.match(source,/requireInactive:true/);
  assert.match(source,/performReload:false/);
  assert.match(source,/createProjectSequencerSession/);
  assert.doesNotMatch(source,/putFile|setFileMetadata|deleteFile|moveFile|uploadSampleToSlot/);
});

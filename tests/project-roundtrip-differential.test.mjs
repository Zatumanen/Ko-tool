import test from 'node:test';
import assert from 'node:assert/strict';

import{getEpProjectProfile}from '../js/ep133/projectProfile.js';
import{parseProjectArchive}from '../js/ep133/projectArchive.js';
import{readProjectModel,buildProjectFromModel}from '../js/ep133/projectReader.js';
import{buildProjectWriteDiff}from '../js/ep133/projectWriteDiff.js';
import{createVerifiedProjectEditorDraft,buildVerifiedProjectEditorCandidate}from '../js/ep133/projectEditor.js';
import{createProjectSequencer}from '../js/ep133/projectSequencer.js';

const writeTarText=(bytes,offset,length,text)=>{
  for(let index=0;index<length;index++)bytes[offset+index]=0;
  for(let index=0;index<text.length&&index<length;index++)bytes[offset+index]=text.charCodeAt(index);
};
const makeTarMember=(path,data=new Uint8Array(),type='0')=>{
  const payload=data instanceof Uint8Array?data:new Uint8Array(data||[]);
  const header=new Uint8Array(512);
  writeTarText(header,0,100,path);
  writeTarText(header,100,8,type==='5'?'0000755\0':'0000644\0');
  writeTarText(header,108,8,'0000042\0');
  writeTarText(header,116,8,'0000043\0');
  if(payload.length)writeTarText(header,124,12,payload.length.toString(8)+'\0');
  writeTarText(header,136,12,'1234567\0');
  header[156]=type.charCodeAt(0);
  writeTarText(header,257,6,'ustar\0');
  writeTarText(header,265,8,'ko-tool');
  header.fill(0x20,148,156);
  let checksum=0;
  for(const byte of header)checksum+=byte;
  const checksumText=checksum.toString(8)+'\0';
  writeTarText(header,148,8,checksumText);
  for(let index=148+checksumText.length;index<156;index++)header[index]=0x20;
  const padded=new Uint8Array(Math.ceil(payload.length/512)*512);
  padded.set(payload);
  return[header,padded];
};
const makeProjectTar=members=>{
  const chunks=[];
  let size=1024;
  for(const member of members){
    const pair=makeTarMember(member.path,member.data,member.type||'0');
    chunks.push(...pair);
    size+=pair[0].length+pair[1].length;
  }
  const out=new Uint8Array(size);
  let offset=0;
  for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}
  return out;
};
const validPadRecord=()=>{
  const pad=new Uint8Array(26);
  pad[1]=1;
  pad[16]=100;
  pad[20]=255;
  pad[24]=60;
  pad[25]=0xa5;
  return pad;
};
const validEp40PadRecord=()=>{
  const pad=new Uint8Array(29);
  pad[1]=1;
  pad[16]=100;
  pad[20]=255;
  pad[24]=60;
  pad[25]=0x5a;
  return pad;
};
const notePattern=()=>Uint8Array.from([0,1,1,0x7f,24,0,0,60,100,24,0,31]);
const unknownAndNotePattern=()=>Uint8Array.from([
  0,1,2,0x7f,
  0,0,3,9,8,7,6,5,
  24,0,0,60,100,24,0,31
]);
const ep40NotePattern=()=>Uint8Array.from([
  1,1,0xff,0xff,1,0,
  24,0,0,60,127,24,0,6
]);
const scenesWithPatternOne=()=>{
  const scenes=new Uint8Array(712);
  scenes.set([0,0,0,0,0,4,4],0);
  for(let scene=0;scene<99;scene++){
    const offset=7+scene*6;
    scenes[offset+4]=4;
    scenes[offset+5]=4;
  }
  scenes.set([1,1,1,1,4,4],7);
  const trailer=7+99*6;
  scenes[trailer+3]=1;
  scenes[trailer+11]=1;
  scenes[trailer+12]=1;
  return scenes;
};
const settingsMember=()=>{
  const settings=new Uint8Array(224);
  settings.set([9,8,7,6],0);
  settings.set([0xde,0xad,0xbe,0xef,1,2,3,4,5,6,7,8,9,10,11,12],8);
  const view=new DataView(settings.buffer);
  view.setFloat32(4,120,true);
  for(let offset=24;offset<216;offset+=4)view.setFloat32(offset,-1,true);
  settings.set([3,4,1,5],216);
  settings.set([0x91,0x82,0x73,0x64],220);
  return settings;
};
const fxMember=()=>{
  const fx=new Uint8Array(160);
  const view=new DataView(fx.buffer);
  fx[4]=2;
  fx.set([1,2,3,4],8);
  view.setFloat32(16,0.25,true);
  view.setFloat32(80,0.75,true);
  view.setFloat32(136,0.5,true);
  view.setFloat32(140,1,true);
  view.setFloat32(144,0.4,true);
  view.setFloat32(148,0.6,true);
  view.setUint16(152,0x8801,true);
  return fx;
};
const memberMap=archive=>new Map(parseProjectArchive(archive).map(member=>[member.path,member]));
const changedIndexes=(before,after)=>{
  const limit=Math.max(before.length,after.length),changed=[];
  for(let index=0;index<limit;index++)if(before[index]!==after[index])changed.push(index);
  return changed;
};
const assertUnchangedMembersByteExact=(beforeArchive,afterArchive,changedPaths)=>{
  const before=memberMap(beforeArchive),after=memberMap(afterArchive);
  assert.deepEqual([...after.keys()],[...before.keys()]);
  for(const[path,beforeMember]of before){
    const afterMember=after.get(path);
    assert.ok(afterMember,'missing member '+path);
    if(changedPaths.has(path))continue;
    assert.deepEqual([...afterMember.header],[...beforeMember.header],path+' TAR header changed unexpectedly');
    assert.deepEqual([...afterMember.data],[...beforeMember.data],path+' payload changed unexpectedly');
  }
};
const assertChangedMemberSet=(beforeArchive,afterArchive,expectedPaths)=>{
  const diff=buildProjectWriteDiff(beforeArchive,afterArchive);
  assert.deepEqual(
    diff.changedMembers.map(entry=>entry.path).sort(),
    [...expectedPaths].sort()
  );
  assert.equal(diff.unknown.touched,0);
  assertUnchangedMembersByteExact(beforeArchive,afterArchive,new Set(expectedPaths));
  return diff;
};
const makeEp133Archive=()=>makeProjectTar([
  {path:'pads',type:'5'},
  {path:'pads/a',type:'5'},
  {path:'pads/a/p01',data:validPadRecord()},
  {path:'patterns',type:'5'},
  {path:'patterns/a01',data:unknownAndNotePattern()},
  {path:'patterns/b01',data:notePattern()},
  {path:'patterns/c01',data:notePattern()},
  {path:'patterns/d01',data:notePattern()},
  {path:'scenes',data:scenesWithPatternOne()},
  {path:'settings',data:settingsMember()},
  {path:'fx_settings',data:fxMember()},
  {path:'vendor_future',data:Uint8Array.from([4,3,2,1,0xfe,0xed])}
]);
const makeEp40Archive=()=>{
  const pad=validEp40PadRecord();
  new DataView(pad.buffer).setUint16(1,1002,true);
  pad[23]=3;
  pad[26]=50;
  pad[27]=123;
  pad[28]=45;
  const live=new Uint8Array(48);
  live[0]=1;live[11]=1;live[13]=1;live[47]=1;
  return makeProjectTar([
    {path:'pads/a/p01',data:pad},
    {path:'patterns/a01',data:ep40NotePattern()},
    {path:'live',data:live},
    {path:'fx_settings',data:fxMember()},
    {path:'vendor_ep40_future',data:Uint8Array.from([0xca,0xfe,0xba,0xbe])}
  ]);
};

test('EP-133 rich native project read/build roundtrip is byte-exact including unknown members and TAR headers',()=>{
  const profile=getEpProjectProfile('TE032AS001','2.5.1');
  const source=makeEp133Archive();
  const model=readProjectModel(source,{profile});
  const rebuilt=buildProjectFromModel(model);
  assert.deepEqual([...rebuilt],[...source]);
  assert.deepEqual(model.unknownMembers.map(member=>member.path),['vendor_future']);
  assert.equal(model.patterns.find(pattern=>pattern.id==='A01').unknownRecords.length,1);
  const diff=buildProjectWriteDiff(source,rebuilt);
  assert.equal(diff.changed,false);
  assert.equal(diff.archive.changedBytes,0);
  assert.equal(diff.members.changed,0);
  assert.equal(diff.unknown.preserved,1);
  assert.equal(diff.unknown.touched,0);
});

test('EP-40 rich native project read/build roundtrip is byte-exact across supertone live FX and unknown members',()=>{
  const profile=getEpProjectProfile('TE032AS006','2.5.1');
  const source=makeEp40Archive();
  const model=readProjectModel(source,{profile});
  const rebuilt=buildProjectFromModel(model);
  assert.deepEqual([...rebuilt],[...source]);
  assert.equal(model.pads.a[0].supertone.engine,2);
  assert.equal(model.live.groups.a[0].armed,true);
  assert.deepEqual(model.unknownMembers.map(member=>member.path),['vendor_ep40_future']);
  const diff=buildProjectWriteDiff(source,rebuilt);
  assert.equal(diff.changed,false);
  assert.equal(diff.archive.changedBytes,0);
  assert.equal(diff.unknown.preserved,1);
  assert.equal(diff.unknown.touched,0);
});

test('Verified Project Editor mutations are member-local and preserve every unrelated TAR header and payload',()=>{
  const profile=getEpProjectProfile('TE032AS001','2.5.1');
  const source=makeEp133Archive();
  const model=readProjectModel(source,{profile});
  const result={project:'01',active:false,model};
  const cases=[
    {
      name:'BPM',path:'settings',
      mutate:draft=>{draft.bpm=128;},
      allowedOffsets:new Set([4,5,6,7])
    },
    {
      name:'pad amplitude',path:'pads/a/p01',
      mutate:draft=>{draft.pads.find(item=>item.group==='a'&&item.pad===1).amplitude=101;},
      allowedOffsets:new Set([16])
    },
    {
      name:'FX parameter 1',path:'fx_settings',
      mutate:draft=>{draft.fx.parameter1=0.5;},
      allowedOffsets:new Set([16,17,18,19])
    }
  ];
  for(const item of cases){
    const draft=createVerifiedProjectEditorDraft(result);
    item.mutate(draft);
    const candidate=buildVerifiedProjectEditorCandidate(result,draft);
    assert.equal(candidate.changed,true,item.name);
    const diff=assertChangedMemberSet(source,candidate.archive,[item.path]);
    assert.equal(diff.unknown.preserved,1,item.name);
    const beforeMember=memberMap(source).get(item.path);
    const afterMember=memberMap(candidate.archive).get(item.path);
    const changed=changedIndexes(beforeMember.data,afterMember.data);
    assert.ok(changed.length>0,item.name+' produced no payload delta');
    assert.equal(changed.every(offset=>item.allowedOffsets.has(offset)),true,item.name+' touched unexpected byte offsets '+changed.join(','));
    const reread=readProjectModel(candidate.archive,{profile});
    assert.deepEqual([...buildProjectFromModel(reread)],[...candidate.archive],item.name+' candidate no longer roundtrips byte-exact');
  }
});

test('EP-133 Sequencer value edit changes only the intended note byte while preserving unknown pattern records',()=>{
  const profile=getEpProjectProfile('TE032AS001','2.5.1');
  const source=makeEp133Archive();
  const model=readProjectModel(source,{profile});
  const sequencer=createProjectSequencer(model);
  sequencer.editNote('A01','r1',{velocity:91});
  const candidate=sequencer.buildArchive();
  assertChangedMemberSet(source,candidate,['patterns/a01']);
  const before=memberMap(source).get('patterns/a01').data;
  const after=memberMap(candidate).get('patterns/a01').data;
  assert.deepEqual(changedIndexes(before,after),[16]);
  const reread=readProjectModel(candidate,{profile});
  assert.deepEqual([...reread.patterns.find(pattern=>pattern.id==='A01').unknownRecords[0].raw],[0,0,3,9,8,7,6,5]);
  assert.deepEqual([...buildProjectFromModel(reread)],[...candidate]);
});

test('EP-40 Sequencer value edit remains byte-local and its result roundtrips byte-exact',()=>{
  const profile=getEpProjectProfile('TE032AS006','2.5.1');
  const source=makeEp40Archive();
  const model=readProjectModel(source,{profile});
  const sequencer=createProjectSequencer(model);
  sequencer.editNote('A01','r0',{velocity:99});
  const candidate=sequencer.buildArchive();
  assertChangedMemberSet(source,candidate,['patterns/a01']);
  const before=memberMap(source).get('patterns/a01').data;
  const after=memberMap(candidate).get('patterns/a01').data;
  assert.deepEqual(changedIndexes(before,after),[10]);
  const reread=readProjectModel(candidate,{profile});
  assert.deepEqual([...buildProjectFromModel(reread)],[...candidate]);
  assert.deepEqual(reread.unknownMembers.map(member=>member.path),['vendor_ep40_future']);
});

import test from'node:test';
import assert from'node:assert/strict';
import{buildProjectWriteDiff,formatProjectWriteDiffPreview,getProjectMemberKind}from'../js/ep133/projectWriteDiff.js';

const writeText=(bytes,offset,length,text)=>{
  bytes.fill(0,offset,offset+length);
  for(let index=0;index<text.length&&index<length;index++)bytes[offset+index]=text.charCodeAt(index);
};
const member=(path,data)=>{
  data=data instanceof Uint8Array?data:Uint8Array.from(data||[]);
  const header=new Uint8Array(512);
  writeText(header,0,100,path);
  writeText(header,100,8,'0000644\0');
  writeText(header,124,12,data.length.toString(8)+'\0');
  header[156]='0'.charCodeAt(0);
  header.fill(0x20,148,156);
  let sum=0;for(const byte of header)sum+=byte;
  const checksum=sum.toString(8)+'\0';
  writeText(header,148,8,checksum);
  for(let index=148+checksum.length;index<156;index++)header[index]=0x20;
  const padded=new Uint8Array(Math.ceil(data.length/512)*512);padded.set(data);
  return[header,padded];
};
const tar=members=>{
  const chunks=[];let total=1024;
  for(const [path,data]of members){
    const pair=member(path,Uint8Array.from(data));chunks.push(...pair);
    total+=pair[0].length+pair[1].length;
  }
  const out=new Uint8Array(total);let offset=0;
  for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}
  return out;
};

test('project write diff reports exact member changes and unknown preservation',()=>{
  const original=tar([
    ['settings',[1,2,3,4]],
    ['patterns/a01',[1,1]],
    ['vendor/blob',[9,8,7]],
    ['obsolete',[5]]
  ]);
  const candidate=tar([
    ['settings',[1,2,9,4]],
    ['patterns/a01',[1,1]],
    ['vendor/blob',[9,8,7]],
    ['patterns/b01',[4,4]]
  ]);
  const diff=buildProjectWriteDiff(original,candidate);
  assert.equal(diff.changed,true);
  assert.deepEqual(diff.members,{original:4,candidate:4,changed:3,modified:1,added:1,removed:1,unchanged:2});
  assert.deepEqual(diff.changedMembers.map(item=>[item.status,item.path,item.kind]),[
    ['modified','settings','settings'],
    ['removed','obsolete','unknown'],
    ['added','patterns/b01','pattern']
  ]);
  assert.equal(diff.changedMembers[0].byteChanges,1);
  assert.equal(diff.changedMembers[0].firstChangedByte,2);
  assert.deepEqual(diff.unknown,{original:2,candidate:1,preserved:1,touched:1,changedPaths:['obsolete']});
  assert.ok(diff.archive.changedBytes>0);
});

test('project write diff formatter is concise and includes CRC plus unknown-member status',()=>{
  const original=tar([['settings',[1,2,3,4]],['vendor/blob',[9,8,7]]]);
  const candidate=tar([['settings',[1,2,8,4]],['vendor/blob',[9,8,7]]]);
  const preview={
    project:'02',
    original:{crc32:'11111111'},candidate:{crc32:'22222222'},
    diff:buildProjectWriteDiff(original,candidate)
  };
  const text=formatProjectWriteDiffPreview(preview,{label:'verified edit'});
  assert.match(text,/VERIFIED EDIT DIFF · P02/);
  assert.match(text,/MOD settings 1B/);
  assert.match(text,/UNKNOWN 1\/1 PRESERVED/);
  assert.match(text,/CRC 11111111→22222222/);
});

test('project member kind classification stays explicit for native and unknown members',()=>{
  assert.equal(getProjectMemberKind('pads/a/p01'),'pad');
  assert.equal(getProjectMemberKind('patterns/d99'),'pattern');
  assert.equal(getProjectMemberKind('scenes'),'scenes');
  assert.equal(getProjectMemberKind('settings'),'settings');
  assert.equal(getProjectMemberKind('fx_settings'),'fx');
  assert.equal(getProjectMemberKind('live'),'live');
  assert.equal(getProjectMemberKind('vendor/blob'),'unknown');
  assert.equal(getProjectMemberKind('pads','5'),'directory');
});

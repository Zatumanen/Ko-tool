import test from 'node:test';
import assert from 'node:assert/strict';
import{getEpProjectProfile}from '../js/ep133/projectProfile.js';
import{parseProjectArchive}from '../js/ep133/projectArchive.js';
import{planProjectSampleSlotRemap}from '../js/ep133/sampleMoveProjectRemap.js';

const text=(buf,start,length,value)=>{
  buf.fill(0,start,start+length);
  for(let i=0;i<value.length&&i<length;i++)buf[start+i]=value.charCodeAt(i);
};
const tar=entries=>{
  const chunks=[];
  for(const[path,data]of entries){
    const header=new Uint8Array(512);
    text(header,0,100,path);text(header,100,8,'0000644\0');
    text(header,124,12,data.length.toString(8)+'\0');
    header[156]=48;header.fill(32,148,156);
    const sum=header.reduce((s,x)=>s+x,0),check=sum.toString(8)+'\0';
    text(header,148,8,check);header.fill(32,148+check.length,156);
    const padded=new Uint8Array(Math.ceil(data.length/512)*512);
    padded.set(data);
    chunks.push(header,padded);
  }
  const out=new Uint8Array(chunks.reduce((n,c)=>n+c.length,1024));
  let pos=0;
  for(const c of chunks){out.set(c,pos);pos+=c.length;}
  return out;
};
const pad=(slot,size)=>{
  const d=new Uint8Array(size);
  d[1]=slot&255;d[2]=slot>>>8;d[3]=4;
  d[16]=120;d[17]=0xfe;d[18]=0xfd;d[19]=10;d[20]=150;
  d[21]=1;d[22]=3;d[23]=2;d[24]=60;d[25]=0x9a;
  if(size>=27)d[26]=45;
  if(size===29){d[27]=16;d[28]=34;}
  return d;
};
const make=size=>tar([
  ['pads/a/p01',pad(7,size)],
  ['pads/a/p02',pad(7,size)],
  ['pads/b/p03',pad(8,size)],
  ['pads/d/p12',pad(size===29?1002:15,size)],
  ['future_vendor_member',Uint8Array.from([9,8,7,6,5])]
]);
const members=bytes=>new Map(parseProjectArchive(bytes).map(m=>[m.path,m.data]));

for(const [sku,size] of [['TE032AS001',26],['TE032AS006',29]]){
  test(sku+': remap all matching project pads and preserve every unrelated byte',()=>{
    const profile=getEpProjectProfile(sku,'2.5.1'),before=make(size);
    const planned=planProjectSampleSlotRemap(before,[{sourceId:7,targetId:21},{sourceId:8,targetId:22}],{profile});
    const after=members(planned.candidate),old=members(before);
    assert.equal(planned.changed,true);
    assert.deepEqual(planned.pads.map(p=>p.path),['pads/a/p01','pads/a/p02','pads/b/p03']);
    for(const path of after.keys()){
      const a=after.get(path),b=old.get(path);
      assert.equal(a.length,b.length);
      for(let i=0;i<a.length;i++){
        const newSlot=path==='pads/b/p03'?22:21;
        const changedPad=path==='pads/a/p01'||path==='pads/a/p02'||path==='pads/b/p03';
        assert.equal(a[i],i===1&&changedPad?newSlot:b[i],path+' byte '+i);
      }
    }
    assert.deepEqual([...after.get('pads/d/p12')],[...old.get('pads/d/p12')]);
    assert.equal(planned.candidate.length,before.length);
    assert.notDeepEqual([...planned.candidate],[...before]);
    assert.deepEqual([...planned.original],[...before]);
  });
  test(sku+': unrelated MOVE leaves project byte-exact',()=>{
    const profile=getEpProjectProfile(sku,'2.5.1'),base=make(size);
    const planned=planProjectSampleSlotRemap(base,[{sourceId:15,targetId:16}],{profile});
    // EP-133 pad #12 contains slot 15, so choose an actually unrelated slot.
    const empty=planProjectSampleSlotRemap(base,[{sourceId:98,targetId:99}],{profile});
    assert.equal(empty.changed,false);
    assert.deepEqual([...empty.candidate],[...base]);
    assert.equal(planned.changed,size===26);
  });
}

test('never converts a 27-byte EP-133 read-only project to writer format',()=>{
  const profile=getEpProjectProfile('TE032AS001','2.5.1');
  assert.throws(()=>planProjectSampleSlotRemap(make(27),[{sourceId:7,targetId:21}],{profile}),/pad-record size|requires.*bytes/);
});
test('invalid/cyclic plan and unverified firmware fail closed before candidate creation',()=>{
  const profile=getEpProjectProfile('TE032AS001','2.5.1'),base=make(26);
  for(const moves of [[],[{sourceId:7,targetId:7}],[{sourceId:7,targetId:8},{sourceId:7,targetId:9}],
    [{sourceId:7,targetId:8},{sourceId:8,targetId:7}],[{sourceId:7,targetId:1000}]]){
    assert.throws(()=>planProjectSampleSlotRemap(base,moves,{profile}),/MOVE plan|unique|empty target/);
  }
  const unknown=getEpProjectProfile('TE032AS001','9.9.9');
  assert.throws(()=>planProjectSampleSlotRemap(base,[{sourceId:7,targetId:8}],{profile:unknown}),/verified/);
});

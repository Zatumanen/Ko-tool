import test from 'node:test';
import assert from 'node:assert/strict';
import{verifyNativeProjectSlotMove}from '../js/ep133/sampleMoveProjectVerification.js';

const makeTar=(records=[])=>{
  const bytes=new Uint8Array(1024+records.length*1024);
  for(let i=0;i<records.length;i++){
    const {path,slot,length=26}=records[i];
    const start=i*1024,header=bytes.subarray(start,start+512);
    header.set(new TextEncoder().encode(path),0);
    header.set(new TextEncoder().encode(length.toString(8)),124);
    header[156]=48;
    header.fill(32,148,156);
    const sum=header.reduce((count,byte)=>count+byte,0);
    header.set(new TextEncoder().encode(sum.toString(8)+'\0'),148);
    bytes[start+513]=slot&255;
    bytes[start+514]=(slot>>>8)&255;
    bytes[start+528]=100;
    bytes[start+536]=60;
  }
  return bytes;
};
const patched=(tar,from,to)=>{
  const result=tar.slice();
  for(let i=0;i<result.length-1024;i+=1024){
    const id=result[i+513]|result[i+514]<<8;
    if(id===from){
      result[i+513]=to&255;
      result[i+514]=(to>>>8)&255;
    }
  }
  return result;
};

for(const length of [26,27]){
  test('native MOVE verifies byte-exact remap for '+length+'-byte EP-133 pads',()=>{
    const before=makeTar([
      {path:'pads/a/p10',slot:900,length},
      {path:'pads/b/p01',slot:7,length}
    ]);
    before[512+26]=length===27?48:0;
    const after=patched(before,900,901);
    const result=verifyNativeProjectSlotMove(before,after,{
      sourceId:900,targetId:901,project:'06'
    });
    assert.equal(result.remappedPads,1);
    assert.deepEqual(result.data,after);
    assert.notStrictEqual(result.data,after);
  });
}

test('native MOVE accepts two pad references within the same project',()=>{
  const before=makeTar([
    {path:'pads/a/p01',slot:900},
    {path:'pads/d/p12',slot:900}
  ]);
  const result=verifyNativeProjectSlotMove(before,patched(before,900,901),{
    sourceId:900,targetId:901,project:'06'
  });
  assert.equal(result.remappedPads,2);
});

test('native MOVE refuses success if firmware leaves a referenced slot unchanged',()=>{
  const before=makeTar([{path:'pads/a/p01',slot:900}]);
  assert.throws(()=>verifyNativeProjectSlotMove(before,before,{sourceId:900,targetId:901,project:'06'}),
    /unexpected TAR change/);
});

test('native MOVE refuses a non-slot project edit, even after correct remap',()=>{
  const before=makeTar([{path:'pads/a/p01',slot:900}]);
  const after=patched(before,900,901);
  after[515]^=1;
  assert.throws(()=>verifyNativeProjectSlotMove(before,after,{
    sourceId:900,targetId:901,project:'06'
  }),/unexpected TAR change/);
});

test('native MOVE refuses an unexpected project edit or missing source',()=>{
  const before=makeTar([{path:'pads/a/p01',slot:900}]);
  assert.throws(()=>verifyNativeProjectSlotMove(before,patched(before,900,901),{
    sourceId:901,targetId:902,project:'06'
  }),/no longer references source/);
  assert.throws(()=>verifyNativeProjectSlotMove(before,patched(before,900,901).slice(0,512),{
    sourceId:900,targetId:901,project:'06'
  }),/TAR|archive/);
});

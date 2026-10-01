import test from 'node:test';
import assert from 'node:assert/strict';
import{getEpProjectProfile}from '../js/ep133/projectProfile.js';
import{readProjectModel}from '../js/ep133/projectReader.js';
import{
  createVerifiedProjectEditorDraft,buildVerifiedProjectEditorPatch,
  buildVerifiedProjectEditorCandidate,summarizeVerifiedProjectChanges
}from '../js/ep133/projectEditor.js';
import{getVerifiedProjectEditorAvailability}from '../js/ep133/ui/projectEditorController.js';

const writeText=(target,offset,length,text)=>{
  target.fill(0,offset,offset+length);
  for(let index=0;index<text.length&&index<length;index++)target[offset+index]=text.charCodeAt(index);
};
const member=(path,data)=>{
  const payload=data instanceof Uint8Array?data:new Uint8Array(data||[]);
  const header=new Uint8Array(512);
  writeText(header,0,100,path);
  writeText(header,100,8,'0000644\0');
  writeText(header,124,12,payload.length.toString(8)+'\0');
  header[156]='0'.charCodeAt(0);header.fill(0x20,148,156);
  let sum=0;for(const byte of header)sum+=byte;
  const checksum=sum.toString(8)+'\0';
  writeText(header,148,8,checksum);
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
const pad=(slot=7)=>{
  const data=new Uint8Array(26),view=new DataView(data.buffer);
  view.setUint16(1,slot,true);data[3]=0;view.setUint32(4,0,true);view.setUint32(8,48000,true);
  view.setFloat32(12,120,true);data[16]=100;data[17]=0;data[18]=0;data[19]=0;data[20]=255;
  data[21]=0;data[22]=0;data[23]=0;data[24]=60;return data;
};
const pattern=()=>Uint8Array.from([0,2,1,0,0,0,0,60,100,24,0,0]);
const scenes=()=>{
  const data=new Uint8Array(712);data.set([0,0,0,0,0,4,4],0);
  for(let scene=0;scene<99;scene++){const offset=7+scene*6;data[offset+4]=4;data[offset+5]=4;}
  data.set([1,1,1,1],7);data[7+99*6+3]=1;return data;
};
const settings=()=>{
  const data=new Uint8Array(222),view=new DataView(data.buffer);
  view.setFloat32(4,123.5,true);
  for(let offset=24;offset<216;offset+=4)view.setFloat32(offset,-1,true);
  data.set([0,1,2,3],216);
  return data;
};
const fx=()=>{
  const data=new Uint8Array(144),view=new DataView(data.buffer);
  data[4]=2;view.setFloat32(16,.25,true);view.setFloat32(80,.75,true);
  view.setFloat32(136,.5,true);view.setFloat32(140,1,true);return data;
};
const source=tar([
  {path:'pads/a/p01',data:pad(7)},
  {path:'pads/b/p01',data:pad(8)},
  {path:'patterns/a01',data:pattern()},{path:'patterns/b01',data:pattern()},
  {path:'patterns/c01',data:pattern()},{path:'patterns/d01',data:pattern()},
  {path:'scenes',data:scenes()},{path:'settings',data:settings()},{path:'fx_settings',data:fx()},
  {path:'vendor_future',data:Uint8Array.from([9,8,7,6])}
]);
const profile=getEpProjectProfile('TE032AS001','2.5.1');
const makeResult=({active=false,modelProfile=profile,dependencies=true}={})=>{
  const model=readProjectModel(source,{profile:modelProfile});
  return{
    project:'02',active,
    profile:{id:modelProfile.id,sku:modelProfile.sku,firmware:modelProfile.firmware},
    dependencies:{
      referencedSampleSlots:[7,8],
      missingSampleSlots:dependencies?[]:[8],
      allSamplesAvailable:dependencies
    },
    model
  };
};

test('verified project editor draft exposes only verified configuration/performance fields',()=>{
  const draft=createVerifiedProjectEditorDraft(makeResult());
  assert.equal(draft.project,'02');
  assert.equal(draft.bpm,123.5);
  assert.equal(draft.groupFaders.a.parameter,0);
  assert.equal(draft.fx.type,2);
  assert.equal(draft.fx.parameter1,.25);
  assert.equal(draft.pads.length,2);
  assert.equal(draft.pads[0].sampleSlot,7);
  assert.equal('trimStart' in draft.pads[0],false);
  assert.equal('playMode' in draft.pads[0],false);
});

test('verified project editor builds minimal settings/FX/pad patch and preserves native unexposed members',()=>{
  const result=makeResult();
  const draft=createVerifiedProjectEditorDraft(result);
  draft.bpm=132;
  draft.groupFaders.a={parameter:5,baseValue:.4};
  draft.fx.type=3;
  draft.fx.parameter1=.2;
  draft.fx.parameter2=.8;
  draft.fx.compressorDrive=.25;
  draft.fx.compressorSpeed=.75;
  draft.pads[0].amplitude=111;
  draft.pads[0].pitch=-3;
  draft.pads[0].pan=4;

  const built=buildVerifiedProjectEditorCandidate(result,draft);
  assert.equal(built.changed,true);
  const summary=summarizeVerifiedProjectChanges(built.changes);
  assert.ok(summary.total>=7);
  assert.ok(summary.settings>=2);
  assert.ok(summary.fx>=3);
  assert.ok(summary.pads>=3);

  const model=built.model;
  assert.equal(model.settings.bpm,132);
  assert.equal(model.settings.faderAssignments.a.parameter,5);
  assert.ok(Math.abs(model.settings.groupFaders.a[5].value-.4)<1e-5);
  assert.equal(model.fxSettings.effectType,3);
  assert.ok(Math.abs(model.fxSettings.parameter1-.2)<1e-5);
  assert.ok(Math.abs(model.fxSettings.parameter2-.8)<1e-5);
  assert.equal(model.pads.a[0].amplitude,111);
  assert.equal(model.pads.a[0].pitch,-3);
  assert.equal(model.pads.a[0].pan,4);
  assert.equal(model.pads.a[0].sampleSlot,7);
  assert.equal(model.pads.a[0].trimLength,48000);
  assert.deepEqual([...model.unknownMembers[0].data],[9,8,7,6]);

  const originalPatterns=readProjectModel(source,{profile}).patterns.map(item=>[item.id,[...item.rawData]]);
  const editedPatterns=model.patterns.map(item=>[item.id,[...item.rawData]]);
  assert.deepEqual(editedPatterns,originalPatterns);
  assert.deepEqual([...model.scenes.rawData],[...readProjectModel(source,{profile}).scenes.rawData]);
});

test('verified project editor produces an exact no-op archive when nothing changed',()=>{
  const result=makeResult();
  const draft=createVerifiedProjectEditorDraft(result);
  const built=buildVerifiedProjectEditorCandidate(result,draft);
  assert.equal(built.changed,false);
  assert.equal(built.changes.length,0);
  assert.deepEqual([...built.archive],[...source]);
  assert.deepEqual(buildVerifiedProjectEditorPatch(result.model,draft),{patch:{},changes:[]});
});

test('verified project editor refuses active, unverified and missing-dependency projects',()=>{
  assert.deepEqual(getVerifiedProjectEditorAvailability(makeResult({active:true})),{
    enabled:false,reason:'ACTIVE PROJECT CANNOT BE EDITED'
  });
  assert.deepEqual(getVerifiedProjectEditorAvailability(makeResult({dependencies:false})),{
    enabled:false,reason:'PROJECT HAS MISSING SAMPLE DEPENDENCIES'
  });
  const futureProfile=getEpProjectProfile('TE032AS001','9.9.9');
  const future={
    project:'02',active:false,
    dependencies:{allSamplesAvailable:true},
    model:{profile:futureProfile}
  };
  assert.equal(getVerifiedProjectEditorAvailability(future).enabled,false);
  assert.match(getVerifiedProjectEditorAvailability(future).reason,/NOT VERIFIED/);

  const active=makeResult({active:true});
  const draft=createVerifiedProjectEditorDraft(active);
  draft.bpm=130;
  assert.throws(()=>buildVerifiedProjectEditorCandidate(active,draft),/inactive project/i);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import{createOfficialEpPak}from '../js/ep133/officialPak.js';
import{inspectOfficialPak,readOfficialPakZip}from '../js/ep133/officialPakReader.js';
import{stageOfficialPakRestoreReadOnly}from '../js/ep133/officialPakRestoreStaging.js';

const device={name:'EP-133',sku:'TE032AS001',identitySku:'TE032AS002',
  baseSku:'TE032AS001',metadata:{os_version:'2.5.1',base_sku:'TE032AS001'}};
const pcm=Uint8Array.of(1,2,3,4,5,6,7,8);
const sample={slot:7,name:'kick808',data:pcm,metadata:{
  channels:1,samplerate:46000,format:'s16',name:'kick808',
  'sound.rootnote':60,'sound.loopstart':-1,'sound.loopend':-1,
  'sound.playmode':'oneshot','sound.pitch':0,'sound.pan':0,
  'sound.amplitude':100,'envelope.attack':0,'envelope.release':255,
  'time.mode':'off','sample.start':0,'sample.end':4
}};
function tar(){
  const out=new Uint8Array(2048),head=out.subarray(0,512);
  head.set(new TextEncoder().encode('pads/a/p01'));
  head.set(new TextEncoder().encode('00000000032\0'),124);
  head[156]=48;head.fill(32,148,156);
  const sum=head.reduce((n,b)=>n+b,0);
  head.set(new TextEncoder().encode(sum.toString(8).padStart(6,'0')+'\0 '),148);
  out[513]=7;out[514]=0;
  return out;
}

test('exported PPAK passes existing parser then yields exact offline PCM/TAR staging, no restore',async()=>{
  const projectData=tar();
  const {blob}=await createOfficialEpPak({
    scope:'project+samples',device,
    projects:[{project:'06',data:projectData,dependencies:{
      allSamplesAvailable:true,missingSampleSlots:[],referencedSampleSlots:[7]
    }}],samples:[sample]
  });
  const data=new Uint8Array(await blob.arrayBuffer());
  const inventory=await inspectOfficialPak(data);
  const members=await readOfficialPakZip(data);
  const staging=stageOfficialPakRestoreReadOnly(inventory,members,{device});
  assert.equal(staging.identity.status,'match');
  assert.deepEqual(staging.samples[0].pcm,pcm);
  assert.deepEqual(staging.projects[0].tar,projectData);
  assert.deepEqual(staging.projects[0].referencedSlots,[7]);
  assert.equal(staging.canRestore,false);
  assert.equal(staging.writeAuthorized,false);
  assert.equal(staging.requiresHardwareReadback,true);
});

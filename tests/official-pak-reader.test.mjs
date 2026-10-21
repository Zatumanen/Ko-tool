import test from 'node:test';
import assert from 'node:assert/strict';
import{createOfficialEpPak}from '../js/ep133/officialPak.js';
import{readOfficialPakZip,inspectOfficialPak}from '../js/ep133/officialPakReader.js';

const device={name:'EP-133',sku:'TE032AS001',identitySku:'TE032AS002',
  baseSku:'TE032AS001',metadata:{os_version:'2.5.1',base_sku:'TE032AS001'}};
const sample=(slot=7)=>({
  slot,name:'kick808',
  data:Uint8Array.of(1,2,3,4,5,6,7,8),
  metadata:{
    channels:1,samplerate:46000,format:'s16',name:'kick808',
    'sound.rootnote':60,'sound.loopstart':-1,'sound.loopend':-1,
    'sound.playmode':'oneshot','sound.pitch':0,'sound.pan':0,
    'sound.amplitude':100,'envelope.attack':0,'envelope.release':255,
    'time.mode':'off','sample.start':0,'sample.end':4
  }
});
const tar=(slot=7)=>{
  const out=new Uint8Array(2048),hdr=out.subarray(0,512);
  hdr.set(new TextEncoder().encode('pads/a/p01'),0);
  hdr.set(new TextEncoder().encode('00000000032\0'),124); // 26 decimal
  hdr[156]=48;
  hdr.fill(32,148,156);
  const total=hdr.reduce((sum,value)=>sum+value,0);
  const oct=total.toString(8).padStart(6,'0');
  hdr.set(new TextEncoder().encode(oct+'\0 '),148);
  out[513]=slot&255;out[514]=slot>>>8;
  return out;
};
const valid=async({slot=7,ref=7,scope='device'}={})=>{
  const exportPak=await createOfficialEpPak({
    scope,device,projects:[{project:'06',data:tar(ref),
      dependencies:{allSamplesAvailable:true,missingSampleSlots:[],referencedSampleSlots:[ref]}}],
    samples:[sample(slot)]
  });
  return new Uint8Array(await exportPak.blob.arrayBuffer());
};
const modify=(bytes,from,to)=>{
  const a=bytes.slice();
  const start=Buffer.from(a).indexOf(Buffer.from(from));
  assert.ok(start>=0);
  a.set(new TextEncoder().encode(to),start);
  return a;
};
test('read-only PAK inventory verifies ZIP/Deflate, TAR pad dependencies and WAV sample identity',async()=>{
  const archive=await inspectOfficialPak(await valid());
  assert.equal(archive.format,'pak');
  assert.equal(archive.projects.length,1);
  assert.equal(archive.sounds.length,1);
  assert.equal(archive.metadata.device_sku,'TE032AS002');
  assert.equal(archive.metadata.base_sku,'TE032AS001');
  assert.equal(archive.projects[0].padReferences[0].slot,7);
  assert.deepEqual(archive.dependencies[0].missing,[]);
  assert.equal(archive.sounds[0].sampleFrames,4);
  assert.equal(archive.sounds[0].rootNote,60);
  assert.equal(archive.sounds[0].metadata['sound.playmode'],'oneshot');
});
test('read-only project PPAK preserves its own type without declaring restore support',async()=>{
  const archive=await inspectOfficialPak(await valid({scope:'project+samples'}));
  assert.equal(archive.format,'ppak');
  assert.equal(archive.projects.length,1);
});
test('read-only PAK identifies a missing sample referenced from a pad',async()=>{
  const archive=await inspectOfficialPak(await valid({ref:8}));
  assert.deepEqual(archive.dependencies[0].missing,[8]);
  assert.ok(archive.warnings.some(w=>w.includes('missing')));
});
test('ZIP preview rejects traversal, unsupported compression flags and damaged contents',async()=>{
  const raw=await valid();
  const unsafe=raw.slice();
  // ZIP local and central names are validated using central-directory offsets.
  const original=Buffer.from('/sounds/');
  const replace=Buffer.from('/..unds/');
  for(let p=0;p<unsafe.length-original.length;p++)
    if(unsafe.subarray(p,p+original.length).every((v,i)=>v===original[i]))
      unsafe.set(replace,p);
  await assert.rejects(()=>readOfficialPakZip(unsafe),/unsafe ZIP path|unsupported archive entry path/);
  const damaged=raw.slice();
  const needle=Buffer.from('PK\x01\x02');
  const cd=Buffer.from(damaged).indexOf(needle);
  assert.ok(cd>=0);
  damaged[cd+10]=99; // ZIP compression method, central directory
  await assert.rejects(()=>readOfficialPakZip(damaged),/unsupported ZIP entry flags\/method/);
  const encrypted=raw.slice();
  encrypted[cd+8]|=1;
  await assert.rejects(()=>readOfficialPakZip(encrypted),/encrypted or unsupported/);
});
test('ZIP preview denies malicious uncompressed sizes before decompression',async()=>{
  const raw=await valid(),bad=raw.slice();
  const cd=Buffer.from(bad).indexOf(Buffer.from('PK\x01\x02'));
  assert.ok(cd>=0);
  new DataView(bad.buffer).setUint32(cd+24,0x7fffffff,true);
  await assert.rejects(()=>readOfficialPakZip(bad),/safety limits/);
});
test('ZIP preview rejects corrupt archive CRC and truncated archive',async()=>{
  const raw=await valid();
  const cd=Buffer.from(raw).indexOf(Buffer.from('PK\x01\x02'));
  assert.ok(cd>=0);
  const bad=raw.slice();
  bad[cd+16]^=1;
  await assert.rejects(()=>inspectOfficialPak(bad),/CRC mismatch/);
  await assert.rejects(()=>inspectOfficialPak(raw.slice(0,-5)),/ZIP end-of-central-directory/);
});

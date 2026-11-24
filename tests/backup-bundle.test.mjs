import test from 'node:test';
import assert from 'node:assert/strict';
import {createZip} from '../js/zip.js';
import{
  EP_BACKUP_SCHEMA,createEpBackupBundle,parseEpBackupBundle,parseStoredZip,readEpBackupBundleFile,buildBundleProjectRestorePlan
}from '../js/ep133/backupBundle.js';

const bytes=value=>Uint8Array.from(value);

test('EP backup bundle round-trips project and sample payloads with checksums',async()=>{
  const bundle=await createEpBackupBundle({
    scope:'project+samples',
    device:{sku:'TE032AS001',metadata:{os_version:'2.5.1',serial:'SERIAL-PRIVATE'}},
    activeProject:'01',
    projects:[{
      project:'02',
      data:bytes([1,2,3,4]),
      active:false,
      dependencies:{
        referencedSampleSlots:[7,8],
        missingSampleSlots:[],
        allSamplesAvailable:true
      }
    }],
    samples:[
      {slot:7,name:'kick',data:bytes([7,7,7]),metadata:{name:'kick',channels:1,samplerate:46875,format:'s16',crc:7007}},
      {slot:8,name:'snare',data:bytes([8,8,8,8]),metadata:{name:'snare',channels:1,samplerate:46875,format:'s16',crc:8008}}
    ],
    createdAt:new Date('2026-10-01T00:00:00Z')
  });
  assert.equal(bundle.manifest.schema,EP_BACKUP_SCHEMA);
  assert.equal(bundle.manifest.scope,'project+samples');
  assert.equal(bundle.manifest.device.sku,'TE032AS001');
  assert.equal('serial' in bundle.manifest.device,false);
  assert.equal(bundle.manifest.projects[0].number,'02');
  assert.equal(bundle.manifest.samples.length,2);

  const parsed=parseEpBackupBundle(new Uint8Array(await bundle.blob.arrayBuffer()));
  assert.equal(parsed.manifest.schema,EP_BACKUP_SCHEMA);
  assert.deepEqual([...parsed.projects[0].data],[1,2,3,4]);
  assert.deepEqual([...parsed.samples[0].data],[7,7,7]);
  assert.equal(parsed.samples[1].metadata.name,'snare');
});

test('EP backup parser rejects tampered stored ZIP payloads',async()=>{
  const bundle=await createEpBackupBundle({
    scope:'project',
    device:{sku:'TE032AS001',metadata:{os_version:'2.5.1',serial:'x'}},
    projects:[{project:'01',data:bytes([1,2,3]),dependencies:{}}],
    samples:[]
  });
  const data=new Uint8Array(await bundle.blob.arrayBuffer());
  const tampered=data.slice();
  const view=new DataView(tampered.buffer);
  const payloadOffset=30+view.getUint16(26,true)+view.getUint16(28,true);
  tampered[payloadOffset]^=0xff;
  assert.throws(()=>parseEpBackupBundle(tampered),/CRC mismatch/i);
});

test('legacy backup rejects oversized selections before reading them',async()=>{
  let read=false;
  await assert.rejects(readEpBackupBundleFile({
    size:1024**3,arrayBuffer:async()=>{read=true;throw new Error('unexpected read');}
  }),/size outside|exceeds.*limit/i);
  assert.equal(read,false);
});

test('an oversized array-like ZIP source is rejected before conversion to bytes',()=>{
  const oversized={length:Number.MAX_SAFE_INTEGER};
  assert.throws(()=>parseStoredZip(oversized),/ZIP size outside safe limits/);
});

test('legacy backup enforces a member limit before checking or copying payload',async()=>{
  const {blob}=await createEpBackupBundle({scope:'project',projects:[{project:'02',data:bytes([1,2,3])}]});
  const zip=new Uint8Array(await blob.arrayBuffer());
  const view=new DataView(zip.buffer);
  const centralStart=view.getUint32(zip.length-6,true);
  view.setUint32(centralStart+20,129*1024*1024,true);
  view.setUint32(centralStart+24,129*1024*1024,true);
  assert.throws(()=>parseEpBackupBundle(zip),/entry exceeds safety limits/);
  await assert.rejects(readEpBackupBundleFile({size:zip.length+1,arrayBuffer:async()=>zip.buffer}),/size changed/);
});

test('legacy backup rejects a truncated end record and excessive entry counts',async()=>{
  const {blob}=await createEpBackupBundle({scope:'project',projects:[{project:'02',data:bytes([1,2,3])}]});
  const zip=new Uint8Array(await blob.arrayBuffer());
  assert.throws(()=>parseEpBackupBundle(zip.subarray(0,-1)),/ZIP.*(directory|end)/i);
  const tooMany=new Uint8Array(await (await createZip(Array.from({length:2100},(_,i)=>({
    path:'entry-'+i,blob:new Blob(['x'])
  })))).arrayBuffer());
  assert.throws(()=>parseStoredZip(tooMany),/ZIP.*entry count/i);
});

test('legacy backup refuses duplicate project and slot identities and reused member paths',async()=>{
  const built=await createEpBackupBundle({
    scope:'project+samples',
    projects:[{project:'02',data:bytes([1,2,3])},{project:'03',data:bytes([1,2,3])}],
    samples:[
      {slot:1,data:bytes([7,7]),metadata:{channels:1}},
      {slot:2,data:bytes([7,7]),metadata:{channels:1}}
    ]
  });
  const members=parseStoredZip(new Uint8Array(await built.blob.arrayBuffer()));
  async function repack(modify){
    const manifest=structuredClone(built.manifest);
    modify(manifest);
    const files=[...members].map(([path,data])=>({
      path,blob:new Blob([path==='manifest.json'?JSON.stringify(manifest):data])
    }));
    return new Uint8Array(await (await createZip(files)).arrayBuffer());
  }
  for(const [modify,error] of [
    [m=>{m.projects[1].number='02';},/duplicate.*project/i],
    [m=>{m.samples[1].slot=1;},/duplicate.*slot/i],
    [m=>{m.projects[1].file=m.projects[0].file;},/reused.*payload/i],
    [m=>{m.samples[1].dataFile=m.samples[0].dataFile;},/reused.*payload/i],
    [m=>{m.samples[1].metadataFile=m.samples[0].metadataFile;},/reused.*payload/i]
  ]){
    const zip=await repack(modify);
    assert.throws(()=>parseEpBackupBundle(zip),error);
  }
});

test('legacy ZIP rejects repeated members and unbounded project dependency lookups',async()=>{
  const duplicates=await createZip([{path:'samples/007.bin',blob:new Blob(['a'])},
    {path:'samples/007.bin',blob:new Blob(['b'])}]);
  const duplicateBytes=new Uint8Array(await duplicates.arrayBuffer());
  assert.throws(()=>parseStoredZip(duplicateBytes),/duplicate ZIP entry/i);
  for(const slots of [[7,7],Array(1000).fill(7),['garbage']]){
    const {blob}=await createEpBackupBundle({scope:'project',projects:[{
      project:'02',data:bytes([1]),dependencies:{referencedSampleSlots:slots}
    }]});
    const source=new Uint8Array(await blob.arrayBuffer());
    assert.throws(()=>parseEpBackupBundle(source),/invalid backup project dependency slots/i);
  }
});

test('bundle restore plan restores empty dependencies, skips CRC matches and blocks conflicts',async()=>{
  const bundle=await createEpBackupBundle({
    scope:'project+samples',
    device:{sku:'TE032AS001',metadata:{os_version:'2.5.1',serial:'x'}},
    projects:[{
      project:'02',data:bytes([1,2,3]),
      dependencies:{referencedSampleSlots:[7,8,9],missingSampleSlots:[],allSamplesAvailable:true}
    }],
    samples:[
      {slot:7,name:'kick',data:bytes([1]),metadata:{crc:7007,channels:1,samplerate:46875,format:'s16'}},
      {slot:8,name:'snare',data:bytes([2]),metadata:{crc:8008,channels:1,samplerate:46875,format:'s16'}},
      {slot:9,name:'hat',data:bytes([3]),metadata:{crc:9009,channels:1,samplerate:46875,format:'s16'}}
    ]
  });
  const parsed=parseEpBackupBundle(new Uint8Array(await bundle.blob.arrayBuffer()));
  const current=new Map([
    [7,{file:{name:'kick'},meta:{crc:7007}}],
    [9,{file:{name:'other'},meta:{crc:1234}}]
  ]);
  const plan=buildBundleProjectRestorePlan(parsed,'02',{
    getSampleSlot:slot=>current.get(slot)||null
  });
  assert.deepEqual(plan.dependencies.map(item=>[item.slot,item.status]),[
    [7,'already-matches'],
    [8,'restore'],
    [9,'conflict']
  ]);
  assert.equal(plan.canRestore,false);
  assert.deepEqual(plan.restore.map(item=>item.slot),[8]);
  assert.deepEqual(plan.conflicts.map(item=>item.slot),[9]);
});

test('bundle restore plan blocks referenced dependencies missing from both device and backup',async()=>{
  const bundle=await createEpBackupBundle({
    scope:'project+samples',
    device:{sku:'TE032AS001',metadata:{os_version:'2.5.1',serial:'x'}},
    projects:[{
      project:'02',data:bytes([1]),
      dependencies:{referencedSampleSlots:[7,8],missingSampleSlots:[8],allSamplesAvailable:false}
    }],
    samples:[
      {slot:7,name:'kick',data:bytes([1]),metadata:{crc:7007,channels:1,samplerate:46875,format:'s16'}}
    ]
  });
  const parsed=parseEpBackupBundle(new Uint8Array(await bundle.blob.arrayBuffer()));
  const plan=buildBundleProjectRestorePlan(parsed,'02',{getSampleSlot:()=>null});
  assert.deepEqual(plan.dependencies.map(item=>[item.slot,item.status]),[
    [7,'restore'],[8,'missing']
  ]);
  assert.equal(plan.canRestore,false);
});

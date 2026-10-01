import test from 'node:test';
import assert from 'node:assert/strict';
import{
  EP_BACKUP_SCHEMA,createEpBackupBundle,parseEpBackupBundle,buildBundleProjectRestorePlan
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
  tampered[40]^=0xff;
  assert.throws(()=>parseEpBackupBundle(tampered),/CRC mismatch|manifest/i);
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

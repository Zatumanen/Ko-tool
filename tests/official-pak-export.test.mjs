import test from 'node:test';
import assert from 'node:assert/strict';
import{inflateRawSync}from 'node:zlib';
import{createOfficialEpPak,createOfficialSampleWav}from '../js/ep133/officialPak.js';
import{createEpBackupBundle,parseEpBackupBundle}from '../js/ep133/backupBundle.js';

const device={name:'EP-133',sku:'TE032AS001',metadata:{os_version:'2.5.1',base_sku:'TE032AS001',serial:'PRIVATE-UNUSED'}};
const sample=(slot=7,options={})=>{
  const data=Uint8Array.from([1,2,3,4,5,6,7,8]);
  const metadata={
    channels:1,samplerate:46000,format:'s16',name:'kick',crc:1234,
    'sound.rootnote':60,'sound.loopstart':-1,'sound.loopend':-1,
    'sound.bpm':0,'sound.playmode':'oneshot',
    'sound.pitch':-12,'sound.pan':0,'sound.amplitude':100,
    'envelope.attack':0,'envelope.release':255,
    'time.mode':'off','sample.start':0,'sample.end':4,
    ...options
  };
  return{slot,name:'kick',data,metadata};
};
const project=(project='01',slots=[7])=>({
  project,data:new Uint8Array(2048),
  dependencies:{referencedSampleSlots:slots,missingSampleSlots:[],allSamplesAvailable:true}
});
const readZip=buffer=>{
  const data=new Uint8Array(buffer),view=new DataView(data.buffer,data.byteOffset,data.byteLength);
  const files=new Map();
  let at=0;
  while(at+4<=data.length&&view.getUint32(at,true)===0x04034b50){
    const flags=view.getUint16(at+6,true);
    const method=view.getUint16(at+8,true);
    const crc=view.getUint32(at+14,true);
    const csize=view.getUint32(at+18,true);
    const usize=view.getUint32(at+22,true);
    const namelen=view.getUint16(at+26,true);
    const extra=view.getUint16(at+28,true);
    assert.equal(flags&0x08,0,'no ZIP data descriptor');
    const name=new TextDecoder().decode(data.slice(at+30,at+30+namelen));
    const start=at+30+namelen+extra;
    const part=data.slice(start,start+csize);
    const decoded=method===8?inflateRawSync(part):part;
    assert.equal(decoded.byteLength,usize);
    assert.ok(crc>=0);
    assert.ok(!files.has(name));
    files.set(name,{data:new Uint8Array(decoded),method});
    at=start+csize;
  }
  return files;
};
const wavChunks=wav=>{
  const view=new DataView(wav.buffer,wav.byteOffset,wav.byteLength);
  assert.equal(new TextDecoder().decode(wav.slice(0,4)),'RIFF');
  assert.equal(view.getUint32(4,true),wav.length-8);
  const result=new Map();
  let at=12;
  while(at+8<=wav.length){
    const tag=new TextDecoder().decode(wav.slice(at,at+4));
    const len=view.getUint32(at+4,true);
    result.set(tag,wav.slice(at+8,at+8+len));
    at+=8+len+(len%2);
  }
  assert.equal(at,wav.length);
  return result;
};

test('official WAV preserves exact original PCM, RIFF size, smpl and INFO/TNGE metadata',()=>{
  const s=sample();
  const wav=createOfficialSampleWav(s);
  const chunks=wavChunks(wav);
  assert.deepEqual([...chunks.keys()],['fmt ','smpl','LIST','data']);
  assert.deepEqual(chunks.get('data'),s.data);
  const view=new DataView(chunks.get('fmt ').buffer);
  assert.equal(view.getUint32(4,true),46000);
  assert.equal(new DataView(chunks.get('smpl').buffer).getUint32(12,true),60);
  const list=chunks.get('LIST');
  assert.equal(new TextDecoder().decode(list.slice(0,4)),'INFO');
  assert.equal(new TextDecoder().decode(list.slice(4,8)),'TNGE');
  const jsonSize=new DataView(list.buffer).getUint32(8,true);
  assert.equal(list[12+jsonSize-1],0);
  const m=JSON.parse(new TextDecoder().decode(list.slice(12,12+jsonSize)).replaceAll(String.fromCharCode(0),''));
  assert.equal(m['sound.pitch'],-12);
  assert.equal(m['sample.end'],4);
  assert.equal('sound.loopstart' in m,false);
  assert.equal('sound.bpm' in m,false);
});

test('official WAV ACID BPM chunk appears only for verified BPM range',()=>{
  const wav=createOfficialSampleWav(sample(612,{'sound.bpm':87.46}));
  const chunks=wavChunks(wav);
  assert.deepEqual([...chunks.keys()],['fmt ','smpl','acid','LIST','data']);
  const acid=chunks.get('acid');
  assert.equal(acid.length,24);
  assert.ok(Math.abs(new DataView(acid.buffer).getFloat32(20,true)-87.46)<0.00001);
  const body=chunks.get('LIST');
  assert.equal(JSON.parse(new TextDecoder().decode(body.slice(12)).replaceAll(String.fromCharCode(0),''))['sound.bpm'],87.46);
});

test('official TNGE pads JSON payload to four bytes for both reference BPM layouts',()=>{
  for(const [slot,bpm,end,extra] of [[612,87.46,81416,356],[617,130.3,162133,360]]){
    const candidate=sample(slot,{
      'sound.bpm':bpm,'sample.end':end,'sound.pitch':0
    });
    const wav=createOfficialSampleWav(candidate);
    const list=wavChunks(wav).get('LIST');
    const n=new DataView(list.buffer,list.byteOffset,list.byteLength).getUint32(8,true);
    assert.equal(n%4,0);
    assert.equal(wav.length-candidate.data.length,extra);
    const tng=list.subarray(12,12+n);
    assert.equal(JSON.parse(new TextDecoder().decode(tng).replaceAll(String.fromCharCode(0),''))['sound.bpm'],bpm);
  }
});

test('official whole device PAK has deflated leading-slash paths, correct manifest, original bytes and no serial',async()=>{
  const p=project('01');
  const s=sample();
  const result=await createOfficialEpPak({
    scope:'device',device,projects:[p],samples:[s],createdAt:new Date('2026-10-21T00:00:00.000Z')
  });
  assert.equal(result.extension,'.pak');
  const files=readZip(await result.blob.arrayBuffer());
  assert.deepEqual([...files.keys()],['/projects/P01.tar','/sounds/007 kick.wav','/meta.json']);
  for(const f of files.values())assert.equal(f.method,8);
  assert.deepEqual(files.get('/projects/P01.tar').data,p.data);
  assert.deepEqual(wavChunks(files.get('/sounds/007 kick.wav').data).get('data'),s.data);
  const meta=JSON.parse(new TextDecoder().decode(files.get('/meta.json').data));
  assert.equal(meta.pak_type,'user');
  assert.equal(meta.pak_version,1);
  assert.equal(meta.pak_release,'1.2.0');
  assert.equal(meta.device_version,'2.5.1');
  assert.equal(meta.base_sku,'TE032AS001');
  assert.equal('serial' in meta,false);
  assert.equal('identityHash' in meta,false);
  assert.equal(new TextDecoder().decode(files.get('/meta.json').data).includes('PRIVATE-UNUSED'),false);
});

test('official PPAK contains one project, referenced sample and project pak_type',async()=>{
  const result=await createOfficialEpPak({
    scope:'project+samples',device,projects:[project('06')],samples:[sample()],
  });
  assert.equal(result.extension,'.ppak');
  const files=readZip(await result.blob.arrayBuffer());
  assert.equal(files.size,3);
  assert.equal(JSON.parse(new TextDecoder().decode(files.get('/meta.json').data)).pak_type,'project');
});

test('official export fails closed on missing sample, unknown firmware, corrupt PCM, unsupported loop metadata and duplicate slots',async()=>{
  await assert.rejects(()=>createOfficialEpPak({scope:'project+samples',device,projects:[project('06',[7,8])],samples:[sample()]}),/missing referenced/);
  await assert.rejects(()=>createOfficialEpPak({scope:'device',device:{...device,metadata:{os_version:'2.5.2'}},projects:[project()],samples:[sample()]}),/verified only/);
  await assert.rejects(()=>createOfficialEpPak({scope:'device',device,projects:[project()],samples:[sample(),sample()]}),/duplicate/);
  assert.throws(()=>createOfficialSampleWav({...sample(),data:Uint8Array.of(1)}),/truncated/);
  assert.throws(()=>createOfficialSampleWav(sample(7,{'sound.loopstart':0,'sound.loopend':100})),/loop markers/);
  await assert.rejects(()=>createOfficialEpPak({scope:'device',device,projects:[{project:'01',data:Uint8Array.of(1)}],samples:[]}),/TAR/);
});

test('old SpeedUpperCut ZIP stays STORED and its restore parser remains compatible',async()=>{
  const result=await createEpBackupBundle({scope:'device',device,projects:[project()],samples:[sample()]});
  const files=readZip(await result.blob.arrayBuffer());
  for(const f of files.values())assert.equal(f.method,0);
  const parsed=parseEpBackupBundle(new Uint8Array(await result.blob.arrayBuffer()));
  assert.equal(parsed.samples.length,1);
  assert.deepEqual(parsed.samples[0].data,sample().data);
});
